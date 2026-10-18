<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getAdminStats } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import BrandMark from '@/components/ui/BrandMark.vue'

defineProps<{ title: string; eyebrow?: string; description?: string }>()

const route = useRoute()
const auth = useAuthStore()
const { isDark, toggleTheme } = useTheme()

const { data: stats } = useQuery({
  queryKey: ['admin-stats'],
  queryFn: () => getAdminStats().then((r) => r.data.data),
  staleTime: 30_000,
})

const nav = computed(() => [
  { to: '/admin', label: '概览', icon: 'layout', exact: true },
  { to: '/admin/images', label: '图片', icon: 'image', badge: stats.value?.pending },
  { to: '/admin/comments', label: '评论', icon: 'comment', badge: stats.value?.comments },
  { to: '/admin/bio-review', label: '简介审核', icon: 'user' },
  { to: '/admin/users', label: '用户', icon: 'users' },
  { to: '/admin/categories', label: '分类', icon: 'grid' },
  { to: '/admin/settings', label: '设置', icon: 'settings' },
])

function active(item: { to: string; exact?: boolean }) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}
</script>

<template>
  <div class="n-container max-w-[1400px] py-5 sm:py-7">
    <div class="grid gap-5 lg:grid-cols-[218px_minmax(0,1fr)] lg:items-start">
      <!-- sidebar -->
      <aside class="lg:sticky lg:top-24">
        <div class="hidden rounded-[24px] border border-line bg-surface p-3 lg:block">
          <div class="flex items-center gap-2.5 border-b border-line px-2 pb-3 pt-1">
            <span class="rotate-[-5deg]"><BrandMark :size="38" /></span>
            <div>
              <p class="font-display text-lg leading-none text-ink">管理后台</p>
              <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-muted">Control room</p>
            </div>
          </div>

          <nav class="mt-2 flex flex-col gap-0.5">
            <RouterLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] no-underline transition"
              :class="active(item) ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
            >
              <AppIcon :name="item.icon" :size="15" />
              <span class="flex-1">{{ item.label }}</span>
              <span v-if="item.badge" class="rounded-full px-1.5 py-0.5 font-mono text-[9px]" :class="active(item) ? 'bg-paper/20 text-paper' : 'bg-accent/10 text-accent'">{{ item.badge }}</span>
            </RouterLink>
          </nav>

          <div class="mt-3 border-t border-line pt-3">
            <RouterLink to="/" class="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-muted no-underline transition hover:bg-surface-2 hover:text-ink">
              <AppIcon name="arrow-left" :size="14" /> 回到前台
            </RouterLink>
          </div>
        </div>

        <!-- mobile tabs -->
        <div class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar lg:hidden">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="n-chip shrink-0 !h-8 !text-[11px]"
            :class="active(item) ? 'is-active' : ''"
          >
            <AppIcon :name="item.icon" :size="12" /> {{ item.label }}
          </RouterLink>
        </div>
      </aside>

      <!-- main -->
      <div class="min-w-0">
        <header class="mb-6 flex flex-col gap-4 rounded-[24px] border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="eyebrow mb-2">{{ eyebrow || 'Admin console' }}</p>
            <h1 class="font-display text-[32px] leading-none text-ink">{{ title }}</h1>
            <p v-if="description" class="mt-2 max-w-xl text-xs leading-relaxed text-muted">{{ description }}</p>
          </div>
          <div class="flex items-center gap-2">
            <slot name="actions" />
            <button class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" :aria-label="isDark ? '白天模式' : '夜间模式'" @click="toggleTheme">
              <AppIcon :name="isDark ? 'sun' : 'moon'" :size="16" />
            </button>
            <div class="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5">
              <UiAvatar :src="auth.user?.avatarUrl" :name="auth.user?.username" :size="28" />
              <span class="hidden text-[11px] font-medium text-ink sm:block">{{ auth.user?.username }}</span>
            </div>
          </div>
        </header>

        <slot />
      </div>
    </div>
  </div>
</template>