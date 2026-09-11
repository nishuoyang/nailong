#!/usr/bin/env node
/**
 * 部署后冒烟测试（只读，可安全地对生产执行）。
 *
 * 覆盖的是「改坏了会静默出问题、但看日志看不出来」的那几处关键不变量：
 *   - 图片 URL 是不是同源相对路径（绝对地址 = 浏览器坏图）
 *   - /minio 代理的 Content-Type / 缓存头 / Range 支持
 *   - 下载接口是否真的返回附件（而不是被异常分支兜成 302）
 *   - 限流响应体是不是可读的 JSON
 *   - 安全响应头是否还在
 *
 * 用法：
 *   node scripts/smoke-test.js                          # 默认 http://127.0.0.1:3000
 *   node scripts/smoke-test.js https://nailonghub.top   # 对生产执行
 *   node scripts/smoke-test.js https://nailonghub.top --throttle   # 额外跑限流用例（会消耗配额）
 *
 * 不传 --throttle 时不会写入任何数据、也不会耗尽配额。
 */

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:3000').replace(/\/+$/, '')
const WITH_THROTTLE = process.argv.includes('--throttle')

const results = []
const ok = (name, pass, detail) => results.push({ name, pass, detail })

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

async function json(path, init) {
  const res = await fetch(BASE + path, init)
  let body = null
  try {
    body = await res.json()
  } catch {}
  return { res, body }
}

