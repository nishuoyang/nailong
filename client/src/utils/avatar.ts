/**
 * 头像上传的前端常量与校验。
 *
 * ⚠️ 这里的数值必须与后端 `server/src/users/avatar.service.ts` 保持一致。
 * 前端校验只是为了**体验**（早点告诉用户为什么不行），
 * 真正的权威校验在后端 —— 任何人都能绕过前端直接打接口。
 */

export const AVATAR_MAX_SIZE = 2 * 1024 * 1024
export const AVATAR_MIN_EDGE = 128

export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** 传给 <input type="file" accept> 的值 */
export const AVATAR_ACCEPT = AVATAR_ACCEPTED_TYPES.join(',')

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 色块头像的色相：由用户名散列得到，同一个人每次都是同一个颜色。
 *
 * 没上传头像时显示的就是这个「首字母 + 色块」（UiAvatar 与头像上传弹窗共用），
 * 所以色相算法必须只有这一处实现，否则两处会显示成不同颜色。
 */
export function avatarHue(name?: string | null): number {
  let hash = 0
  for (const ch of name || 'nailong') hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return hash
}

/**
 * 校验选中的头像文件。
 *
 * @returns 错误文案；null 表示通过。
 *
 * 只查「类型 / 大小」——尺寸要等图片解码出来才知道，见 `readImageSize`。
 */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    return '只支持 JPEG、PNG、WebP 格式'
  }
  if (file.size > AVATAR_MAX_SIZE) {
    return `头像不能超过 ${formatBytes(AVATAR_MAX_SIZE)}`
  }
  if (file.size === 0) {
    return '这个文件是空的'
  }
  return null
}

/** 读出图片的宽高（用于「太小了」判断），失败返回 null */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
