<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import request from '@/utils/request'
import ImageCard from '@/components/common/ImageCard.vue'

const route = useRoute()
const userId = route.params.id as string
const page = ref(1)

const { data: profile, isLoading: profileLoading } = useQuery({
  queryKey: ['user-profile', userId],
  queryFn: () => request.get(`/users/${userId}`).then((r) => r.data.data),
})

const { data: images, isLoading: imagesLoading } = useQuery({
  queryKey: ['user-images', userId, page],
  queryFn: () =>
    request
      .get(`/users/${userId}/images`, { params: { page: page.value, size: 20 } })
      .then((r) => ({ data: r.data.data, meta: r.data.meta })),
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Profile Header -->
    <div v-if="profileLoading" class="text-center py-20">
      <p class="text-gray-400">加载中...</p>
    </div>

    <div v-else-if="!profile" class="text-center py-20">
      <p class="text-gray-400">用户不存在</p>
    </div>

    <template v-else>
      <div class="bg-white rounded-xl shadow-sm p-8 mb-8">
        <div class="flex items-start gap-6">
          <div class="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl shrink-0">
            {{ profile.username?.charAt(0)?.toUpperCase() || '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <h1 class="text-xl font-bold">{{ profile.username }}</h1>
              <el-tag v-if="profile.role === 'admin'" size="small" type="danger">管理员</el-tag>
            </div>
            <p class="text-gray-500 text-sm mb-2">
              加入于 {{ new Date(profile.createdAt).toLocaleDateString('zh-CN') }}
            </p>
            <p class="text-gray-600">{{ profile.bio }}</p>
          </div>
        </div>
      </div>

      <!-- User's Images -->
      <h2 class="text-lg font-bold mb-4">{{ profile.username }} 的图片</h2>

      <div v-if="imagesLoading" class="text-center py-10">
        <p class="text-gray-400">加载中...</p>
      </div>

      <div v-else-if="!images?.data?.length" class="text-center py-10 bg-white rounded-xl">
        <p class="text-gray-400">还没有上传过图片</p>
      </div>

      <div v-else class="columns-2 md:columns-3 gap-2 [column-fill:balance]">
        <ImageCard v-for="image in images.data" :key="image.id" :image="image" class="mb-2 break-inside-avoid" />
      </div>

      <div v-if="images?.meta && images.meta.totalPages > 1" class="flex justify-center mt-6">
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="images.meta.total"
          background
          layout="prev, pager, next"
        />
      </div>
    </template>
  </div>
</template>
