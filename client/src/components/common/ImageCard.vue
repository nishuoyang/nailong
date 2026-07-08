<script setup lang="ts">
import type { ImageItem } from '@/api/images'

defineProps<{
  image: ImageItem
}>()
</script>

<template>
  <div class="block rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
    <router-link :to="`/images/${image.id}`" class="no-underline">
      <div class="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          :src="image.thumbnailUrl || image.url"
          :alt="image.title"
          class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div class="p-3">
        <h3 class="text-sm font-medium text-gray-800 truncate">{{ image.title }}</h3>
      </div>
    </router-link>
    <div class="px-3 pb-3 flex items-center justify-between text-xs text-gray-400">
      <router-link
        :to="`/users/${image.userId}`"
        class="text-gray-500 hover:text-blue-600 no-underline transition-colors"
        @click.stop
      >
        {{ image.user?.username }}
      </router-link>
      <div class="flex items-center gap-3">
        <span>❤️ {{ image.likeCount }}</span>
        <span>⬇ {{ image.downloadCount }}</span>
      </div>
    </div>
  </div>
</template>
