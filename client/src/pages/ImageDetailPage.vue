<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getImageById, likeImage, downloadImage } from '@/api/images'
import { useAuthStore } from '@/stores/auth'
// ElMessage 由 unplugin-auto-import 按需注入（见 vite.config.ts），勿手动从 'element-plus' 引入

const route = useRoute()
const authStore = useAuthStore()
const queryClient = useQueryClient()

// 必须用 computed：/images/A → /images/B 会复用同一组件实例（router-view 没有 :key）。
// 注意 setQueryData 不会像 useQuery 那样自动解包 ref，必须传 imageId.value，
// 否则 queryKey 会变成 ['image', ComputedRef]，与缓存里的真实键不匹配。
const imageId = computed(() => route.params.id as string)

const { data: image, isLoading, isError } = useQuery({
  queryKey: ['image', imageId],
  queryFn: () => getImageById(imageId.value).then((r) => r.data.data),
})

const likeMutation = useMutation({
  mutationFn: () => likeImage(imageId.value),
  onSuccess: (res) => {
    queryClient.setQueryData(['image', imageId.value], (old: any) => {
      if (!old) return old
      return {
        ...old,
        isLiked: res.data.data.liked,
        likeCount: res.data.data.likeCount,
      }
    })
    ElMessage.success(res.data.data.liked ? '已点赞' : '已取消点赞')
  },
})

const downloadMutation = useMutation({
  mutationFn: () => downloadImage(imageId.value),
  onSuccess: (res) => {
    queryClient.setQueryData(['image', imageId.value], (old: any) => {
      if (!old) return old
      return { ...old, downloadCount: res.data.data.downloadCount }
    })
    // 通过服务端代理下载，使用 <a> 标签触发浏览器另存为
    const a = document.createElement('a')
    a.href = `/api/images/${imageId.value}/file`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    ElMessage.success('下载开始')
  },
})

function handleLike() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  likeMutation.mutate()
}

function handleDownload() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  downloadMutation.mutate()
}
</script>

<template>
  <div v-if="isLoading" class="text-center py-20">
    <p class="text-gray-400">加载中...</p>
  </div>

  <div v-else-if="isError" class="text-center py-20">
    <p class="text-gray-400">加载失败，请刷新重试</p>
  </div>

  <div v-else-if="!image" class="text-center py-20">
    <p class="text-gray-400">图片不存在或已被删除</p>
  </div>

  <div v-else class="max-w-5xl mx-auto px-4 py-8">
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <!-- Image -->
      <!-- 用 _thumb_md（800px）而不是原图（上传上限 10MB）做页内预览；
           原图仅通过「下载」按钮走 /api/images/:id/file 获取。
           min-h 用于为图片预留高度，避免加载完成后把下方信息区推移（CLS）。 -->
      <div class="bg-gray-900 flex items-center justify-center p-4 min-h-[45vh]">
        <img
          :src="image.thumbnailUrl || image.url"
          :alt="image.title"
          class="max-h-[70vh] max-w-full object-contain"
          decoding="async"
          fetchpriority="high"
        />
      </div>

      <!-- Info -->
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-2">{{ image.title }}</h1>
        <p v-if="image.description" class="text-gray-500 mb-4">{{ image.description }}</p>

        <div class="flex flex-wrap items-center gap-6 text-gray-500 text-sm">
          <!-- Author -->
          <div class="flex items-center gap-2">
            <span>👤</span>
            <router-link
              :to="`/users/${image.userId}`"
              class="text-gray-500 hover:text-blue-600 no-underline transition-colors"
            >
              {{ image.user?.username }}
            </router-link>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-2">
            <span>👁️</span>
            <span>{{ image.viewCount }} 次浏览</span>
          </div>

          <!-- Categories -->
          <div v-if="image.categories?.length" class="flex flex-wrap gap-1">
            <el-tag v-for="cat in image.categories" :key="cat.id" size="small" type="info">
              {{ cat.name }}
            </el-tag>
          </div>

          <span class="text-gray-300">{{ new Date(image.createdAt).toLocaleDateString('zh-CN') }}</span>
        </div>

        <!-- Actions -->
        <div class="flex gap-4 mt-6">
          <el-button
            size="large"
            :type="image.isLiked ? 'danger' : 'default'"
            :loading="likeMutation.isPending.value"
            @click="handleLike"
          >
            {{ image.isLiked ? '❤️ 已点赞' : '🤍 点赞' }} ({{ image.likeCount }})
          </el-button>
          <el-button
            size="large"
            type="primary"
            :loading="downloadMutation.isPending.value"
            @click="handleDownload"
          >
            ⬇ 下载 ({{ image.downloadCount }})
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>
