<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { getOther, type ImageItem } from '@/api/images'
import PageHeader from '@/components/common/PageHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['other', 'infinite'],
  queryFn: ({ pageParam }) =>
    getOther({ page: pageParam as number, size: 24 }).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const images = computed<ImageItem[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? 0)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Off-topic · 其他推荐"
      title="和奶龙无关，但很好看"
      description="一个不太正经的副展厅：风景、插画、摄影、奇怪的截图。只要好看，都可以放进来。"
      :count="total"
      mark="◌"
    >
      <template #actions>
        <RouterLink v-if="auth.isLoggedIn" :to="{ path: '/upload', query: { section: 'other' } }" class="n-btn n-btn-primary no-underline">
          <AppIcon name="upload" :size="15" /> 投稿到这个板块
        </RouterLink>
        <RouterLink v-else to="/login" class="n-btn n-btn-outline no-underline">登录后投稿</RouterLink>
      </template>
    </PageHeader>

    <div class="n-container py-10 sm:py-12">
      <ImageGrid :images="images" :loading="isLoading" :skeleton-count="8">
        <template #empty>
          <UiEmpty title="这个展厅还空着" description="投稿一张与奶龙无关、但你觉得很好看的图。" icon="globe">
            <RouterLink :to="{ path: '/upload', query: { section: 'other' } }" class="n-btn n-btn-primary no-underline">去投稿</RouterLink>
          </UiEmpty>
        </template>
      </ImageGrid>

      <div v-if="images.length" class="mt-10 flex justify-center">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          {{ isFetchingNextPage ? '加载中' : '继续看' }}
        </button>
        <p v-else class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">— 到底了 —</p>
      </div>
    </div>
  </div>
</template>
