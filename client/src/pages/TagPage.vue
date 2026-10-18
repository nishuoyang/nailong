<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { getImages, type ImageItem } from '@/api/images'
import { getTag, getTags } from '@/api/social'
import PageHeader from '@/components/common/PageHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { data: tag } = useQuery({
  queryKey: ['tag', slug],
  queryFn: () => getTag(slug.value).then((r) => r.data.data),
})

const { data: relatedTags } = useQuery({
  queryKey: ['tags', 'tag-page'],
  queryFn: () => getTags(24).then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: computed(() => ['tag-images', slug.value]),
  queryFn: ({ pageParam }) =>
    getImages({ page: pageParam as number, size: 24, tag: slug.value }).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const images = computed<ImageItem[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? tag.value?.count ?? 0)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tag archive"
      :title="`#${tag?.name || slug}`"
      :description="`所有带这个标签的图，一共 ${total} 张。标签由投稿者添加，管理员也可以调整。`"
      :count="total"
      mark="#"
    />

    <div class="n-container py-10 sm:py-12">
      <ImageGrid :images="images" :loading="isLoading" :skeleton-count="8">
        <template #empty>
          <UiEmpty title="这个标签还是空的" description="去投稿时加上它，或者换一个标签看看。" icon="tag">
            <RouterLink to="/" class="n-btn n-btn-primary no-underline">回发现页</RouterLink>
          </UiEmpty>
        </template>
      </ImageGrid>

      <div v-if="relatedTags?.length" class="mt-12 border-t border-line pt-6">
        <p class="eyebrow mb-3">Explore more tags</p>
        <div class="flex flex-wrap gap-1.5">
          <RouterLink
            v-for="item in relatedTags.filter((item) => item.slug !== slug)"
            :key="item.id"
            :to="`/tags/${encodeURIComponent(item.slug)}`"
            class="n-tag"
          >
            #{{ item.name }} <span class="opacity-50">{{ item.count }}</span>
          </RouterLink>
        </div>
      </div>

      <div v-if="images.length" class="mt-10 flex justify-center">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          {{ isFetchingNextPage ? '加载中' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>