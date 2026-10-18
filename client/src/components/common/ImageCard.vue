<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ImageItem } from '@/api/images'
import { toggleFavorite } from '@/api/social'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'

const props = withDefaults(defineProps<{ image: ImageItem; compact?: boolean; removable?: boolean }>(), {
  compact: false,
  removable: false,
})
const emit = defineEmits<{
  (e: 'favorite', value: { favorited: boolean; favoriteCount: number }): void
  (e: 'remove', id: string): void
}>()

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const loaded = ref(false)
const favoriting = ref(false)
const favorited = ref(Boolean(props.image.isFavorited))
const favoriteCount = ref(props.image.favoriteCount ?? 0)

const aspectRatio = computed(() => {
  const { width, height } = props.image
  return width && height ? `${width} / ${height}` : undefined
})

const srcset = computed(() => {
  const sm = props.image.thumbnailSmUrl || props.image.thumbnailUrl || props.image.url
  const md = props.image.thumbnailUrl || props.image.url
  if (!sm || !md) return undefined
  return `${sm} 300w, ${md} 800w`
})

const cover = computed(() => props.image.thumbnailSmUrl || props.image.thumbnailUrl || props.image.url)
const tags = computed(() => (props.image.tags || []).slice(0, 2))

function open() {
  router.push(`/images/${props.image.id}`)
}

async function onFavorite() {
  if (!auth.isLoggedIn) {
    toast.warning('登录后就能收藏这张图了')
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  if (favoriting.value) return
  favoriting.value = true
  try {
    const res = await toggleFavorite(props.image.id)
    favorited.value = res.data.data.favorited
    favoriteCount.value = res.data.data.favoriteCount
    emit('favorite', res.data.data)
    toast.success(res.data.data.favorited ? '已收进收藏夹' : '已取消收藏')
  } catch (err: any) {
    toast.error(err.response?.data?.message || '收藏失败，稍后再试')
  } finally {
    favoriting.value = false
  }
}

function makeMeme() {
  router.push({ name: 'studio', query: { image: props.image.id } })
}
</script>

<template>
  <article
    class="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-[20px] border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-ink/45 hover:shadow-[0_18px_40px_-24px_rgba(30,22,12,.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    role="link"
    tabindex="0"
    :aria-label="`查看图片：${image.title}`"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <div
      class="relative overflow-hidden"
      :style="{
        aspectRatio,
        backgroundColor: image.dominantColor || 'var(--surface-2)',
      }"
    >
      <img
        v-if="image.blurDataUrl"
        :src="image.blurDataUrl"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 h-full w-full scale-105 object-cover blur-md transition-opacity duration-500"
        :class="loaded ? 'opacity-0' : 'opacity-100'"
      />
      <img
        :src="cover"
        :srcset="srcset"
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 30vw, 46vw"
        :alt="image.title"
        :style="aspectRatio ? { aspectRatio } : undefined"
        class="relative h-auto w-full object-cover transition-all duration-700 group-hover:scale-[1.015]"
        :class="loaded ? 'opacity-100' : 'opacity-0'"
        loading="lazy"
        decoding="async"
        @load="loaded = true"
      />

      <!-- top-right quick actions -->
      <div class="absolute right-2 top-2 flex translate-y-[-4px] gap-1.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <button
          class="grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black/35 text-white backdrop-blur-sm transition hover:bg-accent hover:text-white"
          :aria-label="favorited ? '取消收藏' : '收藏'"
          :disabled="favoriting"
          @click.stop="onFavorite"
        >
          <AppIcon name="bookmark" :size="14" :filled="favorited" />
        </button>
        <button
          class="grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black/35 text-white backdrop-blur-sm transition hover:bg-butter hover:text-[#181510]"
          aria-label="用这张做表情包"
          @click.stop="makeMeme"
        >
          <AppIcon name="sparkles" :size="14" />
        </button>
      </div>

      <button
        v-if="props.removable"
        class="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black/35 text-white opacity-0 backdrop-blur-sm transition hover:bg-accent group-hover:opacity-100"
        aria-label="从收藏夹移除"
        @click.stop="emit('remove', props.image.id)"
      >
        <AppIcon name="trash" :size="13" />
      </button>

      <span
        v-if="image.status && image.status !== 'approved'"
        class="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/55 px-2 py-1 font-mono text-[8px] uppercase tracking-wide text-white backdrop-blur-sm"
      >
        {{ image.status === 'pending' ? '审核中' : image.status === 'rejected' ? '未通过' : '已下架' }}
      </span>

      <span
        v-if="image.isFeatured"
        class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-ink/20 bg-butter px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-[#181510]"
      >
        <AppIcon name="star" :size="9" filled /> Pick
      </span>

      <!-- bottom meta on the image only for compact mode -->
      <div
        v-if="compact"
        class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-[11px] text-white"
      >
        <p class="truncate font-medium">{{ image.title }}</p>
      </div>
    </div>

    <div v-if="!compact" class="px-3 pb-3 pt-2.5">
      <div class="flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 min-w-0 text-[13.5px] font-semibold leading-snug text-ink transition group-hover:text-accent">
          {{ image.title }}
        </h3>
        <span
          v-if="favoriteCount > 0"
          class="mt-0.5 flex shrink-0 items-center gap-1 font-mono text-[10px] tabular text-muted"
        >
          <AppIcon name="bookmark" :size="11" :filled="favorited" />
          {{ favoriteCount }}
        </span>
      </div>

      <div class="mt-2 flex items-center justify-between gap-2">
        <RouterLink
          :to="`/users/${image.userId}`"
          class="flex min-w-0 items-center gap-1.5 text-[11px] text-muted no-underline transition hover:text-ink"
          @click.stop
        >
          <UiAvatar :src="image.user?.avatarUrl" :name="image.user?.username" :size="18" />
          <span class="truncate">{{ image.user?.username || '匿名' }}</span>
        </RouterLink>
        <div class="flex shrink-0 items-center gap-2.5 font-mono text-[10px] tabular text-muted">
          <span class="flex items-center gap-0.5"><AppIcon name="heart" :size="11" />{{ image.likeCount }}</span>
          <span class="flex items-center gap-0.5"><AppIcon name="eye" :size="11" />{{ image.viewCount }}</span>
        </div>
      </div>

      <div v-if="tags.length" class="mt-2 flex flex-wrap gap-1">
        <RouterLink
          v-for="tag in tags"
          :key="tag.id"
          :to="`/tags/${encodeURIComponent(tag.slug)}`"
          class="n-tag !py-0.5 !text-[9px]"
          @click.stop
        >
          #{{ tag.name }}
        </RouterLink>
      </div>
    </div>
  </article>
</template>