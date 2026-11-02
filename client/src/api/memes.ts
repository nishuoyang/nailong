import request from '@/utils/request'

/**
 * 表情包（大肥鱼鱼塘）API。
 *
 * 展示页 /deepsea 原先吃前端静态数组（data/whaleMemes.ts），现在改从这里拉数据，
 * WhaleMeme 的形状保持不变，由本文件的 toWhaleMeme() 做适配。
 */

export interface MemeUploader {
  id: string
  username: string
  avatarUrl: string | null
}

export interface MemeItem {
  id: string
  /** 稳定短标识：合集条目 gif-NNN（与旧静态 id 一致），用户投喂 up-xxxx */
  code: string
  title: string
  note: string | null
  /** fish/work/break/night/cute */
  mood: string
  tags: string[]
  url: string
  status: string
  source: string
  userId: string
  createdAt: string
  uploader?: MemeUploader
}

export interface MemeListResponse {
  data: MemeItem[]
  meta: {
    total: number
    moodCounts: Record<string, number>
  }
}

/** 公开鱼塘：只返回已审核的，支持情绪筛选/搜索 */
export function getMemes(params?: { mood?: string; search?: string; size?: number }) {
  return request.get<{ code: number; data: MemeItem[]; meta: MemeListResponse['meta'] }>('/memes', {
    params,
  })
}

/** 我的投喂：含 pending/rejected，便于作者跟进审核状态 */
export function getMyMemes() {
  return request.get<{ code: number; data: MemeItem[] }>('/memes/mine')
}

export function getMemeById(id: string) {
  return request.get<{ code: number; data: MemeItem }>(`/memes/${id}`)
}

/**
 * 投喂一张表情包。限制（前端先拦一道，后端再校验）：
 * GIF/PNG/WebP、≤5MB、边长 32~4096px、每人每日 20 张；入库后待审核。
 */
export function uploadMeme(formData: FormData, onProgress?: (percent: number) => void) {
  return request.post<{ code: number; data: { id: string; code: string; message: string } }>(
    '/memes',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      },
    },
  )
}

/** 作者撤回自己的投喂 */
export function deleteMeme(id: string) {
  return request.delete<{ code: number; data: { id: string; deleted: boolean } }>(`/memes/${id}`)
}
