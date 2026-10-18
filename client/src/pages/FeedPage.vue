<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import type { ImageItem } from '@/api/images'
import { getFeed } from '@/api/social'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const auth = useAuthStore()

const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['feed', auth.user?.id],
  queryFn: ({ pageParam }) =>
    getFeed(pageParam as number, 24).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  enabled: computed(() => auth.isLoggedIn),
})

const images = computed<ImageItem[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? 0)
const followingCount = computed(() => data.value?.pages[0]?.meta.followingCount ?? 0)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Following feed"
      title="关注动态"
      :description="followingCount
        ? `你关注了 ${followingCount} 位创作者，他们一共放出了 ${total} 张图。`
        : '关注一些喜欢的创作者，他们的新作品会出现在这里。'"
      :count="total"
      mark="◎"
    >
      <template #actions>
        <RouterLink to="/" class="n-btn n-btn-primary no-underline">
          <AppIcon name="compass" :size="15" /> 去发现创作者
        </RouterLink>
      </template>
    </PageHeader>

    <div class="n-container py-10 sm:py-12">
      <ImageGrid :images="images" :loading="isLoading" :skeleton-count="8">
        <template #empty>
          <UiEmpty
            :title="followingCount ? '关注的人还没发新图' : '你的动态还是空的'"
            :description="followingCount
              ? '他们可能正在憋大招。先去发现页自己逛逛。'
              : '在图片详情页点一下「关注」，之后他们的新作品就会出现在这里。'"
            icon="users"
          >
            <RouterLink to="/" class="n-btn n-btn-primary no-underline">去发现页</RouterLink>
          </UiEmpty>
        </template>
      </ImageGrid>

      <div v-if="images.length" class="mt-10 flex justify-center">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          {{ isFetchingNextPage ? '加载中' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>