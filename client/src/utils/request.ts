import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截器：自动带 token
request.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`
  }
  return config
})

// 响应拦截器：401 自动刷新 token
let isRefreshing = false
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = []

request.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error
    const authStore = useAuthStore()

    if (response?.status === 401 && !config._retry && authStore.refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((token) => {
          config.headers.Authorization = `Bearer ${token}`
          return request(config)
        })
      }

      config._retry = true
      isRefreshing = true

      try {
        const res = await axios.post('/api/auth/refresh', {
          refreshToken: authStore.refreshToken,
        })
        const { accessToken, refreshToken } = res.data.data
        authStore.setTokens(accessToken, refreshToken)
        refreshQueue.forEach((p) => p.resolve(accessToken))
        refreshQueue = []
        config.headers.Authorization = `Bearer ${accessToken}`
        return request(config)
      } catch {
        authStore.logout()
        refreshQueue.forEach((p) => p.reject(new Error('refresh failed')))
        refreshQueue = []
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default request
