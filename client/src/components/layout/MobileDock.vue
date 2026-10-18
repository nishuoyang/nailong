<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/ui/AppIcon.vue'

const route = useRoute()
const authStore = useAuthStore()

const items = computed(() => [
  { to: '/', label: '发现', icon: 'compass', exact: true },
  { to: '/featured', label: '精选', icon: 'star' },
  { to: '/studio', label: '工坊', icon: 'sparkles', center: true },
  { to: '/collections', label: '收藏', icon: 'bookmark' },
  { to: authStore.isLoggedIn ? '/profile' : '/login', label: authStore.isLoggedIn ? '我的' : '登录', icon: 'user' },
])

function active(item: { to: string; exact?: boolean }) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:hidden" aria-label="快捷导航">
    <div class="relative mx-auto flex max-w-md items-end justify-around rounded-[24px] border border-ink/15 bg-surface/95 px-2 py-2 shadow-[0_18px_45px_-18px_rgba(25,18,10,.5)] backdrop-blur-xl">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-1 text-[10px] no-underline transition"
        :class="
          item.center
            ? '-mt-7'
            : active(item)
              ? 'text-accent'
              : 'text-muted hover:text-ink'
        "
      >
        <span
          v-if="item.center"
          class="grid h-12 w-12 place-items-center rounded-[18px] border-[1.5px] border-ink bg-butter text-[#181510] shadow-[3px_3px_0_0_var(--ink)] transition hover:rotate-[-4deg]"
        >
          <AppIcon :name="item.icon" :size="21" />
        </span>
        <span v-else class="grid h-7 w-7 place-items-center">
          <AppIcon :name="item.icon" :size="19" :stroke-width="active(item) ? 2 : 1.6" />
        </span>
        <span class="truncate font-medium">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>