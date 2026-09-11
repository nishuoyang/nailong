#!/usr/bin/env node
/**
 * 存量对象元数据修复（backfill）：给 MinIO 里已有的对象补写正确的
 * `Content-Type` 与 `Cache-Control`。
 *
 * 背景：`upload.service.ts` 早期调用 `putObject` 时没有传 meta，
 * MinIO 于是把所有对象都存成了 `binary/octet-stream`（线上 33 个对象全部如此）。
 * 事件本身已经被 `/minio` 代理「按扩展名推断 Content-Type」兜住了，
 * 但任何绕过代理的读取（MinIO 控制台、CDN 回源、预签名直连）拿到的仍是错的类型。
 *
 * 用法（在 server/ 目录下执行）：
 *   node scripts/backfill-object-meta.js            # 预演，只报告不改动
 *   node scripts/backfill-object-meta.js --apply    # 真正执行
 *
 * 说明：
 *  - 用「下载 → 重新上传」而不是 copyObject 自复制来改元数据 ——
 *    minio SDK 7.1.3 的 copyObject 只发 x-amz-copy-source 与条件头，
 *    **不带** x-amz-metadata-directive: REPLACE，自复制的效果是原样拷贝旧元数据，改不了。
 *  - 是幂等的：已经正确的对象会被跳过，可以反复执行。
 */

const fs = require('fs')
const path = require('path')
const Minio = require('minio')

// ── 极简 .env 读取（不依赖 dotenv，避免在镜像里依赖传递安装的包）──
function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const envFile = loadEnv(path.join(__dirname, '..', '.env'))
const pick = (key, fallback) => process.env[key] ?? envFile[key] ?? fallback

const APPLY = process.argv.includes('--apply')

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
}
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const bucket = pick('MINIO_BUCKET', 'nailong-images')
const client = new Minio.Client({
  endPoint: pick('MINIO_ENDPOINT', 'localhost'),
  port: Number(pick('MINIO_PORT', '9000')),
  useSSL: false,
  accessKey: pick('MINIO_ACCESS_KEY', 'minioadmin'),
  secretKey: pick('MINIO_SECRET_KEY', 'minioadmin'),
})

/** statObject 返回的 metaData 键大小写由 HTTP 响应决定，统一按小写取值 */
function getMeta(metaData, name) {
  if (!metaData) return undefined
  const lower = name.toLowerCase()
  for (const key of Object.keys(metaData)) {
    if (key.toLowerCase() === lower) return metaData[key]
  }
  return undefined
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function listAllObjects() {
  return new Promise((resolve, reject) => {
    const objects = []
    const stream = client.listObjectsV2(bucket, '', true)
    stream.on('data', (obj) => objects.push(obj))
    stream.on('error', reject)
    stream.on('end', () => resolve(objects))
  })
}

async function main() {
  console.log(`bucket: ${bucket}`)
  console.log(`模式:   ${APPLY ? 'APPLY（会真正修改）' : 'DRY-RUN（只报告）'}`)
  console.log('')

  const objects = await listAllObjects()
  console.log(`共 ${objects.length} 个对象\n`)

  const already = []
  const needFix = []
  const unknown = []

  for (const obj of objects) {
    const ext = obj.name.split('.').pop().toLowerCase()
    const want = MIME_BY_EXT[ext]
    if (!want) {
      unknown.push({ name: obj.name, current: '(扩展名未知)' })
      continue
    }
    let current
    try {
      const stat = await client.statObject(bucket, obj.name)
      current = getMeta(stat.metaData, 'content-type')
    } catch (err) {
      console.log(`  ! statObject 失败 ${obj.name}: ${err.message}`)
      continue
    }
    if (current === want) already.push(obj.name)
    else needFix.push({ name: obj.name, current: current ?? '(未设置)', want, size: obj.size })
  }

  console.log(`已正确:      ${already.length}`)
  console.log(`需要修复:    ${needFix.length}`)
  console.log(`扩展名未知:  ${unknown.length}（跳过，交由代理按 HEAD 推断）`)
  console.log('')

  if (needFix.length) {
    console.log('需要修复的对象：')
    for (const f of needFix) console.log(`  ${f.name}\n      ${f.current}  ->  ${f.want}`)
    console.log('')
  }

  if (!APPLY || needFix.length === 0) {
    if (!APPLY) console.log('DRY-RUN 结束。确认无误后加 --apply 重新执行。')
    else console.log('无需修复。')
    return
  }

  console.log('开始修复...')
  let ok = 0
  let fail = 0
  for (const f of needFix) {
    try {
      const buf = await streamToBuffer(await client.getObject(bucket, f.name))
      await client.putObject(bucket, f.name, buf, undefined, {
        'Content-Type': f.want,
        'Cache-Control': CACHE_CONTROL,
      })
      // 立刻读回校验，而不是相信 putObject 成功就完事
      const stat = await client.statObject(bucket, f.name)
      const now = getMeta(stat.metaData, 'content-type')
      if (now === f.want) {
        ok++
        console.log(`  ✓ ${f.name} -> ${now}`)
      } else {
        fail++
        console.log(`  ✗ ${f.name} 重新上传后仍是 ${now}`)
      }
    } catch (err) {
      fail++
      console.log(`  ✗ ${f.name}: ${err.message}`)
    }
  }
  console.log(`\n完成：成功 ${ok}，失败 ${fail}`)
  if (fail) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
