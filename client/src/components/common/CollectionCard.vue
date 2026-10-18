<script setup lang="ts">
import type { CollectionSummary } from '@/api/social'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'

defineProps<{ collection: CollectionSummary; showOwner?: boolean }>()
</script>

<template>
  <RouterLink
    :to="`/collections/${collection.id}`"
    class="group flex flex-col overflow-hidden rounded-[24px] border border-line bg-surface p-3 no-underline transition-all duration-300 hover:-translate-y-1 hover:border-ink/40 hover:shadow-[0_20px_45px_-26px_rgba(30,22,12,.45)]"
  >
    <div class="relative grid aspect-[16/10] grid-cols-2 gap-1 overflow-hidden rounded-[17px] bg-surface-2">
      <div v-for="n in 4" :key="n" class="overflow-hidden">
        <img
          v-if="collection.previews[n - 1]"
          :src="collection.previews[n - 1].thumbnailSmUrl || collection.previews[n - 1].thumbnailUrl || ''"
          :alt="collection.name"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div v-else class="grid h-full w-full place-items-center bg-paper-deep text-line-strong">
          <AppIcon name="image" :size="18" />
        </div>
      </div>
      <span class="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/35 px-2 py-1 font-mono text-[9px] text-white backdrop-blur-sm">
        <AppIcon :name="collection.isPublic ? 'globe' : 'lock'" :size="10" />
        {{ collection.itemCount }}
      </span>
    </div>

    <div class="flex flex-1 items-end justify-between gap-3 px-1 pb-1 pt-3">
      <div class="min-w-0">
        <p class="truncate font-display text-[21px] leading-none text-ink transition group-hover:text-accent">{{ collection.name }}</p>
        <p v-if="collection.description" class="mt-1.5 line-clamp-1 text-[11px] text-muted">{{ collection.description }}</p>
        <div v-if="showOwner && collection.user" class="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
          <UiAvatar :src="collection.user.avatarUrl" :name="collection.user.username" :size="16" />
          {{ collection.user.username }}
        </div>
      </div>
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-2 transition group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
        <AppIcon name="arrow-up-right" :size="14" />
      </span>
    </div>
  </RouterLink>
</template>
