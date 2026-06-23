<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getImages, getCategories } from '@/api/images'
import ImageCard from '@/components/common/ImageCard.vue'

const route = useRoute()
const router = useRouter()

const page = ref(1)
const category = ref<string>((route.query.category as string) || '')
const search = ref((route.query.search as string) || '')
const sort = ref<'latest' | 'popular' | 'downloads'>(
  (route.query.sort as 'latest' | 'popular' | 'downloads') || 'latest',
)
const searchInput = ref('')

// 分类列表
const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
})

// 图片列表
const { data: imageData, isLoading } = useQuery({
  queryKey: ['images', page, category, search, sort],
  queryFn: () =>
    getImages({ page: page.value, size: 20, category: category.value, search: search.value, sort: sort.value }).then(
      (r) => r.data,
    ),
})

function handleSearch() {
  search.value = searchInput.value
  page.value = 1
  router.push({ query: { ...route.query, search: search.value || undefined } })
}

function handleCategoryChange(slug: string) {
  category.value = slug
  page.value = 1
  router.push({ query: { ...route.query, category: slug || undefined } })
}

function handleSortChange(s: 'latest' | 'popular' | 'downloads') {
  sort.value = s
  page.value = 1
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold mb-3">🐉 Nai Long</h1>
      <p class="text-gray-500 text-lg">发现、分享精彩图片</p>
    </div>

    <!-- Search Bar -->
    <div class="max-w-xl mx-auto mb-8">
      <el-input
        v-model="searchInput"
        placeholder="搜索图片标题或描述..."
        size="large"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div class="flex flex-wrap gap-2">
        <el-button
          :type="category === '' ? 'primary' : 'default'"
          size="small"
          @click="handleCategoryChange('')"
        >
          全部
        </el-button>
        <el-button
          v-for="cat in categories"
          :key="cat.slug"
          :type="category === cat.slug ? 'primary' : 'default'"
          size="small"
          @click="handleCategoryChange(cat.slug)"
        >
          {{ cat.name }}
        </el-button>
      </div>
      <div class="flex gap-2">
        <el-button
          :type="sort === 'latest' ? 'primary' : 'default'"
          size="small"
          @click="handleSortChange('latest')"
        >
          最新
        </el-button>
        <el-button
          :type="sort === 'popular' ? 'primary' : 'default'"
          size="small"
          @click="handleSortChange('popular')"
        >
          最热
        </el-button>
        <el-button
          :type="sort === 'downloads' ? 'primary' : 'default'"
          size="small"
          @click="handleSortChange('downloads')"
        >
          最多下载
        </el-button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-20">
      <p class="text-gray-400">加载中...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="!imageData?.data?.length" class="text-center py-20">
      <p class="text-gray-400 text-lg">暂无图片</p>
      <p class="text-gray-300 text-sm mt-2">成为第一个上传的人吧！</p>
    </div>

    <!-- Image Grid -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <ImageCard v-for="image in imageData.data" :key="image.id" :image="image" />
    </div>

    <!-- Pagination -->
    <div v-if="imageData?.meta && imageData.meta.totalPages > 1" class="flex justify-center mt-10">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="imageData.meta.total"
        background
        layout="prev, pager, next"
        @current-change="(p: number) => page = p"
      />
    </div>
  </div>
</template>
