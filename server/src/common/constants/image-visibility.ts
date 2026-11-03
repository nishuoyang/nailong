import { Prisma } from '@prisma/client'

/**
 * 「公开可见图片」的唯一判定条件。
 *
 * 发现页列表（GET /images）、每日推荐、排行榜、分类计数、标签计数都必须复用这份条件。
 * 任何一处单独写条件，都会在「后台态 / 其他推荐」两类数据上分叉，表现为
 * 「筛选条显示 3 张，点进去 0 张」——2026-11-03 线上即为此问题。
 *
 * - status：pending（待审核）/ rejected（已拒绝）/ offline（已下架）都不对外可见；
 * - section：发现页只收 general。other 属于「其他推荐」页，它的分类/标签不参与
 *   发现页的计数，否则会出现「在发现页点了某分类，看到的全是别的页面的图」；
 * - batchIndex：一次投稿多张图属于同一批次，列表/计数只认封面（batchIndex=0），
 *   否则一批 3 张会在瀑布流里出现 3 张卡。存量单图数据默认就是 0，天然满足。
 */
export const PUBLIC_IMAGE_WHERE = {
  status: 'approved',
  section: 'general',
  batchIndex: 0,
} as const satisfies Prisma.ImageWhereInput

/**
 * 给多对多中间表（ImagesOnCategories / ImageTag）用的过滤条件。
 *
 * Prisma 的 `_count.select.xxx` 支持带 where 的关系计数，但 where 作用在中间表上，
 * 因此要经由 `image` 关系下推到 Image 行本身。
 */
export const PUBLIC_IMAGE_PIVOT_WHERE = {
  image: PUBLIC_IMAGE_WHERE,
} as const
