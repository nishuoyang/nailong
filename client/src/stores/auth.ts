import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '@/utils/request'

interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  avatarUrl: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  let restorePromise: Promise<void> | null = null

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem('accessToken', access)
    localStorage.setItem('refreshToken', refresh)
  }

  function setUser(u: User) {
    user.value = u
  }

  function logout() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  // 页面刷新后恢复用户信息
  async function restoreUser() {
    if (user.value) return
    if (!accessToken.value) return

    // 避免并发重复请求
    if (restorePromise) return restorePromise

    restorePromise = (async () => {
      try {
        const res = await request.get('/users/me')
        user.value = res.data.data
      } catch {
        // token 过期，清除登录状态
        logout()
      } finally {
        restorePromise = null
      }
    })()

    return restorePromise
  }

  return { user, accessToken, refreshToken, isLoggedIn, isAdmin, setTokens, setUser, logout, restoreUser }
})
