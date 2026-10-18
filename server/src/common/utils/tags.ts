import type { PrismaClient } from '@prisma/client'
import { normalizeTagName, parseTagNames, tagSlug } from './text'

/**
 * Resolve a list of display tag names to Tag rows, creating missing ones.
 *
 * Two tags may normalize to the same slug ("C++" and "C#"), so the slug gets a
 * numeric suffix instead of failing the whole upload on a unique constraint.
 */
export async function ensureTags(prisma: PrismaClient, rawNames: unknown, limit = 6) {
  const names = parseTagNames(rawNames, limit)
  if (names.length === 0) return []

  const slugs = names.map((name) => tagSlug(name)).filter(Boolean)
  const existing = await prisma.tag.findMany({
    where: { OR: [{ name: { in: names } }, { slug: { in: slugs } }] },
  })

  const byName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag]))
  const usedSlugs = new Set(existing.map((tag) => tag.slug))
  const result = [...existing]

  for (const name of names) {
    if (byName.has(name.toLowerCase())) continue
    let slug = tagSlug(name) || 'tag'
    let candidate = slug
    let suffix = 2
    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${suffix++}`
    }
    try {
      const created = await prisma.tag.create({ data: { name, slug: candidate } })
      usedSlugs.add(created.slug)
      byName.set(created.name.toLowerCase(), created)
      result.push(created)
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err
      const found = await prisma.tag.findFirst({
        where: { OR: [{ name }, { slug: candidate }] },
      })
      if (found) {
        usedSlugs.add(found.slug)
        byName.set(found.name.toLowerCase(), found)
        result.push(found)
      }
    }
  }

  return names
    .map((name) => result.find((tag) => tag.name.toLowerCase() === name.toLowerCase()))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
}

/** Replace the tag set of an image, leaving other relations untouched. */
export async function replaceImageTags(prisma: PrismaClient, imageId: string, rawNames: unknown) {
  const tags = await ensureTags(prisma, rawNames)
  await prisma.$transaction([
    prisma.imageTag.deleteMany({ where: { imageId } }),
    ...(tags.length
      ? [prisma.imageTag.createMany({ data: tags.map((tag) => ({ imageId, tagId: tag.id })) })]
      : []),
  ])
  return tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
}
