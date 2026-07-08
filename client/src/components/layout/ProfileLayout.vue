<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

defineProps<{
  title: string
}>()
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="flex gap-8">
      <!-- Sidebar -->
      <aside class="w-56 shrink-0">
        <div class="bg-white rounded-xl shadow-sm p-6 sticky top-20">
          <!-- User info -->
          <div class="text-center mb-6 pb-6 border-b border-gray-100">
            <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl mx-auto mb-2">
              {{ authStore.user?.username?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <p class="font-medium text-gray-800">{{ authStore.user?.username }}</p>
            <el-tag v-if="authStore.isAdmin" size="small" type="danger" class="mt-1">管理员</el-tag>
            <el-tag v-else size="small" class="mt-1">用户</el-tag>
          </div>

          <!-- Menu -->
          <nav class="flex flex-col gap-1">
            <slot name="menu" />
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-bold mb-6">{{ title }}</h1>
        <slot />
      </div>
    </div>
  </div>
</template>
