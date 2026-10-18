<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { useCommandPalette } from '@/composables/useCommandPalette'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import BrandMark from '@/components/ui/BrandMark.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isDark, toggleTheme } = useTheme()
const { open: openPalette } = useCommandPalette()

const mobileOpen = ref(false)
const userOpen = ref(false)

const nav = [
  { to: '/', label: '发现', exact: true },
  { to: '/featured', label: '精选' },
  { to: '/collections', label: '收藏夹' },
  { to: '/studio', label: '工坊', spark: true },
  { to: '/story', label: '奶蛙史' },
]


watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
    userOpen.value = false
  },
)

watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function go(path: string) {
  mobileOpen.value = false
  userOpen.value = false
  router.push(path)
}

function logout() {
  authStore.logout()
  userOpen.value = false
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 px-3 pt-3 sm:px-5">
    <div class="n-container !px-0">
      <div class="flex h-16 items-center gap-2 rounded-full border border-line/80 bg-surface/88 px-2.5 shadow-[0_10px_30px_-18px_rgba(38,28,16,.35)] backdrop-blur-xl sm:px-3">
        <!-- Brand -->
        <RouterLink to="/" class="group flex shrink-0 items-center gap-2.5 rounded-full pl-1 pr-2 no-underline" aria-label="奶龙宇宙 首页">
          <span class="relative rotate-[-5deg] transition-transform duration-300 group-hover:rotate-[3deg]">
            <BrandMark :size="42" />
            <span class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-ink bg-accent" />
          </span>
          <span class="hidden leading-none min-[380px]:block">
            <span class="block font-display text-[21px] tracking-tight text-ink">奶龙宇宙</span>
            <span class="mt-1 block font-mono text-[8px] uppercase tracking-[0.26em] text-muted">Nailong Archive</span>
          </span>
        </RouterLink>

        <!-- Desktop nav -->
        <nav class="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="主导航">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            v-slot="{ href, navigate, isActive, isExactActive }"
            :to="item.to"
            custom
          >
            <a
              :href="href"
              class="relative rounded-full px-3.5 py-2 text-[13px] font-medium no-underline transition-colors"
              :class="
                (item.exact ? isExactActive : isActive)
                  ? 'bg-ink text-paper'
                  : 'text-ink-2 hover:bg-ink/[0.06] hover:text-ink'
              "
              @click="navigate"
            >
              <span class="flex items-center gap-1.5">
                <AppIcon v-if="item.spark" name="sparkles" :size="12" />
                {{ item.label }}
              </span>
            </a>
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <!-- Search trigger -->
          <button
            class="hidden h-9 items-center gap-2 rounded-full border border-line/80 bg-paper/50 px-3 text-xs text-muted transition-all hover:border-ink hover:text-ink md:flex"
            aria-label="搜索（Ctrl K）"
            @click="openPalette()"
          >
            <AppIcon name="search" :size="14" />
            <span>搜索</span>
            <kbd class="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] text-muted">⌘K</kbd>
          </button>
          <button
            class="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-ink/[0.06] hover:text-ink md:hidden"
            aria-label="搜索"
            @click="openPalette()"
          >
            <AppIcon name="search" :size="18" />
          </button>

          <!-- Theme -->
          <button
            class="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-ink/[0.06] hover:text-ink"
            :aria-label="isDark ? '切换到白天模式' : '切换到夜间模式'"
            @click="toggleTheme"
          >
            <Transition name="theme-icon" mode="out-in">
              <AppIcon :key="isDark ? 'sun' : 'moon'" :name="isDark ? 'sun' : 'moon'" :size="17" />
            </Transition>
          </button>

          <!-- Upload -->
          <RouterLink
            v-if="authStore.isLoggedIn"
            to="/upload"
            class="n-btn n-btn-primary n-btn-sm ml-1 hidden sm:inline-flex"
          >
            <AppIcon name="plus" :size="14" />
            投稿
          </RouterLink>

          <!-- Logged in -->
          <div v-if="authStore.isLoggedIn" class="relative ml-0.5 hidden sm:block">
            <button
              class="flex items-center gap-1.5 rounded-full p-0.5 pr-1 transition hover:bg-ink/[0.05]"
              :aria-expanded="userOpen"
              aria-label="账户菜单"
              @click="userOpen = !userOpen"
            >
              <UiAvatar :src="authStore.user?.avatarUrl" :name="authStore.user?.username" :size="34" />
              <AppIcon name="chevron-down" :size="13" class="text-muted transition" :class="{ 'rotate-180': userOpen }" />
            </button>

            <div v-if="userOpen" class="fixed inset-0 z-40" @click="userOpen = false" />
            <Transition name="menu">
              <div
                v-if="userOpen"
                class="absolute right-0 top-[calc(100%+14px)] z-50 w-60 overflow-hidden rounded-[22px] border border-line bg-surface p-2 shadow-[0_24px_60px_-24px_rgba(30,22,12,.45)]"
              >
                <div class="flex items-center gap-3 border-b border-line px-3 py-3">
                  <UiAvatar :src="authStore.user?.avatarUrl" :name="authStore.user?.username" :size="40" />
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold">{{ authStore.user?.username }}</p>
                    <p class="truncate font-mono text-[10px] text-muted">{{ authStore.user?.email }}</p>
                  </div>
                </div>
                <div class="mt-1 flex flex-col">
                  <button class="menu-item" @click="go('/profile')"><AppIcon name="user" :size="15" />个人主页</button>
                  <button class="menu-item" @click="go('/collections')"><AppIcon name="folder" :size="15" />收藏夹</button>
                  <button class="menu-item" @click="go('/feed')"><AppIcon name="users" :size="15" />关注动态</button>
                  <button v-if="authStore.isAdmin" class="menu-item" @click="go('/admin')">
                    <AppIcon name="layout" :size="15" />管理后台
                  </button>
                  <div class="my-1 h-px bg-line" />
                  <button class="menu-item text-accent" @click="logout"><AppIcon name="logout" :size="15" />退出登录</button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Guest -->
          <div v-else class="hidden items-center gap-1 sm:flex">
            <RouterLink to="/login" class="n-btn n-btn-ghost n-btn-sm no-underline">登录</RouterLink>
            <RouterLink to="/register" class="n-btn n-btn-outline n-btn-sm no-underline">加入</RouterLink>
          </div>

          <!-- Mobile menu toggle -->
          <button
            class="relative ml-0.5 grid h-10 w-10 place-items-center rounded-full border border-line lg:hidden"
            :aria-expanded="mobileOpen"
            aria-label="打开菜单"
            @click="mobileOpen = !mobileOpen"
          >
            <span class="relative block h-3.5 w-[18px]">
              <span
                class="absolute left-0 h-[1.6px] w-full rounded-full bg-ink transition-all duration-300"
                :class="mobileOpen ? 'top-1.5 rotate-45' : 'top-0'"
              />
              <span
                class="absolute left-0 top-1.5 h-[1.6px] w-full rounded-full bg-ink transition-all duration-300"
                :class="mobileOpen ? 'opacity-0' : 'opacity-100'"
              />
              <span
                class="absolute left-0 h-[1.6px] w-full rounded-full bg-ink transition-all duration-300"
                :class="mobileOpen ? 'top-1.5 -rotate-45' : 'top-3'"
              />
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="mobileOpen" class="fixed inset-0 z-[80] lg:hidden">
          <div class="absolute inset-0 bg-[#15110b]/45 backdrop-blur-sm" @click="mobileOpen = false" />
          <div class="absolute inset-x-3 top-3 overflow-hidden rounded-[30px] border border-ink bg-paper shadow-[0_30px_80px_-20px_rgba(20,15,8,.6)]">
            <div class="flex items-center justify-between px-5 pb-3 pt-5">
              <span class="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Navigate the universe</span>
              <button class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink" aria-label="关闭菜单" @click="mobileOpen = false">
                <AppIcon name="close" :size="17" />
              </button>
            </div>
            <nav class="px-3 pb-3">
              <button
                v-for="(item, index) in nav"
                :key="item.to"
                class="group flex w-full items-center justify-between border-b border-line/70 px-3 py-3.5 text-left transition"
                :style="{ transitionDelay: index * 35 + 'ms' }"
                @click="go(item.to)"
              >
                <span class="flex items-baseline gap-3">
                  <span class="font-mono text-[10px] text-muted">0{{ index + 1 }}</span>
                  <span class="font-display text-[30px] leading-none text-ink">{{ item.label }}</span>
                </span>
                <span class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                  <AppIcon name="arrow-up-right" :size="15" />
                </span>
              </button>
            </nav>
            <div class="flex items-center gap-2 px-5 pb-6 pt-2">
              <template v-if="authStore.isLoggedIn">
                <button class="n-btn n-btn-primary flex-1" @click="go('/upload')"><AppIcon name="upload" :size="15" />投稿</button>
                <button class="n-btn n-btn-outline flex-1" @click="go('/profile')">个人主页</button>
              </template>
              <template v-else>
                <button class="n-btn n-btn-primary flex-1" @click="go('/register')">加入奶龙宇宙</button>
                <button class="n-btn n-btn-outline" @click="go('/login')">登录</button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--ink-2);
  text-align: left;
  transition: background 0.18s ease, color 0.18s ease;
}
.menu-item:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: transform 0.25s var(--ease-spring), opacity 0.2s ease;
}
.theme-icon-enter-from {
  transform: rotate(-35deg) scale(0.6);
  opacity: 0;
}
.theme-icon-leave-to {
  transform: rotate(35deg) scale(0.6);
  opacity: 0;
}
.menu-enter-active,
.menu-leave-active {
  transition: all 0.24s var(--ease-out-expo);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.3s var(--ease-out-expo);
}
.sheet-enter-active > div:last-child,
.sheet-leave-active > div:last-child {
  transition: transform 0.4s var(--ease-out-expo);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(-16px) scale(0.98);
}
</style>