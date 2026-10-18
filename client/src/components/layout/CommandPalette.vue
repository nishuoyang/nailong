<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getImages, type ImageItem, type TagItem } from '@/api/images'
import { getTags } from '@/api/social'
import { useCommandPalette } from '@/composables/useCommandPalette'
import AppIcon from '@/components/ui/AppIcon.vue'

interface Row {
  key: string
  label: string
  hint?: string
  icon: string
  to: string
  image?: ImageItem
  tag?: TagItem
}

const router = useRouter()
const { isOpen, seed, close } = useCommandPalette()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)
const searching = ref(false)
const images = ref<ImageItem[]>([])
const tags = ref<TagItem[]>([])
const allTags = ref<TagItem[]>([])

const quick: Row[] = [
  { key: 'nav-home', label: '发现', hint: '首页', icon: 'home', to: '/' },
  { key: 'nav-featured', label: '精选推荐', hint: '管理员精选', icon: 'star', to: '/featured' },
  { key: 'nav-collections', label: '收藏夹', hint: '主题合集', icon: 'folder', to: '/collections' },
  { key: 'nav-studio', label: '表情包工坊', hint: '三秒出片', icon: 'sparkles', to: '/studio' },
  { key: 'nav-story', label: '奶蛙史', hint: '从一只蛙说起', icon: 'flower', to: '/story' },
  { key: 'nav-upload', label: '投稿', hint: '把好图交出来', icon: 'upload', to: '/upload' },
]

const recent = ref<string[]>([])
const RECENT_KEY = 'nl:recent-search'

function loadRecent() {
  try {
    recent.value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5)
  } catch {
    recent.value = []
  }
}

function remember(term: string) {
  const next = [term, ...recent.value.filter((item) => item !== term)].slice(0, 5)
  recent.value = next
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

const rows = computed<Row[]>(() => {
  if (!query.value.trim()) {
    const tagRows: Row[] = allTags.value.slice(0, 6).map((tag) => ({
      key: 'tag-' + tag.id,
      label: tag.name,
      hint: `${tag.count ?? 0} 张图`,
      icon: 'tag',
      to: `/tags/${encodeURIComponent(tag.slug)}`,
      tag,
    }))
    return [...quick, ...tagRows]
  }
  return [
    ...images.value.map<Row>((image) => ({
      key: 'image-' + image.id,
      label: image.title,
      hint: image.user?.username || '',
      icon: 'image',
      to: `/images/${image.id}`,
      image,
    })),
    ...tags.value.map<Row>((tag) => ({
      key: 'tag-' + tag.id,
      label: `#${tag.name}`,
      hint: `${tag.count ?? 0} 张图`,
      icon: 'tag',
      to: `/tags/${encodeURIComponent(tag.slug)}`,
      tag,
    })),
  ]
})

let timer: number | undefined
let requestId = 0

async function search(term: string) {
  const trimmed = term.trim()
  const current = ++requestId
  if (!trimmed) {
    images.value = []
    tags.value = []
    searching.value = false
    return
  }
  searching.value = true
  try {
    const [imageRes, tagRes] = await Promise.all([
      getImages({ search: trimmed, size: 8, sort: 'popular' }),
      getTags(8, trimmed),
    ])
    if (current !== requestId) return
    images.value = imageRes.data.data
    tags.value = tagRes.data.data
  } catch {
    if (current === requestId) {
      images.value = []
      tags.value = []
    }
  } finally {
    if (current === requestId) searching.value = false
  }
}

watch(query, (value) => {
  activeIndex.value = 0
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void search(value), 220)
})

watch(isOpen, async (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    query.value = seed.value
    loadRecent()
    if (!allTags.value.length) {
      getTags(24)
        .then((res) => (allTags.value = res.data.data))
        .catch(() => undefined)
    }
    await nextTick()
    inputRef.value?.focus()
  } else {
    requestId++
    searching.value = false
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
})

