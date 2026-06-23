<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getImages } from '@/api/images'
import ImageCard from '@/components/common/ImageCard.vue'

const route = useRoute()

const page = ref(1)
const searchQuery = ref((route.query.q as string) || '')
const category = ref((route.query.category as string) || '')

watch(
  () => route.query,
  (q) => {
    searchQuery.value = (q.q as string) || ''
    category.value = (q.category as string) || ''
    page.value = 1
  },
)

const { data, isLoading } = useQuery({
  queryKey: ['search', searchQuery, category, page],
  queryFn: () =>
    getImages({
      page: page.value,
      search: searchQuery.value,
      category: category.value,
    }).then((r) => r.data),
  enabled: !!searchQuery.value || !!category.value,
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">
      搜索结果
      <span v-if="searchQuery" class="text-gray-400 text-lg font-normal ml-2">
        "{{ searchQuery }}"
      </span>
    </h1>

    <div v-if="isLoading" class="text-center py-20">
      <p class="text-gray-400">搜索中...</p>
    </div>

    <div v-else-if="!data?.data?.length" class="text-center py-20">
      <p class="text-gray-400 text-lg">未找到相关图片</p>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <ImageCard v-for="image in data.data" :key="image.id" :image="image" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-10">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="data.meta.total"
        background
        layout="prev, pager, next"
      />
    </div>
  </div>
</template>
