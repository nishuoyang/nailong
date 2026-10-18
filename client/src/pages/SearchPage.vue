<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { getImages, type ImageItem } from '@/api/images'
import { getTags } from '@/api/social'
import PageHeader from '@/components/common/PageHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const input = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const q = computed(() => ((route.query.q as string) || '').trim())
const sort = computed(() => ((route.query.sort as string) || 'latest') as 'latest' | 'popular' | 'downloads')

watch(
  () => q.value,
  (value) => {
    input.value = value
  },
  { immediate: true },
)

const { data: suggestions } = useQuery({
  queryKey: ['tags', 'search-suggestions'],
  queryFn: () => getTags(18).then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: computed(() => ['search', q.value, sort.value]),
  queryFn: ({ pageParam }) =>
    getImages({
      page: pageParam as number,
      size: 24,
      search: q.value || undefined,
      sort: sort.value,
    }).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  enabled: computed(() => !!q.value),
})

const images = computed<ImageItem[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? 0)

function submit() {
  const term = input.value.trim()
  router.replace({
    name: 'search',
    query: { ...(term ? { q: term } : {}), ...(sort.value !== 'latest' ? { sort: sort.value } : {}) },
  })
}

function setSort(value: string) {
  router.replace({ query: { ...route.query, sort: value === 'latest' ? undefined : value } })
}

function useTag(slug: string) {
  router.push({ name: 'tag', params: { slug } })
}

const sortOptions = [
  { value: 'latest', label: '最新' },
  { value: 'popular', label: '最热' },
  { value: 'downloads', label: '最多下载' },
]

watch(q, () => nextTick(() => inputRef.value?.focus()), { immediate: true })
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Search the archive"
      :title="q ? `“${q}” 的结果` : '找一张图'"
      :description="q ? (total ? `找到 ${total} 张相关的图。` : '没有找到完全匹配的图，换个关键词试试。') : '输入标题、描述或标签。也可以按 Ctrl K 随时打开搜索。'"
      :count="q ? total : undefined"
      mark="⌕"
    >
      <template #actions>
        <div class="relative w-full sm:w-80">
          <AppIcon name="search" :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref="inputRef"
            v-model="input"
            type="search"
            class="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
            placeholder="搜点什么…"
            aria-label="搜索图片"
            @keyup.enter="submit"
          />
        </div>
        <button class="n-btn n-btn-primary" @click="submit">搜索</button>
      </template>
      <template #meta v-if="q">
        <span class="flex items-center gap-1.5 text-xs text-muted">
          <AppIcon name="filter" :size="12" /> 排序
        </span>
        <button
          v-for="option in sortOptions"
          :key="option.value"
          class="text-xs transition"
          :class="sort === option.value ? 'font-semibold text-accent' : 'text-muted hover:text-ink'"
          @click="setSort(option.value)"
        >
          {{ option.label }}
        </button>
      </template>
    </PageHeader>

    <div class="n-container py-10 sm:py-12">
      <template v-if="!q">
        <div class="mx-auto max-w-3xl text-center">
          <div class="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] border border-line bg-surface text-accent">
            <AppIcon name="search" :size="28" />
          </div>
          <h2 class="font-display text-3xl text-ink">或者，从一个标签开始</h2>
          <p class="mt-2 text-sm text-muted">大家最近都在看这些。</p>
          <div class="mt-6 flex flex-wrap justify-center gap-2">
            <button v-for="tag in suggestions" :key="tag.id" class="n-chip" @click="useTag(tag.slug)">
              #{{ tag.name }}
              <span class="font-mono text-[9px] opacity-50">{{ tag.count ?? 0 }}</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <ImageGrid :images="images" :loading="isLoading" :skeleton-count="8">
          <template #empty>
            <UiEmpty title="没有找到" description="换一个更短的关键词，或者去标签页逛逛。图片标题和描述都可以搜。" icon="search">
              <div class="flex flex-wrap justify-center gap-2">
                <button v-for="tag in suggestions?.slice(0, 6)" :key="tag.id" class="n-chip" @click="useTag(tag.slug)">
                  #{{ tag.name }}
                </button>
              </div>
            </UiEmpty>
          </template>
        </ImageGrid>

        <div v-if="images.length" class="mt-10 flex justify-center">
          <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
            {{ isFetchingNextPage ? '加载中' : '加载更多' }}
          </button>
          <p v-else class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">— 共 {{ total }} 张 —</p>
        </div>
      </template>
    </div>
  </div>
</template>