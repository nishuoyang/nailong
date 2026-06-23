import request from '@/utils/request'

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  user: {
    id: string
    username: string
    email: string
    role: 'user' | 'admin'
    avatarUrl: string | null
  }
  accessToken: string
  refreshToken: string
}

export function login(params: LoginParams) {
  return request.post<{ code: number; data: AuthResponse }>('/auth/login', params)
}

export function register(params: RegisterParams) {
  return request.post<{ code: number; data: AuthResponse }>('/auth/register', params)
}

export function refreshToken(token: string) {
  return request.post<{ code: number; data: { accessToken: string; refreshToken: string } }>('/auth/refresh', { refreshToken: token })
}

export function getMe() {
  return request.get('/users/me')
}
