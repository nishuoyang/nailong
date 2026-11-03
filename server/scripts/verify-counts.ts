/**
 * 分类 / 标签计数口径回归校验。
 *
 * 背景：发现页筛选条曾出现「人物 3，点进去 0 张」——计数把待审核与其他推荐的图片
 * 一起算了，而列表只查 approved + general。此脚本用一份临时数据库复现完整矩阵
 * （status × section），逐个分类、标签比对「计数 vs 列表 total」，
 * 并模拟「审核通过」「移入其他推荐」两次状态流转，确保计数跟着走。
 *
 * 全程只操作临时库，不碰 server/prisma/data.db；结束后自动删除临时文件。
 *
 * 用法：
 *   cd server && npx ts-node --transpile-only scripts/verify-counts.ts
 */
import { copyFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { ImagesService } from '../src/images/images.service'
import { TagsService } from '../src/tags/tags.service'
import { AdminService } from '../src/admin/admin.service'

const serverRoot = resolve(__dirname, '..')
const sourceDb = join(serverRoot, 'prisma', 'data.db')
const tempDb = join(serverRoot, 'prisma', '.verify-counts.db')
const tempUrl = `file:${tempDb.replace(/\\/g, '/')}`

type Row = { 检查项: string; 期望: unknown; 实际: unknown; 结果: string }

const rows: Row[] = []
let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  rows.push({ 检查项: label, 期望: expected, 实际: actual, 结果: ok ? 'PASS' : 'FAIL' })
}

function cleanTemp() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(tempDb + suffix, { force: true })
  }
}

