<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

function handleLogout() {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/" class="text-2xl font-bold text-blue-600 no-underline flex items-center gap-2">
            <img src="/logo.jpeg" alt="奶龙" class="w-8 h-8 rounded-full object-cover" />
            奶龙
          </router-link>
          <nav class="hidden md:flex items-center gap-6">
            <router-link to="/featured" class="text-gray-600 hover:text-blue-600 no-underline transition-colors">
              精选
            </router-link>
            <router-link to="/" class="text-gray-600 hover:text-blue-600 no-underline transition-colors">
              发现
            </router-link>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <template v-if="authStore.isLoggedIn">
            <router-link to="/upload" class="text-sm text-gray-600 hover:text-blue-600 no-underline">
              上传
            </router-link>
            <router-link to="/profile" class="text-sm text-gray-600 hover:text-blue-600 no-underline">
              {{ authStore.user?.username }}
            </router-link>
            <router-link
              v-if="authStore.isAdmin"
              to="/admin"
              class="text-sm text-orange-600 hover:text-orange-700 no-underline font-medium"
            >
              管理
            </router-link>
            <button
              @click="handleLogout"
              class="text-sm text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
            >
              退出
            </button>
          </template>
          <template v-else>
            <router-link to="/login" class="text-sm text-gray-600 hover:text-blue-600 no-underline">
              登录
            </router-link>
            <router-link
              to="/register"
              class="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 no-underline transition-colors"
            >
              注册
            </router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 py-8 text-center text-sm text-gray-400">
      <p class="flex items-center justify-center gap-2">
        <img src="/logo.jpeg" alt="奶龙" class="w-5 h-5 rounded-full object-cover inline-block" />
        奶龙 - 图片展示平台
      </p>
    </footer>
  </div>
</template>
