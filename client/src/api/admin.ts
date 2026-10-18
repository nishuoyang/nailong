import request from '@/utils/request'
import type { ImageItem, PaginatedResponse, TagItem } from './images'

export interface AdminStats {
  pending: number
  approved: number
  rejected: number
  offline: number
  users: number
  comments: number
  collections: number
  favorites: number
  todayUploads: number
  likes: number
  views: number
  downloads: number
}

export interface AdminComment {
  id: string
  content: string
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null }
  image: { id: string; title: string; thumbnailSmUrl: string | null; thumbnailUrl: string | null }
}

export function getAdminStats() {
  return request.get<{ code: number; data: AdminStats }>('/admin/stats')
}

export function getAdminImages(params: {
  page?: number
  size?: number
  status?: string
  search?: string
}) {
  return request.get<{ code: number; data: ImageItem[]; meta: PaginatedResponse<ImageItem>['meta'] }>(
    '/admin/images',
    { params },
  )
}

export function updateImageStatus(id: string, status: string) {
  return request.patch(`/admin/images/${id}/status`, { status })
}

export function toggleFeatured(id: string) {
  return request.patch(`/admin/images/${id}/featured`)
}

export function updateImage(
  id: string,
  data: {
    title?: string
    description?: string
    categoryIds?: string[]
    tagNames?: string[]
    section?: string
  },
) {
  return request.patch(`/admin/images/${id}`, data)
}

export function deleteImage(id: string) {
  return request.delete(`/admin/images/${id}`)
}

export function getAdminComments(params: { page?: number; size?: number; search?: string }) {
  return request.get<{
    code: number
    data: AdminComment[]
    meta: PaginatedResponse<AdminComment>['meta']
  }>('/admin/comments', { params })
}

export function deleteAdminComment(id: string) {
  return request.delete(`/admin/comments/${id}`)
}

export function createCategory(data: { name: string; slug: string; description?: string }) {
  return request.post('/admin/categories', data)
}

export function updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
  return request.put(`/admin/categories/${id}`, data)
}

export function deleteCategory(id: string) {
  return request.delete(`/admin/categories/${id}`)
}

export type { TagItem }