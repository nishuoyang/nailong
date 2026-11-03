import request from '@/utils/request'

export interface UploadResult {
  /** 本批第一张的 id（兼容旧调用方） */
  id: string
  /** 本批全部图片 id，顺序与提交顺序一致 */
  ids: string[]
  /** 一次投稿多张图时才有批次 id */
  batchId: string | null
  count: number
  message: string
}

/**
 * 提交投稿。
 *
 * `files` 字段可以重复 append 多张图——它们会作为同一个批次入库，
 * 详情页里能左右翻看，列表里只出现一张封面卡。
 */
export function uploadImage(formData: FormData, onProgress?: (percent: number) => void) {
  return request.post<{ code: number; data: UploadResult }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    },
  })
}

export interface AvatarResult {
  /** 头像 URL；恢复默认头像时为 null */
  avatarUrl: string | null
}

/**
 * 上传头像。
 *
 * 后端会校验类型/大小/尺寸，统一裁成 512×512 WebP 存 MinIO，
 * 并把新 URL 写进 User.avatarUrl（持久化）。
 */
export function uploadAvatar(formData: FormData, onProgress?: (percent: number) => void) {
  return request.post<{ code: number; data: AvatarResult }>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    },
  })
}

/** 恢复默认头像：清空 User.avatarUrl，前端回落到默认头像图 */
export function removeAvatar() {
  return request.delete<{ code: number; data: AvatarResult }>('/users/me/avatar')
}