function go(row?: Row) {
  const target = row ?? rows.value[activeIndex.value]
  if (!target) {
    const term = query.value.trim()
    if (term) {
      remember(term)
      close()
      router.push({ path: '/search', query: { q: term } })
    }
    return
  }
  if (query.value.trim()) remember(query.value.trim())
  close()
  router.push(target.to)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % Math.max(rows.value.length, 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + rows.value.length) % Math.max(rows.value.length, 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    go()
  } else if (event.key === 'Escape') {
    close()
  }
}

function pickRecent(term: string) {
  query.value = term
  nextTick(() => inputRef.value?.focus())
}

defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="isOpen" class="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[10vh] sm:pt-[12vh]" @keydown="onKeydown">
        <div class="absolute inset-0 bg-[#15110b]/50 backdrop-blur-md" @click="close" />
        <div class="relative w-full max-w-[640px] overflow-hidden rounded-[26px] border border-ink/20 bg-surface shadow-[0_40px_120px_-25px_rgba(20,15,8,.7)]">
          <div class="flex items-center gap-3 border-b border-line px-5 py-4">
            <AppIcon name="search" :size="19" class="text-accent" />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="搜图片、标签，或者直接输入关键词…"
              aria-label="搜索图片或标签"
              class="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              autocomplete="off"
            />
            <span v-if="searching" class="font-mono text-[10px] text-muted">SEARCHING</span>
            <kbd class="hidden rounded-md border border-line px-1.5 py-1 font-mono text-[9px] text-muted sm:block">ESC</kbd>
          </div>

          <div class="max-h-[58vh] overflow-y-auto p-2">
            <template v-if="!query.trim()">
              <p class="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">快速前往</p>
            </template>
            <template v-else>
              <p class="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                {{ searching ? '正在找…' : rows.length ? `找到 ${rows.length} 个结果` : '没有找到，试试别的词' }}
              </p>
            </template>

            <button
              v-for="(row, index) in rows"
              :key="row.key"
              class="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition"
              :class="index === activeIndex ? 'bg-ink text-paper' : 'text-ink hover:bg-surface-2'"
              @mouseenter="activeIndex = index"
              @click="go(row)"
            >
              <span
                v-if="row.image"
                class="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-paper"
              >
                <img
                  :src="row.image.thumbnailSmUrl || row.image.thumbnailUrl || row.image.url"
                  :alt="row.image.title"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              </span>
              <span
                v-else
                class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
                :class="index === activeIndex ? 'border-paper/25 text-paper' : 'border-line text-ink-2'"
              >
                <AppIcon :name="row.icon" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ row.label }}</span>
                <span
                  v-if="row.hint"
                  class="mt-0.5 block truncate font-mono text-[10px]"
                  :class="index === activeIndex ? 'text-paper/60' : 'text-muted'"
                >
                  {{ row.hint }}
                </span>
              </span>
              <AppIcon
                name="arrow-up-right"
                :size="14"
                class="shrink-0 opacity-0 transition group-hover:opacity-100"
                :class="index === activeIndex ? 'opacity-100' : ''"
              />
            </button>

            <div v-if="!query.trim() && recent.length" class="mt-2 border-t border-line px-3 pb-2 pt-3">
              <p class="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">最近搜索</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="term in recent"
                  :key="term"
                  class="n-chip !h-7 !text-[11px]"
                  @click="pickRecent(term)"
                >
                  <AppIcon name="clock" :size="11" /> {{ term }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-line bg-paper/60 px-5 py-2.5 font-mono text-[9px] tracking-wide text-muted">
            <span class="flex items-center gap-3">
              <span><kbd class="rounded border border-line px-1">↑</kbd><kbd class="ml-0.5 rounded border border-line px-1">↓</kbd> 选择</span>
              <span><kbd class="rounded border border-line px-1">↵</kbd> 打开</span>
            </span>
            <button v-if="query.trim()" class="flex items-center gap-1 transition hover:text-ink" @click="go()">
              查看全部搜索结果 <AppIcon name="arrow-right" :size="11" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.25s var(--ease-out-expo);
}
.palette-enter-active > div:last-child,
.palette-leave-active > div:last-child {
  transition: transform 0.32s var(--ease-out-expo), opacity 0.25s ease;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
.palette-enter-from > div:last-child,
.palette-leave-to > div:last-child {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}
</style>