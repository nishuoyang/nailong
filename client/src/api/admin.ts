import request from '@/utils/request'
import type { ImageItem, PaginatedResponse } from './images'

export function getAdminImages(params: {
  page?: number
  size?: number
  status?: string
}) {
  return request.get<{ code: number; data: ImageItem[]; meta: PaginatedResponse<ImageItem>['meta'] }>('/admin/images', { params })
}

export function updateImageStatus(id: string, status: string) {
  return request.patch(`/admin/images/${id}/status`, { status })
}

export function deleteImage(id: string) {
  return request.delete(`/admin/images/${id}`)
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
