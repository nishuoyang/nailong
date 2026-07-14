const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

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

  // 创建管理员（如不存在）
  const adminEmail = 'admin@nailong.com'
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 12)
    await prisma.user.create({
      data: {
        username: 'admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
      },
    })
    console.log('Admin created: admin@nailong.com / admin123')
  }

  // 创建测试用户（如不存在）
  const userEmail = 'user@nailong.com'
  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } })
  if (!existingUser) {
    const passwordHash = await bcrypt.hash('user123', 12)
    await prisma.user.create({
      data: {
        username: 'testuser',
        email: userEmail,
        passwordHash,
        role: 'user',
      },
    })
    console.log('Test user created: user@nailong.com / user123')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seed error:', e)
    prisma.$disconnect()
    process.exit(1)
  })
