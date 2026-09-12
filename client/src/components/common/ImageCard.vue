<script setup lang="ts">
import { computed } from 'vue'
import type { ImageItem } from '@/api/images'

const props = defineProps<{
  image: ImageItem
}>()

// 宽高比占位（根治 CLS）：服务端在 width/height（md 缩略图像素）未知前（如刚迁移、
// 未回填的存量行）返回 null，此时退化为原先的行为（加载后自然撑开）。
const aspectRatio = computed(() => {
  const { width, height } = props.image
  return width && height ? `${width} / ${height}` : undefined
})

// srcset 两档：300px（sm）与 800px（md）。sizes 是分栏布局的近似值：
// 以列数近似（1280px 起 25vw ≈ 3/4 栏每卡 300~330px；768px 起 3 栏 30vw；
// 手机 2 栏 38vw ≈ 142~163px）。高 DPR 桌面会选 800w（比改前固定 sm 更锐利），
// 小屏高 DPR 视内容量大多选 300w —— 见 docs/性能优化记录 第二十二章的取舍说明。
const srcset = computed(() => {
  const sm = props.image.thumbnailSmUrl || props.image.thumbnailUrl || props.image.url
  const md = props.image.thumbnailUrl || props.image.url
  if (!sm || !md) return undefined
  return `${sm} 300w, ${md} 800w`
})
</script>

<template>
  <!-- Pixiv 排行榜风格瀑布流卡片：按原图比例完整展示，信息悬浮在图上 -->
  <router-link
    :to="`/images/${image.id}`"
    class="group block relative no-underline rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
  >
    <!-- 原图比例完整展示（不裁剪）：img 宽度 100%、高度自适应；
         aspect-ratio 预占位（服务端回填宽高后无 CLS），srcset 按 DPR/视口选档 -->
    <img
      :src="image.thumbnailSmUrl || image.thumbnailUrl || image.url"
      :srcset="srcset"
      sizes="(min-width: 1280px) 25vw, (min-width: 768px) 30vw, 38vw"
      :style="aspectRatio ? { aspectRatio } : undefined"
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