async function main() {
  console.log(`目标: ${BASE}\n`)

  // ── 健康检查 ──
  {
    const { res, body } = await json('/api/health')
    ok('GET /api/health 返回 200', res.status === 200, `status=${res.status}`)
    ok('健康检查 body 正确', body?.data?.status === 'ok', JSON.stringify(body)?.slice(0, 80))
    const xcto = res.headers.get('x-content-type-options')
    const csp = res.headers.get('content-security-policy') || ''
    ok('X-Content-Type-Options: nosniff', xcto === 'nosniff', xcto)
    ok('CSP 含 img-src \'self\'', csp.includes("img-src 'self'"), csp.slice(0, 60))
  }

  // ── 图片列表 & URL 形态 ──
  let sample = null
  {
    const { res, body } = await json('/api/images?size=5')
    ok('GET /api/images 返回 200', res.status === 200, `status=${res.status}`)
    const rows = body?.data ?? []
    ok('列表有数据', rows.length > 0, `${rows.length} 条`)
    const absolute = rows.filter((r) => /^https?:\/\//i.test(r.url || ''))
    ok(
      '列表里的图片 URL 都是同源相对路径',
      absolute.length === 0,
      absolute.length ? `绝对地址 ${absolute.length} 条，例：${absolute[0].url}` : `${rows.length} 条全部相对`,
    )
    sample = rows.find((r) => r.thumbnailUrl && r.status === 'approved') ?? rows[0] ?? null
  }

  // ── /minio 代理 ──
  if (sample) {
    const url = BASE + sample.thumbnailUrl
    const res = await fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = sample.thumbnailUrl.split('.').pop().toLowerCase()
    const want = MIME_BY_EXT[ext]

    ok('/minio 代理返回 200', res.status === 200, `status=${res.status} ${sample.thumbnailUrl}`)
    ok('/minio Content-Type 与扩展名一致', res.headers.get('content-type') === want, `${ext} -> ${res.headers.get('content-type')}`)
    ok('/minio Accept-Ranges: bytes', res.headers.get('accept-ranges') === 'bytes', res.headers.get('accept-ranges'))
    ok('/minio Cache-Control 含 immutable', (res.headers.get('cache-control') || '').includes('immutable'), res.headers.get('cache-control'))
    ok('/minio 返回了实际字节', buf.length > 0, `${buf.length} bytes`)

    // Range
    const r206 = await fetch(url, { headers: { Range: 'bytes=0-99' } })
    const part = Buffer.from(await r206.arrayBuffer())
    ok('/minio Range 返回 206', r206.status === 206, `status=${r206.status}`)
    ok('/minio Range 长度与 Content-Range 正确', part.length === 100 && /^bytes 0-99\/\d+$/.test(r206.headers.get('content-range') || ''), `${part.length} bytes, ${r206.headers.get('content-range')}`)
    ok('/minio Range 内容与整体前 100 字节一致', part.equals(buf.subarray(0, 100)), 'byte compare')

    const r416 = await fetch(url, { headers: { Range: `bytes=${buf.length + 10}-` } })
    ok('/minio 越界 Range 返回 416', r416.status === 416, `status=${r416.status}`)
  }

  // ── 下载接口 ──
  if (sample) {
    const dlUrl = `${BASE}/api/images/${sample.id}/file`
    const res = await fetch(dlUrl, { redirect: 'manual' })
    ok('下载接口未退化成 302', res.status === 200, `status=${res.status}${res.headers.get('location') ? ' location=' + res.headers.get('location') : ''}`)
    const ct = res.headers.get('content-type') || ''
    ok('下载接口 Content-Type 是图片', ct.startsWith('image/'), ct)
    const cd = res.headers.get('content-disposition') || ''
    ok('下载接口是 attachment', cd.startsWith('attachment;'), cd)
    ok(
      '下载接口文件名可解析（含 RFC 5987 filename* 或 ASCII 回退）',
      /filename=/.test(cd),
      cd,
    )
    ok('下载接口声明 Accept-Ranges', res.headers.get('accept-ranges') === 'bytes', res.headers.get('accept-ranges'))
    const buf = Buffer.from(await res.arrayBuffer())
    ok('下载接口有实际字节', buf.length > 0, `${buf.length} bytes`)

    const r206 = await fetch(dlUrl, { headers: { Range: 'bytes=10-59' } })
    const part = Buffer.from(await r206.arrayBuffer())
    ok('下载接口支持 Range (206)', r206.status === 206 && part.length === 50, `status=${r206.status} ${part.length} bytes`)
  }

  // ── 公共读接口 ──
  for (const path of ['/api/categories', '/api/daily', '/api/leaderboard', '/api/featured?size=3', '/api/other?size=3']) {
    const t0 = Date.now()
    const { res } = await json(path)
    const ms = Date.now() - t0
    ok(`GET ${path} 返回 200`, res.status === 200, `status=${res.status} ${ms}ms`)
    ok(`GET ${path} 未挂起（< 3s）`, ms < 3000, `${ms}ms`)
  }

  // ── SPA 兜底 ──
  {
    const res = await fetch(`${BASE}/`)
    const html = await res.text()
    ok('根路径返回 SPA 页面', res.status === 200 && /<div id="app"/.test(html), `status=${res.status} ${html.length} bytes`)
  }

  // ── 限流（可选，会消耗配额）──
  if (WITH_THROTTLE) {
    let body429 = null
    let saw429 = false
    let firstLimitHeader = null
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'smoke-test@example.invalid', password: 'x' }),
      })
      if (i === 0) firstLimitHeader = res.headers.get('x-ratelimit-limit')
      if (res.status === 429 && !saw429) {
        saw429 = true
        body429 = await res.text()
      }
    }
    ok('登录接口触发 429', saw429, saw429 ? 'ok' : '25 次都未限流')
    ok('登录配额为 20/分钟', firstLimitHeader === '20', `x-ratelimit-limit=${firstLimitHeader}`)
    ok(
      '429 响应体是可读 JSON 而非空',
      !!body429 && body429.includes('请求过于频繁'),
      body429 ?? '(空)',
    )
    // 其它接口不应被登录配额影响（限流 key = 控制器+处理器+IP）
    const { res } = await json('/api/categories')
    ok('登录配额耗尽后 /api/categories 仍 200', res.status === 200, `status=${res.status}`)
  } else {
    console.log('（跳过限流用例；需要时加 --throttle）\n')
  }

  console.log('\n================ 结果 ================')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `   [${r.detail}]` : ''}`)
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`)
  if (failed.length) process.exitCode = 1
}

main().catch((err) => {
  console.error('冒烟测试异常:', err)
  process.exit(1)
})
