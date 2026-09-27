const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const prisma = new PrismaClient()

// 密码哈希 cost 与 auth.service.ts 对齐（待办 #8：12 → 11）。
const SEED_BCRYPT_COST = 11

// ── 为什么这个文件要读环境变量（2026-09-27）──
// 原来这里写死了 admin@nailong.com / admin123 与 user@nailong.com / user123，
// 而本仓库是**公开**的：任何看到 seed.js 的人都能拿这组口令去登生产后台
// （实测生产库里这两个账号当时仍然有效，见 docs/安全告警-20260927-默认口令仍在生产使用.md）。
// 所以现在：
//   · 管理员口令由 SEED_ADMIN_PASSWORD 提供；没提供就**随机生成**并只在启动日志里打印一次；
//   · 测试账号默认只在非生产环境创建（生产要它得显式 SEED_TEST_USER=true）；
//   · 每次启动做一次默认口令自检，发现还在用就大声喊出来（可关：SECURITY_SELFCHECK=off）。
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@nailong.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || ''
const TEST_EMAIL = 'user@nailong.com'
const IS_PROD = process.env.NODE_ENV === 'production'
const WANT_TEST_USER = process.env.SEED_TEST_USER === 'true' || !IS_PROD

/** 历史上随公开仓库分发过的默认口令，只用于自检，绝不用于创建账号 */
const LEGACY_DEFAULT_PASSWORDS = ['admin123', 'user123']

function randomPassword() {
  // 18 字节 → base64url 24 字符，足够强且不用手动敲符号
  return crypto.randomBytes(18).toString('base64url')
}

async function main() {
  // 创建默认分类
  const categories = [
    { name: '风景', slug: 'landscape', description: '自然风光、城市景观' },
    { name: '人物', slug: 'portrait', description: '人像、街拍' },
    { name: '动物', slug: 'animal', description: '宠物、野生动物' },
    { name: '美食', slug: 'food', description: '美食摄影' },
    { name: '建筑', slug: 'architecture', description: '建筑、室内设计' },
    { name: '抽象', slug: 'abstract', description: '抽象艺术、创意摄影' },
    { name: '黑白', slug: 'black-and-white', description: '黑白摄影' },
    { name: '旅行', slug: 'travel', description: '旅行随拍' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }
  console.log('Categories seeded')

  // ── 管理员（只在不存在时创建；不会改写存量口令）──
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  let adminJustCreated = false
  if (!existingAdmin) {
    const generated = !ADMIN_PASSWORD
    const password = ADMIN_PASSWORD || randomPassword()
    const passwordHash = await bcrypt.hash(password, SEED_BCRYPT_COST)
    await prisma.user.create({
      data: { username: 'admin', email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    })
    adminJustCreated = true
    if (generated) {
      console.log(`Admin created: ${ADMIN_EMAIL} / ${password}`)
      console.log('  ⚠️ 上面这个口令是随机生成的，只打印这一次 —— 登录后请立刻改成你自己的口令。')
    } else {
      console.log(`Admin created: ${ADMIN_EMAIL}（口令来自 SEED_ADMIN_PASSWORD，不在此打印）`)
    }
  }

  // ── 测试账号（默认只在非生产环境创建）──
  if (WANT_TEST_USER) {
    const existingUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
    if (!existingUser) {
      const passwordHash = await bcrypt.hash('user123', SEED_BCRYPT_COST)
      await prisma.user.create({
        data: { username: 'testuser', email: TEST_EMAIL, passwordHash, role: 'user' },
      })
      console.log(`Test user created: ${TEST_EMAIL} / user123（仅供本地开发）`)
    }
  } else {
    console.log('跳过测试账号（生产环境，需要的话设 SEED_TEST_USER=true）')
  }

  // ── 默认口令自检：能自动发现的事，不应该靠人定期去查 ──
  if (process.env.SECURITY_SELFCHECK !== 'off') {
    const admin = adminJustCreated ? null : await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (admin) {
      for (const guess of LEGACY_DEFAULT_PASSWORDS) {
        if (await bcrypt.compare(guess, admin.passwordHash)) {
          console.error(
            [
              '',
              '================= 安全告警 =================',
              `管理员账号 ${ADMIN_EMAIL} 仍在使用**随公开仓库分发过的默认口令**。`,
              '任何读过本仓库的人都可以登录你的后台。请立刻修改：',
              '',
              `  docker exec nailong-server node -e "const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcrypt');const p=new PrismaClient();(async()=>{const h=await bcrypt.hash('<新口令>',11);await p.user.update({where:{email:'${ADMIN_EMAIL}'},data:{passwordHash:h}});console.log('done');await p.\\$disconnect()})()"`,
              '',
              '（自检只比对已知的历史默认口令，不记录也不打印任何口令本身。）',
              '============================================',
              '',
            ].join('\n'),
          )
          break
        }
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seed error:', e)
    prisma.$disconnect()
    process.exit(1)
  })
