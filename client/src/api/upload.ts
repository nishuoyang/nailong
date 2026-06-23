import request from '@/utils/request'

export function uploadImage(formData: FormData) {
  return request.post<{ code: number; data: { id: string; message: string } }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
