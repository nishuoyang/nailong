<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getImages, getCategories, getLeaderboard, getDailyRecommendation } from '@/api/images'
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

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
})

const { data: imageData, isLoading } = useQuery({
  queryKey: ['images', page, category, search, sort],
  queryFn: () =>
    getImages({ page: page.value, size: 20, category: category.value, search: search.value, sort: sort.value }).then(
      (r) => r.data,
    ),
})

const { data: leaderboard } = useQuery({
  queryKey: ['leaderboard'],
  queryFn: () => getLeaderboard().then((r) => r.data.data),
})

const { data: daily } = useQuery({
  queryKey: ['daily'],
  queryFn: () => getDailyRecommendation().then((r) => r.data.data),
  staleTime: 1000 * 60 * 30, // 30 分钟内不重复请求
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
  <!-- 三栏全宽布局 -->
  <div class="flex gap-6 px-4 py-8 max-w-[1400px] mx-auto">
    <!-- 左栏：每周排行榜 -->
    <aside class="w-56 shrink-0 hidden xl:block">
      <div class="bg-white rounded-xl shadow-sm p-4 sticky top-20">
        <h2 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
          🏆 每周排行榜
        </h2>
        <div v-if="!leaderboard?.length" class="text-xs text-gray-400 text-center py-4">
          暂无数据
        </div>
        <div v-else class="flex flex-col gap-2">
          <div v-for="(item, index) in leaderboard" :key="item.id">
            <!-- 第一名：显示图片 -->
            <div v-if="index === 0" class="mb-3">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">🥇</span>
                <router-link
                  :to="`/images/${item.id}`"
                  class="text-sm font-medium text-gray-800 hover:text-blue-600 no-underline truncate"
                >
                  {{ item.title }}
                </router-link>
                <span class="text-xs text-gray-400 ml-auto shrink-0">❤️{{ item.likeCount }}</span>
              </div>
              <router-link :to="`/images/${item.id}`">
                <img
                  :src="item.thumbnailUrl || item.url"
                  :alt="item.title"
                  class="w-full aspect-[4/3] object-cover rounded-lg hover:opacity-90 transition-opacity"
                />
              </router-link>
            </div>

            <!-- 其他排名 -->
            <div v-else class="flex items-center gap-2">
              <span class="text-xs w-5 text-center shrink-0" :class="{
                'text-amber-500 font-bold': index === 1,
                'text-orange-400 font-bold': index === 2,
                'text-gray-400': index > 2,
              }">
                {{ index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}` }}
              </span>
              <router-link
                :to="`/images/${item.id}`"
                class="text-xs text-gray-600 hover:text-blue-600 no-underline truncate flex-1"
              >
                {{ item.title }}
              </router-link>
              <span class="text-xs text-gray-400 shrink-0">❤️{{ item.likeCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 中栏：主要内容 -->
    <div class="flex-1 min-w-0">
      <!-- Hero -->
      <div class="text-center mb-10">
        <div class="flex items-center justify-center gap-3 mb-3">
          <img src="/logo.jpeg" alt="奶龙" class="w-12 h-12 rounded-full object-cover" />
          <h1 class="text-4xl font-bold">奶龙</h1>
        </div>
        <p class="text-gray-500 text-lg">发现、分享精彩图片</p>
      </div>

      <!-- Search -->
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
        <div class="flex flex-wrap gap-1">
          <el-button :type="category === '' ? 'primary' : 'default'" size="small" @click="handleCategoryChange('')">
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
          <el-button :type="sort === 'latest' ? 'primary' : 'default'" size="small" @click="handleSortChange('latest')">
            最新
          </el-button>
          <el-button :type="sort === 'popular' ? 'primary' : 'default'" size="small" @click="handleSortChange('popular')">
            最热
          </el-button>
          <el-button :type="sort === 'downloads' ? 'primary' : 'default'" size="small" @click="handleSortChange('downloads')">
            最多下载
          </el-button>
        </div>
      </div>

      <!-- Image Grid -->
      <div v-if="isLoading" class="text-center py-20">
        <p class="text-gray-400">加载中...</p>
      </div>

      <div v-else-if="!imageData?.data?.length" class="text-center py-20">
        <p class="text-gray-400 text-lg">暂无图片</p>
        <p class="text-gray-300 text-sm mt-2">成为第一个上传的人吧！</p>
      </div>

      <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ImageCard v-for="image in imageData.data" :key="image.id" :image="image" />
      </div>

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

    <!-- 右栏：每日推荐 -->
    <aside class="w-56 shrink-0 hidden xl:block">
      <div class="bg-white rounded-xl shadow-sm p-4 sticky top-20">
        <h2 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
          ⭐ 每日推荐
        </h2>
        <div v-if="!daily" class="text-xs text-gray-400 text-center py-4">
          暂无推荐
        </div>
        <div v-else>
          <router-link :to="`/images/${daily.id}`">
            <img
              :src="daily.thumbnailUrl || daily.url"
              :alt="daily.title"
              class="w-full aspect-[4/3] object-cover rounded-lg hover:opacity-90 transition-opacity mb-2"
            />
          </router-link>
          <router-link
            :to="`/images/${daily.id}`"
            class="text-sm font-medium text-gray-800 hover:text-blue-600 no-underline line-clamp-2"
          >
            {{ daily.title }}
          </router-link>
          <div class="flex items-center justify-between mt-1 text-xs text-gray-400">
            <span>{{ daily.user?.username }}</span>
            <span>❤️ {{ daily.likeCount }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-300 mt-3 text-center">每日 4:00 更新</p>
      </div>
    </aside>
  </div>
</template>
