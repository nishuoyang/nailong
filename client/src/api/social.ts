import request from '@/utils/request'
import type { ApiList, ImageItem, TagItem } from './images'

export interface CommentItem {
  id: string
  content: string
  userId: string
  imageId: string
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null }
  isOwn?: boolean
  canDelete?: boolean
}

export function getComments(imageId: string, page = 1, size = 20) {
  return request.get<ApiList<CommentItem>>(`/images/${imageId}/comments`, { params: { page, size } })
}

export function createComment(imageId: string, content: string) {
  return request.post<{ code: number; data: CommentItem }>(`/images/${imageId}/comments`, { content })
}

export function deleteComment(id: string) {
  return request.delete<{ code: number; data: { deleted: boolean } }>(`/comments/${id}`)
}

export function toggleFavorite(imageId: string) {
  return request.post<{ code: number; data: { favorited: boolean; favoriteCount: number } }>(
    `/images/${imageId}/favorite`,
  )
}

export function getMyFavorites(page = 1, size = 20) {
  return request.get<ApiList<ImageItem>>('/users/me/favorites', { params: { page, size } })
}

export interface CollectionSummary {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  userId: string
  createdAt: string
  updatedAt: string
  itemCount: number
  previews: Array<{
    id: string
    title: string
    thumbnailUrl: string | null
    thumbnailSmUrl: string | null
    width: number | null
    height: number | null
    dominantColor: string | null
  }>
  user?: { id: string; username: string; avatarUrl: string | null }
  isOwner?: boolean
  containsImage?: boolean
}

export interface CollectionDetail extends CollectionSummary {
  items: ImageItem[]
}

export function getCollections(page = 1, size = 12) {
  return request.get<ApiList<CollectionSummary>>('/collections', { params: { page, size } })
}

export function getMyCollections(imageId?: string) {
  return request.get<{ code: number; data: CollectionSummary[] }>('/users/me/collections', {
    params: imageId ? { imageId } : undefined,
  })
}

export function getUserCollections(userId: string) {
  return request.get<{ code: number; data: CollectionSummary[] }>(`/users/${userId}/collections`)
}

export function getCollection(id: string) {
  return request.get<{ code: number; data: CollectionDetail }>(`/collections/${id}`)
}

export function createCollection(data: { name: string; description?: string; isPublic?: boolean }) {
  return request.post<{ code: number; data: CollectionSummary }>('/collections', data)
}

export function updateCollection(
  id: string,
  data: { name?: string; description?: string; isPublic?: boolean },
) {
  return request.patch<{ code: number; data: CollectionSummary }>(`/collections/${id}`, data)
}

export function deleteCollection(id: string) {
  return request.delete<{ code: number; data: { deleted: boolean } }>(`/collections/${id}`)
}

export function addImageToCollection(collectionId: string, imageId: string) {
  return request.post<{
    code: number
    data: { added: boolean; itemCount: number; isPublic: boolean }
  }>(`/collections/${collectionId}/images`, { imageId })
}

export function removeImageFromCollection(collectionId: string, imageId: string) {
  return request.delete<{ code: number; data: { removed: boolean; itemCount: number } }>(
    `/collections/${collectionId}/images/${imageId}`,
  )
}

export interface FollowUser {
  id: string
  username: string
  avatarUrl: string | null
  bio: string | null
  role: string
  createdAt: string
  isFollowing: boolean
}

export function toggleFollow(userId: string) {
  return request.post<{ code: number; data: { following: boolean; followerCount: number } }>(
    `/users/${userId}/follow`,
  )
}

export function getFollowers(userId: string, page = 1, size = 20) {
  return request.get<ApiList<FollowUser>>(`/users/${userId}/followers`, { params: { page, size } })
}

export function getFollowing(userId: string, page = 1, size = 20) {
  return request.get<ApiList<FollowUser>>(`/users/${userId}/following`, { params: { page, size } })
}

export function getFeed(page = 1, size = 20) {
  return request.get<ApiList<ImageItem>>('/feed', { params: { page, size } })
}

export function getTags(limit = 40, q?: string) {
  return request.get<{ code: number; data: TagItem[] }>('/tags', { params: { limit, q } })
}

export function getTag(slug: string) {
  return request.get<{ code: number; data: TagItem }>(`/tags/${encodeURIComponent(slug)}`)
}

export interface UserProfile {
  id: string
  username: string
  role: string
  avatarUrl: string | null
  bio: string
  bioStatus?: string | null
  createdAt: string
  imageCount: number
  followerCount: number
  followingCount: number
  totalLikes: number
  totalDownloads: number
  totalViews: number
  isFollowing: boolean
  isSelf: boolean
}

export function getUserProfile(id: string) {
  return request.get<{ code: number; data: UserProfile }>(`/users/${id}`)
}

export function getUserImages(id: string, page = 1, size = 20) {
  return request.get<ApiList<ImageItem>>(`/users/${id}/images`, { params: { page, size } })
}

export function getMyImages(page = 1, size = 20) {
  return request.get<ApiList<ImageItem>>('/users/me/images', { params: { page, size } })
}

export function updateBio(bio: string) {
  return request.patch<{
    code: number
    data: { id: string; username: string; bio: string | null; bioStatus: string }
  }>('/users/me/bio', { bio })
}