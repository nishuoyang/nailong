<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import {
  getCategories,
  getCollections,
  getDailyRecommendation,
  getImages,
  getLeaderboard,
  getStats,
  getTags,
  type ImageItem,
} from '@/api'
import ImageGrid from '@/components/common/ImageGrid.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'

const route = useRoute()
const router = useRouter()

const category = computed(() => (route.query.category as string) || '')
const tag = computed(() => (route.query.tag as string) || '')
const sort = computed(() => ((route.query.sort as string) || 'latest') as 'latest' | 'popular' | 'downloads')
const sortOptions = [
  { value: 'latest', label: '最新' },
  { value: 'popular', label: '最热' },
  { value: 'downloads', label: '最多下载' },
] as const

const heroSearch = ref('')

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const { data: stats } = useQuery({
  queryKey: ['stats'],
  queryFn: () => getStats().then((r) => r.data.data),
  staleTime: 5 * 60_000,
})

const { data: daily } = useQuery({
  queryKey: ['daily'],
  queryFn: () => getDailyRecommendation().then((r) => r.data.data),
  staleTime: 30 * 60_000,
})

const rankRange = ref<'week' | 'month'>('week')
const { data: leaderboard } = useQuery({
  queryKey: ['leaderboard', rankRange],
  queryFn: () => getLeaderboard(rankRange.value).then((r) => r.data.data),
  staleTime: 5 * 60_000,
})

const { data: tags } = useQuery({
  queryKey: ['tags', 14],
  queryFn: () => getTags(14).then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const { data: collections } = useQuery({
  queryKey: ['collections', 'home'],
  queryFn: () => getCollections(1, 3).then((r) => r.data.data),
  staleTime: 5 * 60_000,
})

const {
  data: imagePages,
  isLoading,
  isError,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: computed(() => ['images', category.value, tag.value, sort.value]),
  queryFn: ({ pageParam }) =>
    getImages({
      page: pageParam as number,
      size: 24,
      category: category.value || undefined,
      tag: tag.value || undefined,
      sort: sort.value,
    }).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) =>
    last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
})

const images = computed<ImageItem[]>(() => imagePages.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => imagePages.value?.pages[0]?.meta.total ?? 0)

