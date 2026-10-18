<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  if (auth.isLoggedIn && auth.isAdmin) router.replace('/admin')
  else router.replace({ name: 'login', query: { redirect: '/admin' } })
})
</script>

<template>
  <div class="grid min-h-[50vh] place-items-center">
    <div class="text-center">
      <div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent">
        <AppIcon name="lock" :size="24" />
      </div>
      <p class="font-display text-2xl text-ink">正在前往管理员入口…</p>
      <p class="mt-2 text-sm text-muted">没有权限的话会被带回登录页。</p>
    </div>
  </div>
</template>
