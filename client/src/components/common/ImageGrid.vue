<script setup lang="ts">
import type { ImageItem } from '@/api/images'
import ImageCard from './ImageCard.vue'

withDefaults(
  defineProps<{
    images: ImageItem[]
    loading?: boolean
    skeletonCount?: number
    columns?: 'three' | 'four'
  }>(),
  { loading: false, skeletonCount: 8, columns: 'four' },
)

const emit = defineEmits<{ (e: 'favorite', value: { favorited: boolean; favoriteCount: number }): void }>()

const heights = ['16rem', '21rem', '13rem', '18rem', '24rem', '15rem', '20rem', '17rem']
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="columns-2 gap-3 md:columns-3"
      :class="columns === 'four' ? 'xl:columns-4' : ''"
    >
      <div
        v-for="i in skeletonCount"
        :key="i"
        class="mb-3 break-inside-avoid overflow-hidden rounded-[20px] border border-line bg-surface"
      >
        <div class="n-skeleton w-full" :style="{ height: heights[(i - 1) % heights.length] }" />
        <div class="space-y-2 p-3">
          <div class="n-skeleton h-3 w-3/4 rounded-full" />
          <div class="n-skeleton h-2.5 w-1/3 rounded-full" />
        </div>
      </div>
    </div>

    <slot v-else-if="images.length === 0" name="empty">
      <div class="rounded-[26px] border border-dashed border-line bg-surface/50">
        <slot name="empty-default" />
      </div>
    </slot>

    <div
      v-else
      class="columns-2 gap-3 md:columns-3"
      :class="columns === 'four' ? 'xl:columns-4' : ''"
    >
      <ImageCard
        v-for="image in images"
        :key="image.id"
        :image="image"
        @favorite="emit('favorite', $event)"
      />
    </div>
  </div>
</template>
