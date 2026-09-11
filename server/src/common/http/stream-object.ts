import type { Request, Response } from 'express'
import type { MinioService } from '../../minio/minio.service'

/**
 * 扩展名 → MIME。
 *
 * 上传产物命名是受控的（`{base}_thumb_sm.webp` / `{base}_thumb_md.webp` / `{base}.{jpg|png|webp}`），
 * 所以绝大多数请求靠扩展名就能定 Content-Type，不必为了拿一个 Content-Type 先向 MinIO 发 HEAD。
 * 这是图片链路从「HEAD + GET」两次往返降到一次的关键。
 */
export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
}

export interface StreamObjectOptions {
  bucket: string
  objectName: string
  /**
   * 已知的 Content-Type。传了就不会为它发 HEAD；
   * 不传则先按扩展名推断，扩展名不认识时才 HEAD 一次。
   */
  contentType?: string
  /** 默认 `public, max-age=31536000, immutable`（对象名含随机串，内容永不覆盖） */
  cacheControl?: string
  /** 传了则设置 Content-Disposition（下载接口用） */
  contentDisposition?: string
}

/**
 * 从 MinIO 流式返回一个对象，并处理 Range 请求。
 *
 * 抽出来的原因：这段逻辑原本只在 main.ts 的 `/minio` 代理里有，
 * 而 `GET /api/images/:id/file`（下载接口）自己 `pipe` 一遍、既不支持 Range 也没有
 * `Accept-Ranges`，导致大图无法断点续传、客户端也不认为可以续传。两处共用一份实现。
 *
 * 失败时（对象不存在 / MinIO 不可用）会向上抛错，由调用方决定返回 404、重定向还是 500。
 */
export async function streamObjectFromMinio(
  req: Request,
  res: Response,
  minio: MinioService,
  opts: StreamObjectOptions,
): Promise<void> {
  const ext = opts.objectName.split('.').pop()?.toLowerCase() ?? ''
  let contentType: string | undefined = opts.contentType ?? MIME_BY_EXT[ext]

  const rangeHeader = req.headers.range
  let offset: number | undefined
  let length: number | undefined
  let totalSize: number | undefined

  // 只有两种情况仍需 HEAD：扩展名不认识（拿真实 Content-Type）或带 Range（要总长度算 Content-Range）。
  // 普通 <img> 不会带 Range，所以常规图片请求不付这个成本。
  if (!contentType || rangeHeader) {
    try {
      const stat = await minio.statObject(opts.bucket, opts.objectName)
      contentType ??= (stat.metaData?.['content-type'] as string) || undefined
      totalSize = stat.size
    } catch {
      // 忽略：Content-Type 走兜底，Range 视为不生效（下面按整体返回 200）。
      // 对象真的不存在时，下面的取流会抛错。
    }
  }
  contentType ??= 'application/octet-stream'

  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', opts.cacheControl ?? 'public, max-age=31536000, immutable')
  // 即使本次不是 Range 请求也要声明，否则客户端不知道可以发起续传
  res.setHeader('Accept-Ranges', 'bytes')
  if (opts.contentDisposition) res.setHeader('Content-Disposition', opts.contentDisposition)

  if (rangeHeader && totalSize !== undefined) {
    // 只支持单区间的 `bytes=a-b` / `bytes=a-` / `bytes=-n` 三种形式。
    // 多区间（bytes=0-9,20-29）按整体返回 200 —— 这也是允许的降级行为，不是错误。
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start: number
      let end: number
      if (m[1] === '') {
        // bytes=-N：最后 N 字节
        const suffix = parseInt(m[2], 10)
        start = Math.max(0, totalSize - suffix)
        end = totalSize - 1
      } else {
        start = parseInt(m[1], 10)
        end = m[2] === '' ? totalSize - 1 : Math.min(parseInt(m[2], 10), totalSize - 1)
      }

      if (start > end || start >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`)
        res.end()
        return
      }

      offset = start
      length = end - start + 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
      res.setHeader('Content-Length', String(length))
    }
  }

  const stream = await minio.getObjectFromBucket(opts.bucket, opts.objectName, offset, length)
  stream.pipe(res)
}

/**
 * 从数据库里存的图片 URL 解析出 bucket 与对象名。
 *
 * 需要兼容三种历史形态：
 *   - `/minio/nailong-images/xxx.jpg`                （生产当前形态）
 *   - `http://localhost:9000/nailong-images/xxx.jpg` （早期 MINIO_PUBLIC_URL 缺失时写入的绝对地址）
 *   - `xxx.jpg`                                     （理论上不该出现，兜底按 defaultBucket 处理）
 */
export function parseObjectRef(url: string, defaultBucket: string): { bucket: string; objectName: string } {
  const path = url.replace(/^https?:\/\/[^/]+/i, '')
  const segments = path.split('/').filter(Boolean)

  // 形如 /minio/{bucket}/{object}
  if (segments[0] === 'minio' && segments.length >= 3) {
    return { bucket: segments[1], objectName: segments.slice(2).join('/') }
  }
  // 形如 /{bucket}/{object}（含 http://host:9000/{bucket}/{object} 已剥掉协议+主机的情况）
  if (segments.length >= 2) {
    return { bucket: segments[0], objectName: segments.slice(1).join('/') }
  }
  return { bucket: defaultBucket, objectName: segments[0] ?? url }
}
