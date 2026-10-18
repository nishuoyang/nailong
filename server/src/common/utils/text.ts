/**
 * Text helpers shared by community endpoints.
 *
 * All user-generated copy is stored as plain text: tags are stripped here, and the
 * client renders it as text (never v-html), so a stored payload cannot become markup.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

export function cleanText(input: unknown, maxLength: number): string {
  const raw = typeof input === 'string' ? input : ''
  return stripHtml(raw)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

/**
 * Tag names keep their original script (Chinese tags stay readable in the URL) but
 * collapse whitespace and strip leading #. Slugs are lower-cased and use hyphens.
 */
export function normalizeTagName(input: unknown): string {
  if (typeof input !== 'string') return ''
  return stripHtml(input)
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
}

export function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseTagNames(raw: unknown, limit = 6): string[] {
  let values: unknown[] = []
  if (Array.isArray(raw)) values = raw
  else if (typeof raw === 'string') values = raw.split(/[,，\n]/)
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const name = normalizeTagName(value)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
    if (result.length >= limit) break
  }
  return result
}
