import request from '@/utils/request'

export interface TagItem {
  id: string
  name: string
  slug: string
  count?: number
}

export interface ImageItem {
  id: string
  title: string
  description: string | null
  url: string
  thumbnailUrl: string | null
  thumbnailSmUrl?: string | null
  /** Display size of the 800px thumbnail. Used for aspect-ratio placeholders. */
  width?: number | null
  height?: number | null
  /** Tiny data-URI used as a blur-up placeholder while the image loads. */
  blurDataUrl?: string | null
  dominantColor?: string | null
  userId: string
  status: string
  section?: string
  isFeatured?: boolean
  likeCount: number
  downloadCount: number
  viewCount: number
  commentCount?: number
  favoriteCount?: number
  createdAt: string
  user?: {
    id: string
    username: string
    avatarUrl: string | null
  }
  categories?: Array<{ id: string; name: string; slug: string }>
  tags?: TagItem[]
  isLiked?: boolean
  isFavorited?: boolean
  favoritedAt?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    size: number
    total: number
    totalPages: number
    followingCount?: number
  }
}

export interface ImageQuery {
  page?: number
  size?: number
  category?: string
  tag?: string
  userId?: string
  search?: string
  sort?: 'latest' | 'popular' | 'downloads' | 'views'
  range?: 'week' | 'month' | 'all'
}

export interface ApiList<T> {
  code: number
  message: string
  data: T[]
  meta: PaginatedResponse<T>['meta']
}

export function getImages(params: ImageQuery) {
  return request.get<ApiList<ImageItem>>('/images', { params })
}

export function getImageById(id: string) {
  return request.get<{ code: number; data: ImageItem }>(`/images/${id}`)
}

export function getRelatedImages(id: string) {
  return request.get<{ code: number; data: ImageItem[] }>(`/images/${id}/related`)
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
  viewCount?: number
  commentCount?: number
  thumbnailUrl: string | null
  thumbnailSmUrl?: string | null
  blurDataUrl?: string | null
  dominantColor?: string | null
  width?: number | null
  height?: number | null
  url: string
  user: { id: string; username: string; avatarUrl?: string | null }
}

export function getLeaderboard(range: 'week' | 'month' | 'all' = 'week') {
  return request.get<{ code: number; data: LeaderboardItem[] }>('/leaderboard', { params: { range } })
}

export function getDailyRecommendation() {
  return request.get<{ code: number; data: LeaderboardItem | null }>('/daily')
}

export function getFeatured(params: { page?: number; size?: number }) {
  return request.get<ApiList<ImageItem>>('/featured', { params })
}

export function getOther(params: { page?: number; size?: number }) {
  return request.get<ApiList<ImageItem>>('/other', { params })
}

export interface CategoryItem {
  id: string
  name: string
  slug: string
  description?: string | null
  count?: number
}

export function getCategories() {
  return request.get<{ code: number; data: CategoryItem[] }>('/categories')
}

export interface SiteStats {
  images: number
  users: number
  comments: number
  collections: number
  likes: number
  downloads: number
  views: number
  todayUploads: number
}

export function getStats() {
  return request.get<{ code: number; data: SiteStats }>('/stats')
}
