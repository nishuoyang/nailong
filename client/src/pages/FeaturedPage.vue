<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { getFeatured, type ImageItem } from '@/api/images'
import PageHeader from '@/components/common/PageHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['featured', 'infinite'],
  queryFn: ({ pageParam }) =>
    getFeatured({ page: pageParam as number, size: 24 }).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const images = computed<ImageItem[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? 0)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Editor's picks · 编辑精选"
      title="值得多看两眼的图"
      description="由管理员从站内手动挑出来的作品。不一定最热，但一定有它的道理。"
      :count="total"
      mark="✦"
    >
      <template #actions>
        <RouterLink to="/other" class="n-btn n-btn-outline no-underline">
          其他推荐 <AppIcon name="arrow-up-right" :size="14" />
        </RouterLink>
      </template>
    </PageHeader>

    <div class="n-container py-10 sm:py-12">
      <div v-if="isError" class="rounded-[26px] border border-line bg-surface p-12 text-center">
        <p class="font-display text-2xl text-ink">加载失败</p>
        <RouterLink to="/" class="n-btn n-btn-outline mt-4 no-underline">回首页</RouterLink>
      </div>

      <ImageGrid v-else :images="images" :loading="isLoading" :skeleton-count="8">
        <template #empty>
          <UiEmpty title="还没有精选" description="管理员正在慢慢挑。先去发现页看看最新的图。" icon="star">
            <RouterLink to="/" class="n-btn n-btn-primary no-underline">去发现</RouterLink>
          </UiEmpty>
        </template>
      </ImageGrid>

      <div v-if="images.length" class="mt-10 flex justify-center">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          {{ isFetchingNextPage ? '加载中' : '继续看' }}
        </button>
        <p v-else class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">— 已经看完了 —</p>
      </div>
    </div>
  </div>
</template>
