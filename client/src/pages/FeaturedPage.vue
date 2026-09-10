<script setup lang="ts">
import { ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { getFeatured } from '@/api/images'
import ImageCard from '@/components/common/ImageCard.vue'

const page = ref(1)

const { data, isLoading } = useQuery({
  queryKey: ['featured', page],
  queryFn: () =>
    getFeatured({ page: page.value, size: 20 }).then((r) => r.data),
  // 翻页时保留上一页数据，避免整页闪「加载中」并让网格/图片重建、滚动位置跳动
  placeholderData: keepPreviousData,
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="text-center mb-10">
      <div class="flex items-center justify-center gap-3 mb-3">
        <img src="/logo.png" alt="奶龙" class="w-12 h-12 rounded-full object-cover" />
        <h1 class="text-4xl font-bold">精选推荐</h1>
      </div>
      <p class="text-gray-500 text-lg">管理员精选优质图片</p>
    </div>

    <div v-if="isLoading" class="text-center py-20">
      <p class="text-gray-400">加载中...</p>
    </div>

    <div v-else-if="!data?.data?.length" class="text-center py-20">
      <p class="text-gray-400 text-lg">暂无精选图片</p>
    </div>

    <div v-else class="columns-2 md:columns-3 lg:columns-4 gap-2 [column-fill:balance]">
      <ImageCard v-for="image in data.data" :key="image.id" :image="image" class="mb-2 break-inside-avoid" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-10">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="data.meta.total"
        background
        layout="prev, pager, next"
        @current-change="(p: number) => page = p"
      />
    </div>
  </div>
</template>
