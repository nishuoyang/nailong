import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始填充种子数据...\n')

  // 1. 创建默认分类
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
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
    console.log(`  📁 分类: ${created.name}`)
  }

  // 2. 创建默认管理员
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nailong.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@nailong.com',
      passwordHash: adminPassword,
      role: 'admin',
    },
  })
  console.log(`  👤 管理员: ${admin.email} (密码: admin123)`)

  // 3. 创建测试用户
  const userPassword = await bcrypt.hash('user123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'user@nailong.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'user@nailong.com',
      passwordHash: userPassword,
      role: 'user',
    },
  })
  console.log(`  👤 测试用户: ${user.email} (密码: user123)`)

  console.log('\n✅ 种子数据填充完成！')
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
