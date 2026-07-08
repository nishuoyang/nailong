import request from '@/utils/request'

export interface ImageItem {
  id: string
  title: string
  description: string | null
  url: string
  thumbnailUrl: string | null
  userId: string
  status: string
  likeCount: number
  downloadCount: number
  viewCount: number
  createdAt: string
  user?: {
    id: string
    username: string
    avatarUrl: string | null
  }
  categories?: Array<{ id: string; name: string; slug: string }>
  isLiked?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export function getImages(params: {
  page?: number
  size?: number
  category?: string
  search?: string
  sort?: 'latest' | 'popular' | 'downloads'
}) {
  return request.get<{ code: number; data: ImageItem[]; meta: PaginatedResponse<ImageItem>['meta'] }>('/images', { params })
}

export function getImageById(id: string) {
  return request.get<{ code: number; data: ImageItem }>(`/images/${id}`)
}

export function likeImage(id: string) {
  return request.post<{ code: number; data: { liked: boolean; likeCount: number } }>(`/images/${id}/like`)
}

export function downloadImage(id: string) {
  return request.post<{ code: number; data: { url: string; downloadCount: number } }>(`/images/${id}/download`)
}

export interface LeaderboardItem {
  id: string
  title: string
  likeCount: number
  thumbnailUrl: string | null
  url: string
  user: { id: string; username: string }
}

export function getLeaderboard() {
  return request.get<{ code: number; data: LeaderboardItem[] }>('/leaderboard')
}

export function getDailyRecommendation() {
  return request.get<{ code: number; data: LeaderboardItem | null }>('/daily')
}

export function getFeatured(params: { page?: number; size?: number }) {
  return request.get<{ code: number; data: ImageItem[]; meta: PaginatedResponse<ImageItem>['meta'] }>('/featured', { params })
}

export function getOther(params: { page?: number; size?: number }) {
  return request.get<{ code: number; data: ImageItem[]; meta: PaginatedResponse<ImageItem>['meta'] }>('/other', { params })
}

export function getCategories() {
  return request.get<{ code: number; data: Array<{ id: string; name: string; slug: string }> }>('/categories')
}
