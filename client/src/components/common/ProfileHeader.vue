<script setup lang="ts">
import { computed } from 'vue'
import { formatCount, formatDate } from '@/utils/format'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    name?: string
    avatarUrl?: string | null
    bio?: string
    role?: string
    joinedAt?: string
    works?: number
    followers?: number
    following?: number
    likes?: number
    bioPending?: boolean
  }>(),
  { works: 0, followers: 0, following: 0, likes: 0 },
)

const initial = computed(() => (props.name || '?').charAt(0).toUpperCase())
</script>

<template>
  <header class="relative overflow-hidden border-b border-line">
    <div class="pointer-events-none absolute inset-0 dot-field opacity-25" />
    <div class="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none font-display text-[210px] leading-none text-ink/[0.04] sm:text-[280px]">
      {{ initial }}
    </div>

    <div class="n-container relative py-10 sm:py-14">
      <div class="flex flex-col gap-7 md:flex-row md:items-start">
        <div class="relative shrink-0">
          <UiAvatar :src="avatarUrl" :name="name" :size="96" class="border-[1.5px] border-ink shadow-[4px_4px_0_0_var(--ink)]" />
          <span v-if="role === 'admin'" class="absolute -bottom-2 -right-2 inline-flex items-center gap-1 rounded-full border border-ink bg-butter px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide text-[#181510]">
            <AppIcon name="crown" :size="9" /> Admin
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <p class="eyebrow mb-2 flex flex-wrap items-center gap-2">
            <span>{{ joinedAt ? `Member since ${formatDate(joinedAt)}` : 'Member' }}</span>
            <span class="h-1 w-1 rounded-full bg-accent" />
            <span>Nailong Universe</span>
          </p>
          <h1 class="display break-words text-[42px] leading-[0.95] text-ink sm:text-[56px]">{{ name }}</h1>
          <p class="mt-3 max-w-xl whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-2">
            {{ bio || '这个人很懒，什么也没留下。' }}
          </p>
          <p v-if="bioPending" class="mt-2 inline-flex items-center gap-1 rounded-full bg-butter/30 px-2.5 py-1 text-[10px] text-ink">
            <AppIcon name="clock" :size="10" /> 简介正在审核中
          </p>
          <slot name="under-bio" />

          <div class="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
            <div v-for="stat in [
              { label: '作品', value: works },
              { label: '粉丝', value: followers },
              { label: '关注', value: following },
              { label: '获赞', value: likes },
            ]" :key="stat.label" class="flex items-baseline gap-1.5">
              <span class="font-display text-[24px] leading-none tabular text-ink">{{ formatCount(stat.value) }}</span>
              <span class="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{{ stat.label }}</span>
            </div>
          </div>
        </div>

        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </header>
</template>