function submitSearch() {
  const term = heroSearch.value.trim()
  if (term) router.push({ name: 'search', query: { q: term } })
  else document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function setQuery(patch: Record<string, string | undefined>) {
  const next: Record<string, string> = {}
  const merged = { category: category.value || undefined, tag: tag.value || undefined, sort: sort.value, ...patch }
  for (const [key, value] of Object.entries(merged)) {
    if (value && !(key === 'sort' && value === 'latest')) next[key] = value
  }
  router.replace({ query: next })
}

function formatNumber(value?: number) {
  if (!value) return '0'
  return value >= 10_000 ? (value / 10_000).toFixed(1).replace(/\.0$/, '') + 'w' : value.toLocaleString('zh-CN')
}

const dailyAspect = computed(() => {
  const w = daily.value?.width
  const h = daily.value?.height
  return w && h ? `${w} / ${h}` : '4 / 5'
})
</script>

<template>
  <div>
    <!-- ============================== HERO ============================== -->
    <section class="relative overflow-hidden border-b border-line">
      <div class="pointer-events-none absolute inset-0 dot-field opacity-[0.35]" />
      <div class="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-butter/30 blur-3xl" />
      <div class="pointer-events-none absolute -left-40 bottom-0 h-[380px] w-[380px] rounded-full bg-accent/10 blur-3xl" />

      <div class="n-container relative grid gap-14 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
        <div class="animate-fade-up">
          <div class="mb-6 flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-butter px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#181510]">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              图片档案馆 · 每日更新
            </span>
            <span class="n-tag !py-1.5">Since 2024</span>
          </div>

          <h1 class="display text-[52px] leading-[0.92] text-ink sm:text-[70px] lg:text-[72px] xl:text-[86px]">
            把喜欢的图，<br />
            贴满整个<span class="relative inline-block text-accent">宇宙<span class="absolute -right-4 -top-2 rotate-12 text-[20px] text-butter">✳</span></span>。
          </h1>

          <p class="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-2">
            奶龙、奶蛙、动漫、还有一些说不上来但就是很好看的图。看图、收藏、聊两句，
            顺手把一张图做成只属于你的表情包。
          </p>

          <div class="mt-8 flex max-w-lg flex-col gap-2 sm:flex-row">
            <div class="relative flex-1">
              <AppIcon name="search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                v-model="heroSearch"
                type="search"
                class="h-12 w-full rounded-full border border-line-strong bg-surface pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
                placeholder="搜一张图、一个标签…"
                aria-label="搜索图片或标签"
                @keyup.enter="submitSearch"
              />
            </div>
            <button class="n-btn n-btn-primary n-btn-lg" @click="submitSearch">
              逛起来 <AppIcon name="arrow-right" :size="16" />
            </button>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <RouterLink to="/studio" class="group inline-flex items-center gap-2 text-sm font-semibold text-ink no-underline">
              <span class="grid h-8 w-8 place-items-center rounded-full border border-ink bg-surface transition group-hover:rotate-12 group-hover:bg-butter group-hover:text-[#181510]">
                <AppIcon name="sparkles" :size="15" />
              </span>
              或者，三秒做张表情包
              <AppIcon name="arrow-up-right" :size="13" class="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </RouterLink>
          </div>

          <div class="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
            <div v-for="item in [
              { label: '张图', value: stats?.images },
              { label: '次喜欢', value: stats?.likes },
              { label: '条评论', value: stats?.comments },
              { label: '位收藏家', value: stats?.users },
            ]" :key="item.label">
              <p class="font-display text-[28px] leading-none tabular text-ink">{{ formatNumber(item.value) }}</p>
              <p class="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{{ item.label }}</p>
            </div>
          </div>
        </div>

        <!-- Daily polaroid stack -->
        <div class="relative mx-auto w-full max-w-[430px]">
          <div class="absolute inset-x-8 top-8 h-[85%] rotate-[6deg] rounded-[30px] border border-ink/20 bg-jade/20" />
          <div class="absolute inset-x-6 top-4 h-[92%] rotate-[-5deg] rounded-[30px] border border-ink/20 bg-accent/15" />

          <RouterLink
            v-if="daily"
            :to="`/images/${daily.id}`"
            class="tape group relative block rotate-[-2deg] rounded-[22px] border border-ink/25 bg-surface p-3 pb-14 no-underline shadow-[8px_10px_0_0_rgba(24,21,16,.12)] transition-transform duration-500 hover:rotate-[0.5deg] hover:scale-[1.01]"
          >
            <div class="relative overflow-hidden rounded-[14px]" :style="{ aspectRatio: dailyAspect, backgroundColor: daily.dominantColor || 'var(--surface-2)' }">
              <img
                :src="daily.thumbnailUrl || daily.url"
                :alt="daily.title"
                class="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
              />
              <div class="absolute left-3 top-3 rounded-full border border-white/30 bg-black/35 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                Today's pick
              </div>
            </div>
            <div class="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-display text-[22px] leading-none text-ink">{{ daily.title }}</p>
                <p class="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <UiAvatar :src="daily.user?.avatarUrl" :name="daily.user?.username" :size="16" />
                  {{ daily.user?.username }}
                </p>
              </div>
              <span class="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted">
                <AppIcon name="heart" :size="12" /> {{ daily.likeCount }}
              </span>
            </div>
            <span class="absolute -right-4 -top-5 grid h-14 w-14 rotate-12 place-items-center rounded-full border border-ink bg-butter font-mono text-[8px] font-bold uppercase leading-tight tracking-wider text-[#181510] shadow-[2px_2px_0_0_var(--ink)]">
              每日<br />04:00
            </span>
          </RouterLink>

          <div v-else class="relative rotate-[-2deg] rounded-[22px] border border-ink/25 bg-surface p-3 pb-14">
            <div class="grid aspect-[4/5] place-items-center rounded-[14px] bg-surface-2">
              <img src="/logo.png" alt="奶龙" class="h-24 w-24 rounded-2xl object-cover opacity-70" />
            </div>
            <p class="absolute inset-x-4 bottom-4 font-display text-xl text-ink">今天的推荐还在路上</p>
          </div>

          <div class="absolute -bottom-5 left-0 flex items-center gap-2 rounded-full border border-ink/15 bg-surface px-3 py-2 shadow-sm sm:-left-4">
            <span class="grid h-6 w-6 place-items-center rounded-full bg-jade text-white"><AppIcon name="sparkles" :size="12" /></span>
            <span class="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Handpicked daily</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== TRENDING ============================== -->
    <section class="border-b border-line bg-paper-deep/60">
      <div class="n-container py-7">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div class="flex items-baseline gap-3">
            <h2 class="font-display text-[26px] leading-none text-ink">本周热榜</h2>
            <span class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Most loved</span>
          </div>
          <div class="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            <button
              v-for="range in [{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }]"
              :key="range.value"
              class="rounded-full px-3 py-1 text-[11px] font-medium transition"
              :class="rankRange === range.value ? 'bg-ink text-paper' : 'text-muted hover:text-ink'"
              @click="rankRange = range.value as 'week' | 'month'"
            >
              {{ range.label }}
            </button>
          </div>
        </div>

        <div v-if="leaderboard?.length" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <RouterLink
            v-for="(item, index) in leaderboard.slice(0, 5)"
            :key="item.id"
            :to="`/images/${item.id}`"
            class="group flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-2 py-2 no-underline transition hover:border-line hover:bg-surface"
          >
            <span
              class="w-7 shrink-0 text-center font-display text-[30px] leading-none"
              :class="index === 0 ? 'text-accent' : index < 3 ? 'text-ink' : 'text-muted/60'"
            >
              {{ String(index + 1).padStart(2, '0') }}
            </span>
            <span class="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              <img :src="item.thumbnailSmUrl || item.thumbnailUrl || item.url" :alt="item.title" class="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[12px] font-medium text-ink transition group-hover:text-accent">{{ item.title }}</span>
              <span class="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-muted"><AppIcon name="heart" :size="10" />{{ item.likeCount }} · {{ item.user?.username }}</span>
            </span>
          </RouterLink>
        </div>
        <p v-else class="py-6 text-sm text-muted">榜单正在统计中，先去发现页逛逛。</p>
      </div>
    </section>

    <!-- ============================== DISCOVER ============================== -->
    <section id="discover" class="n-container scroll-mt-28 py-12 sm:py-16">
      <div class="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="eyebrow mb-2">01 / Discover</p>
          <h2 class="display text-[36px] text-ink sm:text-[44px]">
            {{ tag ? `#${tag}` : '最新上架' }}
            <span class="ml-2 align-super font-mono text-[11px] font-normal tracking-normal text-muted">{{ total }}</span>
          </h2>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            class="n-chip !h-8 !text-[11px]"
            :class="{ 'is-active': sort === option.value }"
            @click="setQuery({ sort: option.value })"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="mb-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button class="n-chip shrink-0 !h-8 !text-[11px]" :class="{ 'is-active': !category }" @click="setQuery({ category: undefined })">
          全部
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="n-chip shrink-0 !h-8 !text-[11px]"
          :class="{ 'is-active': category === cat.slug }"
          @click="setQuery({ category: cat.slug })"
        >
          {{ cat.name }}
          <span class="font-mono text-[9px] opacity-50">{{ cat.count ?? 0 }}</span>
        </button>
      </div>

      <div v-if="tags?.length" class="mb-8 flex flex-wrap items-center gap-1.5 border-b border-line pb-6">
        <span class="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Tags</span>
        <button
          v-for="t in tags.slice(0, 10)"
          :key="t.id"
          class="n-tag"
          :class="tag === t.slug ? '!border-accent !text-accent' : ''"
          @click="setQuery({ tag: tag === t.slug ? undefined : t.slug })"
        >
          #{{ t.name }}
        </button>
        <button v-if="tag" class="ml-1 text-[10px] text-accent underline-offset-2 hover:underline" @click="setQuery({ tag: undefined })">
          清除筛选
        </button>
      </div>

      <div v-if="isError" class="rounded-[26px] border border-line bg-surface p-12 text-center">
        <p class="font-display text-2xl text-ink">网络打了个喷嚏</p>
        <button class="n-btn n-btn-outline mt-4" @click="() => router.go(0)">重新加载</button>
      </div>

      <ImageGrid v-else :images="images" :loading="isLoading" :skeleton-count="8">
        <template #empty>
          <UiEmpty
            :title="tag || category ? '这个筛选下还没有图' : '图库还空着'"
            :description="tag || category ? '换一个标签或分类，或者把第一张图投进来。' : '成为第一个把图贴到宇宙里的人。'"
            icon="image"
          >
            <RouterLink to="/upload" class="n-btn n-btn-primary no-underline">去投稿</RouterLink>
          </UiEmpty>
        </template>
      </ImageGrid>

      <div v-if="images.length" class="mt-10 flex flex-col items-center gap-3">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          <AppIcon v-if="!isFetchingNextPage" name="arrow-down" :size="16" />
          <span v-else class="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          {{ isFetchingNextPage ? '加载中' : '再看一些' }}
        </button>
        <p v-else class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          — 到底了，总共 {{ total }} 张 —
        </p>
      </div>
    </section>

    <!-- ============================== COLLECTIONS ============================== -->
    <section v-if="collections?.length" class="border-y border-line bg-paper-deep/50">
      <div class="n-container py-12 sm:py-16">
        <div class="mb-7 flex items-end justify-between gap-4">
          <div>
            <p class="eyebrow mb-2">02 / Collections</p>
            <h2 class="display text-[34px] text-ink sm:text-[42px]">别人的收藏夹</h2>
          </div>
          <RouterLink to="/collections" class="n-btn n-btn-outline n-btn-sm no-underline">
            全部 <AppIcon name="arrow-up-right" :size="13" />
          </RouterLink>
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <RouterLink
            v-for="collection in collections"
            :key="collection.id"
            :to="`/collections/${collection.id}`"
            class="group overflow-hidden rounded-[22px] border border-line bg-surface p-3 no-underline transition hover:-translate-y-1 hover:border-ink/40 hover:shadow-[0_18px_40px_-24px_rgba(30,22,12,.4)]"
          >
            <div class="grid aspect-[16/10] grid-cols-2 gap-1 overflow-hidden rounded-[15px] bg-surface-2">
              <div v-for="n in 4" :key="n" class="overflow-hidden">
                <img
                  v-if="collection.previews[n - 1]"
                  :src="collection.previews[n - 1].thumbnailSmUrl || collection.previews[n - 1].thumbnailUrl || ''"
                  :alt="collection.name"
                  class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div v-else class="h-full w-full bg-paper-deep" />
              </div>
            </div>
            <div class="flex items-center justify-between gap-3 px-1 pb-1 pt-3">
              <div class="min-w-0">
                <p class="truncate font-display text-[20px] leading-none text-ink">{{ collection.name }}</p>
                <p class="mt-1.5 truncate text-[11px] text-muted">{{ collection.user?.username }} · {{ collection.itemCount }} 张</p>
              </div>
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-2 transition group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                <AppIcon name="arrow-up-right" :size="14" />
              </span>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- ============================== STUDIO CTA ============================== -->
    <section class="n-container py-14 sm:py-20">
      <div class="relative overflow-hidden rounded-[30px] border-[1.5px] border-[#181510] bg-butter px-6 py-10 text-[#181510] shadow-[6px_6px_0_0_#181510] sm:px-12 sm:py-14">
        <div class="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[30px] border-ink/[0.06]" />
        <div class="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rotate-12 rounded-[36px] border-[20px] border-accent/10" />
        <div class="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div class="max-w-2xl">
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-[#181510]/60">03 / Meme Studio</p>
            <h2 class="display mt-3 text-[36px] leading-[0.95] text-[#181510] sm:text-[54px]">
              三秒，<br />做张表情包。
            </h2>
            <p class="mt-4 max-w-md text-sm leading-relaxed text-[#181510]/70">
              挑一张站内图，拖两行字，换字体、换描边、换比例。全程在浏览器里完成，不上传、不等待。
            </p>
          </div>
          <div class="flex shrink-0 flex-col gap-3">
            <RouterLink to="/studio" class="n-btn n-btn-primary n-btn-lg no-underline">
              <AppIcon name="sparkles" :size="17" /> 打开工坊
            </RouterLink>
            <span class="text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[#181510]/50">No upload · No wait</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>