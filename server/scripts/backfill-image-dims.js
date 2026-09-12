#!/usr/bin/env node
/**
 * 存量图片显示尺寸回填（backfill）：给 `Image.width` / `Image.height` 写入像素尺寸
 * （待办 #6「Image 表补 width/height + 缩略图 srcset」的存量数据部分）。
 *
 * 语义：与 `upload.service.ts` 完全一致 —— 存的是 **800px 缩略图（thumbnailUrl）**
 * 的输出像素，不是原图尺寸。理由见 `schema.prisma` Image.width 的注释：
 * 前端只需要宽高比做 aspect-ratio 占位（根治 CLS），md 缩略图「只缩宽、不裁剪」，
 * 比例与原图一致；原图仅经 /file 代理下载，故意不参与视图加载。
 *
 * 用法（在 server/ 目录下执行；生产用 docker exec nailong-server node scripts/backfill-image-dims.js）：
 *   node scripts/backfill-image-dims.js            # 预演（DRY-RUN），只报告不改动
 *   node scripts/backfill-image-dims.js --apply    # 真正执行
 *
 * 设计：
 *  - 幂等：只处理 width/height 为空的行，可反复执行。
 *  - 只抓 **md 缩略图**（约 10~90KB）而不是原图（可达 10MB）：比例完全一致，
 *    成本低一个量级；连不上/读失败的图片单独报告，不阻塞整批。
 *  - 写完后逐行读回校验，而不是相信 update 成功就完事。
 *  - 读 .env（不依赖 dotenv），与运行时配置一致。
 */

const fs = require('fs')
const path = require('path')
const Minio = require('minio')
const sharp = require('sharp')
const { PrismaClient } = require('@prisma/client')

// ── 极简 .env 读取（与 backfill-object-meta.js 同款，不依赖 dotenv）──
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

// Prisma 需要 DATABASE_URL 在进程环境里；生产 compose 已注入，本地读 .env。
process.env.DATABASE_URL = pick('DATABASE_URL', 'file:./data.db')

const bucket = pick('MINIO_BUCKET', 'nailong-images')
const client = new Minio.Client({
  endPoint: pick('MINIO_ENDPOINT', 'localhost'),
  port: Number(pick('MINIO_PORT', '9000')),
  useSSL: false,
  accessKey: pick('MINIO_ACCESS_KEY', 'minioadmin'),
  secretKey: pick('MINIO_SECRET_KEY', 'minioadmin'),
})
const prisma = new PrismaClient()

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

/** 从落库 URL（`/minio/<bucket>/<name>` 或任意路径前缀）还原对象名 */
function objectKeyFromUrl(urlString) {
  if (!urlString) return null
  const prefix = `/minio/${bucket}/`
  const i = urlString.indexOf(prefix)
  if (i >= 0) return urlString.slice(i + prefix.length)
  return urlString.split('/').pop() || null
}

async function main() {
  console.log(`bucket: ${bucket}`)
  console.log(`模式:   ${APPLY ? 'APPLY（会真正写入数据库）' : 'DRY-RUN（只报告）'}`)
  console.log('')

  const [pending, done] = await Promise.all([
    prisma.image.findMany({
      where: { OR: [{ width: null }, { height: null }] },
      select: { id: true, thumbnailUrl: true, url: true, width: true, height: true },
    }),
    prisma.image.count({
      where: { width: { not: null }, height: { not: null } },
    }),
  ])
  console.log(`已回填: ${done} 张；待回填: ${pending.length} 张\n`)

  let ok = 0
  let fail = 0
  for (const img of pending) {
    const objUrl = img.thumbnailUrl || img.url
    const key = objectKeyFromUrl(objUrl)
    if (!key) {
      fail++
      console.log(`  ! ${img.id} 无法解析对象名（url=${objUrl}）`)
      continue
    }
    try {
      // md 缩略图已由 .rotate() 烘焙过 EXIF 方向，这里不用再 rotate
      const buf = await streamToBuffer(await client.getObject(bucket, key))
      const meta = await sharp(buf).metadata()
      const w = meta.width
      const h = meta.height
      if (!w || !h) {
        fail++
        console.log(`  ! ${img.id} 读不到宽高（${key}）`)
        continue
      }
      if (APPLY) {
        await prisma.image.update({ where: { id: img.id }, data: { width: w, height: h } })
        const back = await prisma.image.findUnique({
          where: { id: img.id },
          select: { width: true, height: true },
        })
        if (back.width === w && back.height === h) {
          ok++
          console.log(`  ✓ ${img.id}: ${img.width ?? '-'}x${img.height ?? '-'} -> ${w}x${h}`)
        } else {
          fail++
          console.log(`  ✗ ${img.id} 回填后读回 ${back.width}x${back.height}，预期 ${w}x${h}`)
        }
      } else {
        console.log(`  [dry] ${img.id}: ${img.width ?? '-'}x${img.height ?? '-'} -> ${w}x${h}（${key}）`)
      }
    } catch (err) {
      fail++
      console.log(`  ! ${img.id}（${key}）: ${err.message}`)
    }
  }

  console.log(`\n完成：成功 ${ok}，失败 ${fail}${APPLY ? '' : '（DRY-RUN，加 --apply 才会写入）'}`)
  if (fail) process.exitCode = 1
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await prisma.$disconnect()
  } catch {}
  process.exit(1)
})