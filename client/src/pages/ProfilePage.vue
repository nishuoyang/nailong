<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getMe } from '@/api/auth'
import { getImages } from '@/api/images'
import ImageCard from '@/components/common/ImageCard.vue'

const page = ref(1)

const { data: user } = useQuery({
  queryKey: ['me'],
  queryFn: () => getMe().then((r) => r.data.data),
})

const { data: myImages, isLoading } = useQuery({
  queryKey: ['my-images', page],
  queryFn: () =>
    getImages({ page: page.value, size: 20 }).then((r) => {
      // Filter to user's own images on the server side
      return r.data
    }),
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- User Info -->
    <div class="bg-white rounded-xl shadow-sm p-8 mb-8">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
          {{ user?.username?.charAt(0)?.toUpperCase() || '?' }}
        </div>
        <div>
          <h1 class="text-xl font-bold">{{ user?.username }}</h1>
          <p class="text-gray-400 text-sm">{{ user?.email }}</p>
          <el-tag v-if="user?.role === 'admin'" size="small" type="danger" class="mt-1">管理员</el-tag>
        </div>
      </div>
    </div>

    <!-- My Uploads -->
    <h2 class="text-lg font-bold mb-4">我的上传</h2>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-gray-400">加载中...</p>
    </div>

    <div v-else-if="!myImages?.data?.length" class="text-center py-10 bg-white rounded-xl">
      <p class="text-gray-400">还没有上传过图片</p>
      <router-link to="/upload" class="text-blue-600 no-underline hover:underline text-sm mt-2 inline-block">
        去上传第一张
      </router-link>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <ImageCard v-for="image in myImages.data" :key="image.id" :image="image" />
    </div>
  </div>
</template>
