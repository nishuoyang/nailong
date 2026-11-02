#!/usr/bin/env node
/**
 * 表情包种子数据（seed）：为「大肥鱼表情包 · 100 个中文 GIF」合集整理者创建账号，
 * 并把100 张合集表情包（含已上线的 16 张）全部归到该账号名下、标记为已审核。
 *
 * 背景：/deepsea 页面原先硬编码 16 张（client/src/data/whaleMemes.ts），
 * 本次改造为「用户投喂 + 审核」体系，100 张合集作为 source=archive 的存量数据
 * 统一归属合集整理者 ming 的账号——已有的和新增的都算他的。
 *
 * 用法（在 server/ 目录下执行；生产用 docker exec nailong-server node scripts/seed-memes.js）：
 *   node scripts/seed-memes.js            # 预演（DRY-RUN），只报告不改动
 *   node scripts/seed-memes.js --apply    # 真正执行
 *
 * 设计：
 *  - 幂等：用户按 username 查找（存在则复用）；表情包按 code upsert，可反复执行。
 *  - 默认密码随机生成并在输出中打印一次；SEED_MEMING_PASSWORD 环境变量可指定。
 *  - 只读 scripts/meme-seed.json（100 条元数据，随仓库入库），不依赖上游 GitHub 仓库。
 */

const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

// ── 极简 .env 读取（与 backfill-image-dims.js 同款，不依赖 dotenv）──
function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}
loadEnv(path.join(__dirname, '..', '.env'))

const APPLY = process.argv.includes('--apply')
// 与 auth.service.ts 的 BCRYPT_COST 保持一致（cost 是每个哈希自带的字段）
const BCRYPT_COST = 11

const OWNER = {
  username: 'ming',
  email: 'ming@ai-biaoqingbao.example',
  bio: '「大肥鱼表情包 · 100 个中文 GIF」合集整理者。',
}

async function main() {
  const seedPath = path.join(__dirname, 'meme-seed.json')
  if (!fs.existsSync(seedPath)) {
    console.error('缺少 scripts/meme-seed.json（100 条表情包元数据），无法继续')
    process.exit(1)
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
  const prisma = new PrismaClient()

  try {
    // ── 1. 账号（幂等：按 username 复用）──
    let owner = await prisma.user.findUnique({ where: { username: OWNER.username } })
    let generatedPassword = null
    if (!owner) {
      generatedPassword =
        process.env.SEED_MEMING_PASSWORD ||
        `dfy-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`
      const passwordHash = await bcrypt.hash(generatedPassword, BCRYPT_COST)
      console.log(`[dry=${!APPLY}] 创建用户 ${OWNER.username}（${OWNER.email}）`)
      if (APPLY) {
        owner = await prisma.user.create({
          data: {
            username: OWNER.username,
            email: OWNER.email,
            passwordHash,
            role: 'user',
            bio: OWNER.bio,
            bioStatus: 'approved',
          },
        })
      }
    } else {
      console.log(`用户 ${OWNER.username} 已存在（id=${owner.id}），复用`)
    }

    // ── 2. 表情包 upsert（幂等：按 code）──
    let created = 0
    let updated = 0
    for (const meme of seed) {
      const data = {
        title: meme.title,
        note: meme.note,
        mood: meme.mood,
        tags: (meme.tags || []).join(','),
        url: meme.url,
        source: 'archive',
        status: 'approved',
        // 归属：已有的和新增的都算合集整理者的
        ...(owner ? { userId: owner.id } : {}),
      }
      const existing = await prisma.meme.findUnique({ where: { code: meme.code } })
      if (existing) {
        updated++
        if (APPLY) await prisma.meme.update({ where: { code: meme.code }, data })
      } else {
        created++
        if (APPLY) await prisma.meme.create({ data: { code: meme.code, ...data } })
      }
    }

    console.log(`\n表情包：新建 ${created}，更新 ${updated}，合计 ${seed.length} 条`)
    if (!APPLY) {
      console.log('（DRY-RUN，未写库。加 --apply 执行）')
    } else {
      const total = await prisma.meme.count({ where: { source: 'archive' } })
      console.log(`已入库（source=archive）：${total} 条`)
      if (generatedPassword) {
        console.log(`\n⚠️  ${OWNER.username} 的初始密码：${generatedPassword}`)
        console.log('   请转告本人并提醒尽快修改（或设 SEED_MEMING_PASSWORD 后重跑本脚本以重置）。')
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