async function main() {
  cleanTemp()
  copyFileSync(sourceDb, tempDb)

  const prisma = new PrismaClient({ datasources: { db: { url: tempUrl } } })
  const images = new ImagesService(prisma as any, {} as any)
  const tags = new TagsService(prisma as any)
  const admin = new AdminService(prisma as any, {} as any, {} as any)

  try {
    // ── 清空并重建一组最小数据 ────────────────────────────────────────────
    await prisma.image.deleteMany()
    await prisma.meme.deleteMany()
    await prisma.collection.deleteMany()
    await prisma.follow.deleteMany()
    await prisma.tag.deleteMany()
    await prisma.category.deleteMany()
    await prisma.user.deleteMany()

    const user = await prisma.user.create({
      data: { username: 'count-sim', email: 'count-sim@example.test', passwordHash: 'x' },
    })

    const portrait = await prisma.category.create({ data: { name: '人物', slug: 'portrait' } })
    const animal = await prisma.category.create({ data: { name: '动物', slug: 'animal' } })
    const healing = await prisma.tag.create({ data: { name: '治愈', slug: 'zhiyu' } })
    const memeTag = await prisma.tag.create({ data: { name: '梗', slug: 'geng' } })
    const orphan = await prisma.tag.create({ data: { name: '孤立', slug: 'guli' } })

    const matrix = [
      { key: 'A', status: 'approved', section: 'general', cats: [portrait.id], tags: [healing.id] },
      { key: 'B', status: 'approved', section: 'general', cats: [portrait.id], tags: [] },
      { key: 'C', status: 'pending', section: 'general', cats: [portrait.id], tags: [healing.id] },
      { key: 'D', status: 'rejected', section: 'general', cats: [portrait.id], tags: [] },
      { key: 'E', status: 'offline', section: 'general', cats: [portrait.id], tags: [healing.id] },
      { key: 'F', status: 'approved', section: 'other', cats: [portrait.id], tags: [healing.id] },
      { key: 'G', status: 'pending', section: 'other', cats: [portrait.id], tags: [] },
      { key: 'H', status: 'approved', section: 'general', cats: [animal.id], tags: [memeTag.id] },
      { key: 'I', status: 'approved', section: 'general', cats: [], tags: [memeTag.id] },
      { key: 'J', status: 'pending', section: 'general', cats: [], tags: [orphan.id] },
    ]

    const ids: Record<string, string> = {}
    for (const item of matrix) {
      const created = await prisma.image.create({
        data: {
          title: `sim-${item.key}`,
          url: `http://example.test/${item.key}.jpg`,
          userId: user.id,
          status: item.status,
          section: item.section,
          categories: { create: item.cats.map((categoryId) => ({ categoryId })) },
          tags: { create: item.tags.map((tagId) => ({ tagId })) },
        },
      })
      ids[item.key] = created.id
    }

    console.log('\n模拟数据矩阵（10 张图）')
    console.table(
      matrix.map((item) => ({
        图片: item.key,
        状态: item.status,
        分区: item.section,
        分类: item.cats.map((id) => (id === portrait.id ? '人物' : '动物')).join(',') || '—',
        标签: item.tags.map((id) => (id === healing.id ? '治愈' : id === memeTag.id ? '梗' : '孤立')).join(',') || '—',
      })),
    )

    // ── 1. 分类计数 vs 分类列表 ────────────────────────────────────────────
    const cats = await images.getCategories()
    const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.count]))
    check('分类 人物 计数', catMap.portrait, 2)
    check('分类 动物 计数', catMap.animal, 1)

    for (const cat of cats) {
      const list = await images.findAll({ category: cat.slug, size: 24 })
      check(`分类 ${cat.name}：计数 == 列表 total`, cat.count, list.meta.total)
    }

    // ── 2. 标签计数 vs 标签列表 ────────────────────────────────────────────
    const tagList = await tags.list(100)
    const tagMap = Object.fromEntries(tagList.map((t) => [t.slug, t.count]))
    check('标签 治愈 计数', tagMap.zhiyu, 1)
    check('标签 梗 计数', tagMap.geng, 2)
    check('公开作品为 0 的标签不出现在公开标签列表', 'guli' in tagMap, false)

    for (const tag of tagList) {
      const list = await images.findAll({ tag: tag.slug, size: 24 })
      check(`标签 ${tag.name}：计数 == 列表 total`, tag.count, list.meta.total)
    }

    const orphanDetail = await tags.findBySlug('guli')
    check('孤立标签详情 count（存在但无公开作品）', orphanDetail.count, 0)

    // ── 2.5 后台分类列表：公开数 / 全量数分开 ──────────────────────────────
    const adminCats = Object.fromEntries((await admin.listCategories()).map((c) => [c.slug, c]))
    check('后台分类 人物 公开数', adminCats.portrait.count, 2)
    check('后台分类 人物 全量数（含待审核/下架/其他推荐）', adminCats.portrait.totalCount, 7)
    check('后台分类 动物 全量数', adminCats.animal.totalCount, 1)

    // ── 3. 与「其他推荐」的隔离 ────────────────────────────────────────────
    const general = await images.findAll({ size: 50 })
    const other = await images.getOther({ size: 50 })
    check('发现页列表 total（只含 approved+general）', general.meta.total, 4)
    check('其他推荐 total（只含 approved+other）', other.meta.total, 1)
    check(
      '发现页不混入其他推荐图片',
      general.data.some((row) => row.id === ids.F),
      false,
    )

    // ── 4. 状态流转：审核通过 ──────────────────────────────────────────────
    await prisma.image.update({ where: { id: ids.C }, data: { status: 'approved' } })
    const catsAfterApprove = Object.fromEntries((await images.getCategories()).map((c) => [c.slug, c.count]))
    const tagsAfterApprove = Object.fromEntries((await tags.list(100)).map((t) => [t.slug, t.count]))
    const portraitAfterApprove = await images.findAll({ category: 'portrait', size: 24 })
    check('通过 C 后 人物 计数', catsAfterApprove.portrait, 3)
    check('通过 C 后 人物 列表 total', portraitAfterApprove.meta.total, 3)
    check('通过 C 后 治愈 计数', tagsAfterApprove.zhiyu, 2)

    // ── 5. 状态流转：移入其他推荐 ──────────────────────────────────────────
    await prisma.image.update({ where: { id: ids.A }, data: { section: 'other' } })
    const catsAfterMove = Object.fromEntries((await images.getCategories()).map((c) => [c.slug, c.count]))
    const tagsAfterMove = Object.fromEntries((await tags.list(100)).map((t) => [t.slug, t.count]))
    const generalAfterMove = await images.findAll({ size: 50 })
    const otherAfterMove = await images.getOther({ size: 50 })
    check('A 移入其他推荐后 人物 计数', catsAfterMove.portrait, 2)
    check('A 移入其他推荐后 人物 列表 total', (await images.findAll({ category: 'portrait', size: 24 })).meta.total, 2)
    check('A 移入其他推荐后 治愈 计数', tagsAfterMove.zhiyu, 1)
    check('A 移入其他推荐后 发现页 total', generalAfterMove.meta.total, 4)
    check('A 移入其他推荐后 其他推荐 total', otherAfterMove.meta.total, 2)
  } finally {
    await prisma.$disconnect()
    cleanTemp()
  }

  console.table(rows)
  if (failures > 0) {
    console.error(`\n✗ ${failures} 项不一致`)
    process.exitCode = 1
    return
  }
  console.log(`\n✓ ${rows.length} 项检查全部通过（计数与列表口径一致）`)
}

void main()
