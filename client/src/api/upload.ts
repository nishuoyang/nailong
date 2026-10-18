import request from '@/utils/request'

export function uploadImage(formData: FormData, onProgress?: (percent: number) => void) {
  return request.post<{ code: number; data: { id: string; message: string } }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    },
  })
}
