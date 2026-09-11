#!/usr/bin/env node
/**
 * 运行期依赖自检 —— 会在 `docker build` 的最后一步执行。
 *
 * 为什么需要它：
 * 镜像构建里有一句 `npm prune --omit=dev`，它按 package.json/lock 修剪依赖树。
 * 万一将来 prune 删多了（npm 行为变化、依赖被误挪到 devDependencies、
 * 有人加上 --include=dev 之类），失败现场是**容器起不来或某个接口 500** ——
 * 在生产上、在半夜、在没有任何提示的情况下。而这一步能把同一件事变成
 * 「构建失败 + 明确的报错信息」，在发布前就拦住。
 *
 * 它也刻意验证 prune **确实生效**（@nestjs/cli 必须消失），否则镜像会悄悄变胖，
 * 而变胖是没人会主动去查的。
 *
 * 既在构建时跑，也可以在生产上手动跑：
 *   docker exec nailong-server node scripts/check-runtime-deps.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const NM = path.join(ROOT, 'node_modules')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

const problems = []
const notes = []

// ── 1. package.json 里每一个 dependencies 都必须真的在 node_modules 里 ──
// 用「目录 + package.json 存在」而不是 require.resolve：
// 有些包（如 prisma）的入口是 CLI 而非可 require 的模块，
// require.resolve 会误报，那种假失败比不检查更糟。
const deps = Object.keys(pkg.dependencies || {})
const missing = []
for (const name of deps) {
  const p = path.join(NM, name, 'package.json')
  if (!fs.existsSync(p)) missing.push(name)
}
if (missing.length) {
  problems.push(`dependencies 里有 ${missing.length} 个包在 node_modules 中不存在：${missing.join(', ')}`)
}
notes.push(`dependencies 共 ${deps.length} 个，全部存在`)

// ── 2. entrypoint.sh 依赖的 prisma CLI 可执行文件 ──
// 这个尤其关键：entrypoint 启动时先跑 `prisma migrate deploy`，
// 它不在的话容器直接起不来（这正是 prisma 必须留在 dependencies 的原因）。
const prismaBin = path.join(NM, '.bin', 'prisma')
if (!fs.existsSync(prismaBin)) {
  problems.push('node_modules/.bin/prisma 不存在 —— entrypoint.sh 的 `prisma migrate deploy` 会失败。' +
    '请确认 prisma 在 package.json 的 dependencies（而不是 devDependencies）里。')
} else {
  notes.push('node_modules/.bin/prisma 存在')
}

// ── 3. 生成好的 Prisma Client ──
// node_modules/.prisma 是 `prisma generate` 的产物、不在 package.json 里，
// 属于 npm prune 的「未定义行为区」，所以必须显式验证。
const genClient = path.join(NM, '.prisma', 'client', 'index.js')
if (!fs.existsSync(genClient)) {
  problems.push('node_modules/.prisma/client/index.js 不存在 —— Prisma Client 未生成，' +
    '所有数据库操作都会失败。Dockerfile 里 prune 之后必须再跑一次 `prisma generate`。')
} else {
  notes.push('node_modules/.prisma/client 已生成')
}

// ── 4. prune 必须真的生效（防体积回退）──
// 这两个包只可能在构建/测试期被用到，运行期出现即说明 prune 没起作用。
const DEV_ONLY_MARKERS = ['@nestjs/cli', 'jest']
const leaked = DEV_ONLY_MARKERS.filter((m) => fs.existsSync(path.join(NM, m)))
if (leaked.length) {
  problems.push(`devDependencies 没有被 prune 掉：${leaked.join(', ')} 仍在 node_modules 里。` +
    '镜像会白白大出上百 MB。请检查 Dockerfile 里的 `npm prune --omit=dev`。')
} else {
  notes.push('prune 生效（@nestjs/cli / jest 已移除）')
}

// ── 5. sharp 的原生二进制（上传缩略图靠它）──
// sharp 0.33 走 @img/* 可选依赖，平台不匹配时 npm 会静默跳过，
// 症状是上传接口 500 而启动完全正常。
try {
  require(path.join(NM, 'sharp'))
  notes.push('sharp 可加载（原生二进制匹配当前平台）')
} catch (e) {
  problems.push(`sharp 无法加载：${e.message.split('\n')[0]}`)
}

// ── 6. bcrypt 的原生二进制（登录/注册靠它）──
try {
  require(path.join(NM, 'bcrypt'))
  notes.push('bcrypt 可加载（原生二进制匹配当前平台）')
} catch (e) {
  problems.push(`bcrypt 无法加载：${e.message.split('\n')[0]}`)
}

// ── 输出 ──
for (const n of notes) console.log('  ok   ' + n)

if (problems.length) {
  console.error('\n运行期依赖自检失败：')
  for (const p of problems) console.error('  ✗ ' + p)
  console.error('')
  process.exit(1)
}
console.log('\n运行期依赖自检通过。')
