#!/usr/bin/env node
/**
 * 存量图片 URL 修复：把数据库里存成**绝对地址**的图片 URL 改写成同源相对路径。
 *
 * 背景：`MINIO_PUBLIC_URL` 未配置时，旧版 MinioService.baseUrl 会退化成
 * `http://{MINIO_ENDPOINT}:{MINIO_PORT}/{bucket}`，并被**永久写进数据库**。
 * 这种地址在浏览器里必然是坏图：生产环境 `minio` 是 Docker 内网主机名，解析不了；
 * 开发环境虽然能解析 localhost:9000，但服务端 CSP 是 `img-src 'self' data:`，同样被拦。
 *
 * 用法（在 server/ 目录下执行）：
 *   node scripts/fix-image-urls.js                 # 预演，只报告不改动
 *   node scripts/fix-image-urls.js --apply         # 真正执行
 *   node scripts/fix-image-urls.js --apply --to=/minio   # 指定目标前缀（默认 /minio）
 *
 * 是幂等的：已经是相对路径的记录会被跳过。
 */

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

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
const toArg = process.argv.find((a) => a.startsWith('--to='))
const TARGET_PREFIX = (toArg ? toArg.slice('--to='.length) : pick('MINIO_PUBLIC_URL', '/minio'))
  .trim()
  .replace(/\/+$/, '')

if (!TARGET_PREFIX.startsWith('/')) {
  console.error(
    `目标前缀必须是同源相对路径（以 / 开头），当前是 "${TARGET_PREFIX}"。\n` +
      `绝对地址（http://...）正是本脚本要修掉的问题本身。`,
  )
  process.exit(1)
}

const bucket = pick('MINIO_BUCKET', 'nailong-images')
const FIELDS = ['url', 'thumbnailUrl', 'thumbnailSmUrl']

/**
 * 把绝对地址改写成 {前缀}/{bucket}/{object}。
 *   http://localhost:9000/nailong-images/xxx.jpg  ->  /minio/nailong-images/xxx.jpg
 *   http://a.b.c:9000/xxx.jpg                     ->  /minio/xxx.jpg
 * 已经是相对路径的原样返回。
 */
function rewrite(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, '')
  const segs = withoutOrigin.split('/').filter(Boolean)
  // 末尾至少要有「对象名」；带上 bucket 段能保留原始 bucket，避免依赖 MINIO_BUCKET 配置
  const tail = segs.length >= 2 ? segs.join('/') : `${bucket}/${segs[0] ?? ''}`
  return `${TARGET_PREFIX}/${tail}`
}

async function main() {
  const prisma = new PrismaClient()
  console.log(`目标前缀: ${TARGET_PREFIX}`)
  console.log(`模式:     ${APPLY ? 'APPLY（会真正写库）' : 'DRY-RUN（只报告）'}`)
  try {
    const rows = await prisma.image.findMany({
      select: { id: true, title: true, url: true, thumbnailUrl: true, thumbnailSmUrl: true },
    })
    console.log(`共 ${rows.length} 条图片记录\n`)

    let touched = 0
    for (const row of rows) {
      const updates = {}
      for (const f of FIELDS) {
        const next = rewrite(row[f])
        if (next) updates[f] = next
      }
      if (Object.keys(updates).length === 0) continue
      touched++
      console.log(`${row.id}  ${row.title ?? ''}`)
      for (const [f, next] of Object.entries(updates)) {
        console.log(`    ${f}\n      ${row[f]}\n   -> ${next}`)
      }
      if (APPLY) {
        await prisma.image.update({ where: { id: row.id }, data: updates })
      }
    }

    if (touched === 0) {
      console.log('没有需要修复的记录。')
    } else if (APPLY) {
      console.log(`\n已修复 ${touched} 条记录。`)
      // 写回校验：重新查一遍确认没有绝对地址残留
      const after = await prisma.image.findMany({ select: { url: true } })
      const remain = after.filter((r) => /^https?:\/\//i.test(r.url)).length
      console.log(remain === 0 ? '复核通过：已无绝对地址。' : `⚠ 复核发现仍有 ${remain} 条绝对地址！`)
      if (remain) process.exitCode = 1
    } else {
      console.log(`\nDRY-RUN 结束，共 ${touched} 条待修复。确认无误后加 --apply 执行。`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
