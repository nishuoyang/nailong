import type { PrismaService } from '../../prisma/prisma.service'

export interface BatchRef {
  id: string
  batchId: string | null
}

/**
 * 互动数据（点赞 / 评论 / 收藏 / 下载 / 浏览）的归属图。
 *
 * 一次投稿是一个整体，整组共用一套互动数据，所以这些数据统一记在**封面**
 * （batchIndex = 0）那一行上：Like / Favorite / Comment 的 imageId、以及
 * Image 上的 likeCount / commentCount / favoriteCount / downloadCount / viewCount
 * 都只维护封面。单图投稿没有 batchId，归属图就是自己。
 *
 * 为什么不给 Like/Favorite/Comment 加 batchId 维度：那要改三张表的主键与唯一约束
 * （SQLite 只能重建表），而封面这一行本来就是批次里稳定存在的锚点——
 * 整批删除时级联清理也照旧生效。
 */
export async function engagementTargetId(
  prisma: PrismaService,
  image: BatchRef,
): Promise<string> {
  if (!image.batchId) return image.id

  const cover = await prisma.image.findFirst({
    where: { batchId: image.batchId },
    orderBy: [{ batchIndex: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  return cover?.id ?? image.id
}

/** 只知道 id 时的便捷版本：查不到图返回 null，由调用方决定怎么报错。 */
export async function resolveEngagementTargetId(
  prisma: PrismaService,
  imageId: string,
): Promise<{ targetId: string; status: string } | null> {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, batchId: true, status: true },
  })
  if (!image) return null
  return { targetId: await engagementTargetId(prisma, image), status: image.status }
}
