<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

// 主题模式 — 从 localStorage 读取初始值避免闪烁
const isDark = ref(localStorage.getItem('theme') === 'dark')
const showThemePopover = ref(false)

onMounted(() => {
  applyTheme()
})

watch(isDark, () => {
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme()
})

function applyTheme() {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
  showThemePopover.value = false
}

function handleLogout() {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col transition-colors duration-300"
    :class="isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'"
  >
    <!-- Header -->
    <header
      class="shadow-sm border-b sticky top-0 z-50 transition-colors duration-300"
      :class="isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
    >
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <router-link to="/" class="text-2xl font-bold text-blue-600 no-underline flex items-center gap-2">
            <img src="/logo.jpeg" alt="奶龙" class="w-8 h-8 rounded-full object-cover" />
            奶龙
          </router-link>
          <nav class="hidden md:flex items-center gap-6">
            <router-link to="/featured" class="hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
              精选
            </router-link>
            <router-link to="/other" class="hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
              其他推荐
            </router-link>
            <router-link to="/" class="hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
              发现
            </router-link>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <template v-if="authStore.isLoggedIn">
            <router-link to="/upload" class="text-sm hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
              上传
            </router-link>
            <router-link to="/profile" class="text-sm hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
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
              class="text-sm bg-transparent border-none cursor-pointer transition-colors"
              :class="isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'"
            >
              退出
            </button>
          </template>
          <template v-else>
            <router-link to="/login" class="text-sm hover:text-blue-600 no-underline transition-colors"
              :class="isDark ? 'text-gray-300' : 'text-gray-600'">
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
    <footer
      class="border-t py-8 text-center text-sm transition-colors duration-300"
      :class="isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'"
    >
      <p class="flex items-center justify-center gap-2">
        <img src="/logo.jpeg" alt="奶龙" class="w-5 h-5 rounded-full object-cover inline-block" />
        奶龙 - 图片展示平台
      </p>
    </footer>

    <!-- 右下角设置浮动按钮 -->
    <div class="fixed bottom-6 right-6 z-50">
      <button
        @click="showThemePopover = !showThemePopover"
        class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all duration-300"
        :class="isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'"
      >
        ⚙️
      </button>

      <!-- 弹出面板 -->
      <Transition name="popover">
        <div
          v-if="showThemePopover"
          class="absolute bottom-14 right-0 rounded-xl shadow-xl p-4 w-48 transition-colors duration-300"
          :class="isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ isDark ? '🌙 黑夜模式' : '☀️ 白天模式' }}</span>
            <el-switch
              :model-value="isDark"
              size="small"
              @change="toggleTheme"
            />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.popover-enter-active,
.popover-leave-active {
  transition: all 0.2s ease;
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
