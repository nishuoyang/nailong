<script setup lang="ts">
import type { ImageItem } from '@/api/images'

defineProps<{
  image: ImageItem
}>()
</script>

<template>
  <!-- Pixiv 排行榜风格瀑布流卡片：按原图比例完整展示，信息悬浮在图上 -->
  <router-link
    :to="`/images/${image.id}`"
    class="group block relative no-underline rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
  >
    <!-- 原图比例完整展示（不裁剪）：img 宽度 100%、高度自适应 -->
    <img
      :src="image.thumbnailSmUrl || image.thumbnailUrl || image.url"
      :alt="image.title"
      class="w-full h-auto block transition-opacity duration-300 group-hover:opacity-90"
      loading="lazy"
    />

    <!-- 底部信息条（常驻：作者名 + 点赞/下载） -->
    <div class="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-8 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300">
      <div class="flex items-center justify-between gap-2 text-xs text-white">
        <router-link
          :to="`/users/${image.userId}`"
          class="text-white/90 hover:text-white no-underline truncate transition-colors"
          @click.stop
        >
          {{ image.user?.username || '匿名' }}
        </router-link>
        <div class="flex items-center gap-2.5 shrink-0">
          <span>❤️ {{ image.likeCount }}</span>
          <span>⬇ {{ image.downloadCount }}</span>
        </div>
      </div>
    </div>

    <!-- 标题（hover 时从底部滑出） -->
    <div class="absolute inset-x-0 bottom-0 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <div class="mx-2 mb-2 px-2 py-1 rounded-md bg-black/75 backdrop-blur-sm">
        <p class="text-xs text-white truncate">{{ image.title }}</p>
      </div>
    </div>
  </router-link>
</template>
