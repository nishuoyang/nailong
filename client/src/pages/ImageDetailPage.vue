<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  downloadImage,
  getImageById,
  getRelatedImages,
  likeImage,
  type ImageItem,
} from '@/api/images'
import {
  createComment,
  deleteComment,
  getComments,
  getUserProfile,
  toggleFavorite,
  toggleFollow,
  type CommentItem,
} from '@/api/social'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatCount, formatDate, timeAgo } from '@/utils/format'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import ImageLightbox from '@/components/common/ImageLightbox.vue'
import CollectionPicker from '@/components/common/CollectionPicker.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

const imageId = computed(() => route.params.id as string)
const lightboxOpen = ref(false)
const pickerOpen = ref(false)
const commentText = ref('')
const confirmingDelete = ref<string | null>(null)

const { data: image, isLoading, isError } = useQuery({
  queryKey: ['image', imageId],
  queryFn: () => getImageById(imageId.value).then((r) => r.data.data),
})

const { data: related, isLoading: relatedLoading } = useQuery({
  queryKey: ['related', imageId],
  queryFn: () => getRelatedImages(imageId.value).then((r) => r.data.data),
  enabled: computed(() => !!image.value),
})

const { data: author } = useQuery({
  queryKey: ['user-profile', computed(() => image.value?.userId || '')],
  queryFn: () => getUserProfile(image.value!.userId).then((r) => r.data.data),
  enabled: computed(() => !!image.value?.userId),
})

const commentsQuery = useInfiniteQuery({
  queryKey: computed(() => ['comments', imageId.value]),
  queryFn: ({ pageParam }) =>
    getComments(imageId.value, pageParam as number).then((r) => ({
      ...r.data,
      page: pageParam as number,
    })),
  initialPageParam: 1,
  getNextPageParam: (last) =>
    last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  enabled: computed(() => !!image.value),
})

const comments = computed<CommentItem[]>(
  () => commentsQuery.data.value?.pages.flatMap((page) => page.data) ?? [],
)
const commentTotal = computed(() => commentsQuery.data.value?.pages[0]?.meta.total ?? 0)

const detailAspect = computed(() => {
  const w = image.value?.width
  const h = image.value?.height
  return w && h ? `${w} / ${h}` : undefined
})

const isSelf = computed(() => auth.user?.id === image.value?.userId)

watch(
  () => image.value?.title,
  (title) => {
    if (title) document.title = `${title} · 奶龙宇宙`
  },
)

const likeMutation = useMutation({
  mutationFn: () => likeImage(imageId.value),
  onSuccess: (res) => {
    queryClient.setQueryData(['image', imageId.value], (old: ImageItem | undefined) =>
      old ? { ...old, isLiked: res.data.data.liked, likeCount: res.data.data.likeCount } : old,
    )
  },
  onError: () => toast.error('操作失败，稍后再试'),
})

const favoriteMutation = useMutation({
  mutationFn: () => toggleFavorite(imageId.value),
  onSuccess: (res) => {
    queryClient.setQueryData(['image', imageId.value], (old: ImageItem | undefined) =>
      old
        ? {
            ...old,
            isFavorited: res.data.data.favorited,
            favoriteCount: res.data.data.favoriteCount,
          }
        : old,
    )
    toast.success(res.data.data.favorited ? '已收进收藏夹' : '已取消收藏')
  },
  onError: () => toast.error('操作失败，稍后再试'),
})

const followMutation = useMutation({
  mutationFn: () => toggleFollow(image.value!.userId),
  onSuccess: (res) => {
    queryClient.setQueryData(
      ['user-profile', image.value!.userId],
      (old: any) =>
        old
          ? {
              ...old,
              isFollowing: res.data.data.following,
              followerCount: res.data.data.followerCount,
            }
          : old,
    )
    toast.success(res.data.data.following ? '已关注' : '已取消关注')
  },
  onError: () => toast.error('操作失败，稍后再试'),
})

const commentMutation = useMutation({
  mutationFn: (content: string) => createComment(imageId.value, content),
  onSuccess: () => {
    commentText.value = ''
    queryClient.invalidateQueries({ queryKey: ['comments', imageId.value] })
    queryClient.setQueryData(['image', imageId.value], (old: ImageItem | undefined) =>
      old ? { ...old, commentCount: (old.commentCount ?? 0) + 1 } : old,
    )
    toast.success('评论已发布')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '评论发布失败'),
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteComment(id),
  onSuccess: () => {
    confirmingDelete.value = null
    queryClient.invalidateQueries({ queryKey: ['comments', imageId.value] })
    queryClient.setQueryData(['image', imageId.value], (old: ImageItem | undefined) =>
      old ? { ...old, commentCount: Math.max(0, (old.commentCount ?? 0) - 1) } : old,
    )
    toast.success('评论已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})

const downloadMutation = useMutation({
  mutationFn: () => downloadImage(imageId.value),
  onSuccess: () => {
    const anchor = document.createElement('a')
    anchor.href = `/api/images/${imageId.value}/file`
    anchor.download = ''
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    queryClient.setQueryData(['image', imageId.value], (old: ImageItem | undefined) =>
      old ? { ...old, downloadCount: (old.downloadCount ?? 0) + 1 } : old,
    )
    toast.success('开始下载原图')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '下载失败'),
})

function requireLogin(): boolean {
  if (auth.isLoggedIn) return true
  toast.warning('先登录一下')
  router.push({ name: 'login', query: { redirect: route.fullPath } })
  return false
}

function handleLike() {
  if (!requireLogin()) return
  likeMutation.mutate()
}

function handleFavorite() {
  if (!requireLogin()) return
  favoriteMutation.mutate()
}

function handleDownload() {
  if (!requireLogin()) return
  downloadMutation.mutate()
}

function handleFollow() {
  if (!requireLogin()) return
  followMutation.mutate()
}

function submitComment() {
  if (!requireLogin()) return
  const content = commentText.value.trim()
  if (!content) return
  if (content.length > 500) {
    toast.warning('评论最多 500 字')
    return
  }
  commentMutation.mutate(content)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('链接已复制')
  } catch {
    toast.warning('复制失败，请手动复制地址栏链接')
  }
}

async function share() {
  if (navigator.share) {
    try {
      await navigator.share({ title: image.value?.title, url: window.location.href })
      return
    } catch {
      /* user cancelled */
    }
  }
  await copyLink()
}

function makeMeme() {
  router.push({ name: 'studio', query: { image: imageId.value } })
}

function openPicker() {
  if (!requireLogin()) return
  pickerOpen.value = true
}

function onComposerKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    submitComment()
  }
}
</script>

<template>
  <div class="n-container py-5 sm:py-8">
    <div class="mb-5 flex items-center justify-between gap-3">
      <button class="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-ink" @click="router.back()">
        <AppIcon name="arrow-left" :size="14" /> 返回
      </button>
      <div class="flex items-center gap-1.5">
        <button class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" aria-label="复制链接" @click="copyLink">
          <AppIcon name="link" :size="15" />
        </button>
        <button class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" aria-label="分享" @click="share">
          <AppIcon name="share" :size="15" />
        </button>
      </div>
    </div>

    <!-- loading -->
    <div v-if="isLoading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <UiSkeleton height="62vh" rounded="26px" />
      <div class="space-y-4">
        <UiSkeleton width="30%" height="14px" />
        <UiSkeleton width="85%" height="42px" />
        <UiSkeleton width="60%" height="18px" />
        <UiSkeleton height="96px" rounded="20px" />
        <UiSkeleton height="52px" rounded="999px" />
      </div>
    </div>

    <div v-else-if="isError || !image" class="mx-auto max-w-md py-24 text-center">
      <div class="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[28px] border border-line bg-surface-2 text-accent">
        <AppIcon name="image" :size="34" />
      </div>
      <h1 class="font-display text-4xl text-ink">这张图不在了</h1>
      <p class="mt-3 text-sm text-muted">可能被作者删除、还没有通过审核，或者链接写错了。</p>
      <RouterLink to="/" class="n-btn n-btn-primary mt-7 no-underline">回到发现页</RouterLink>
    </div>

    <template v-else>
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_370px] xl:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <!-- image stage -->
        <div>
          <div
            class="group relative overflow-hidden rounded-[28px] border border-line"
            :style="{ backgroundColor: image.dominantColor || 'var(--surface-2)' }"
          >
            <div class="pointer-events-none absolute inset-0 dot-field opacity-20" />
            <div class="relative flex min-h-[38vh] items-center justify-center p-3 sm:p-6">
              <img
                :src="image.thumbnailUrl || image.url"
                :alt="image.title"
                :style="detailAspect ? { aspectRatio: detailAspect } : undefined"
                class="max-h-[72vh] max-w-full cursor-zoom-in rounded-[16px] object-contain shadow-[0_20px_60px_-30px_rgba(20,15,8,.6)] transition duration-500 group-hover:scale-[1.005] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                decoding="async"
                fetchpriority="high"
                tabindex="0"
                role="button"
                aria-label="查看大图"
                @click="lightboxOpen = true"
                @keydown.enter.prevent="lightboxOpen = true"
              />
              <span class="absolute bottom-5 right-5 hidden items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white backdrop-blur-sm group-hover:flex">
                <AppIcon name="zoom" :size="12" /> 点击看大图
              </span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted">
            <span class="font-mono">{{ image.width && image.height ? `${image.width} × ${image.height}` : '原图尺寸未知' }}</span>
            <span>{{ formatDate(image.createdAt) }} 发布</span>
          </div>
        </div>

        <!-- info rail -->
        <aside class="lg:sticky lg:top-28">
          <div class="rounded-[26px] border border-line bg-surface p-5 sm:p-6">
            <div class="mb-4 flex flex-wrap items-center gap-1.5">
              <span v-for="cat in image.categories" :key="cat.id" class="n-tag !border-jade/30 !bg-jade/10 !text-jade">#{{ cat.name }}</span>
              <span v-if="image.isFeatured" class="n-tag !border-butter !bg-butter/20 !text-ink">✦ 精选</span>
            </div>

            <h1 class="display text-[34px] leading-[1.02] text-ink sm:text-[42px]">{{ image.title }}</h1>
            <p v-if="image.description" class="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-2">
              {{ image.description }}
            </p>

            <div class="mt-5 flex items-center justify-between gap-3 border-y border-line py-4">
              <RouterLink :to="`/users/${image.userId}`" class="flex min-w-0 items-center gap-2.5 no-underline">
                <UiAvatar :src="image.user?.avatarUrl" :name="image.user?.username" :size="42" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-ink">{{ image.user?.username }}</p>
                  <p class="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    {{ author ? `${formatCount(author.followerCount)} followers · ${author.imageCount} works` : 'Creator' }}
                  </p>
                </div>
              </RouterLink>
              <button
                v-if="!isSelf"
                class="n-btn n-btn-sm shrink-0"
                :class="author?.isFollowing ? 'n-btn-outline' : 'n-btn-primary'"
                :disabled="followMutation.isPending.value"
                @click="handleFollow"
              >
                <AppIcon :name="author?.isFollowing ? 'check' : 'plus'" :size="13" />
                {{ author?.isFollowing ? '已关注' : '关注' }}
              </button>
            </div>

            <div class="mt-4 grid grid-cols-4 divide-x divide-line text-center">
              <div class="px-1">
                <p class="font-display text-xl tabular text-ink">{{ formatCount(image.likeCount) }}</p>
                <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">喜欢</p>
              </div>
              <div class="px-1">
                <p class="font-display text-xl tabular text-ink">{{ formatCount(image.viewCount) }}</p>
                <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">浏览</p>
              </div>
              <div class="px-1">
                <p class="font-display text-xl tabular text-ink">{{ formatCount(image.downloadCount) }}</p>
                <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">下载</p>
              </div>
              <div class="px-1">
                <p class="font-display text-xl tabular text-ink">{{ formatCount(image.commentCount) }}</p>
                <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">评论</p>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-2">
              <button
                class="n-btn"
                :class="image.isLiked ? 'n-btn-accent' : 'n-btn-primary'"
                :disabled="likeMutation.isPending.value"
                @click="handleLike"
              >
                <AppIcon name="heart" :size="16" :filled="image.isLiked" />
                {{ image.isLiked ? '已喜欢' : '喜欢' }}
              </button>
              <button
                class="n-btn"
                :class="image.isFavorited ? 'n-btn-outline !border-jade !text-jade' : 'n-btn-outline'"
                :disabled="favoriteMutation.isPending.value"
                @click="handleFavorite"
              >
                <AppIcon name="bookmark" :size="16" :filled="image.isFavorited" />
                {{ image.isFavorited ? '已收藏' : '收藏' }}
              </button>
              <button class="n-btn n-btn-outline" :disabled="downloadMutation.isPending.value" @click="handleDownload">
                <AppIcon name="download" :size="16" /> 下载原图
              </button>
              <button class="n-btn n-btn-outline !border-butter !bg-butter/20 !text-ink hover:!bg-butter" @click="makeMeme">
                <AppIcon name="sparkles" :size="16" /> 做表情包
              </button>
            </div>

            <button
              class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[11px] text-muted transition hover:bg-surface-2 hover:text-ink"
              @click="openPicker"
            >
              <AppIcon name="folder" :size="13" /> 收藏到收藏夹
            </button>

            <div v-if="image.tags?.length" class="mt-4 flex flex-wrap gap-1.5">
              <RouterLink
                v-for="tagItem in image.tags"
                :key="tagItem.id"
                :to="`/tags/${encodeURIComponent(tagItem.slug)}`"
                class="n-tag"
              >
                #{{ tagItem.name }}
              </RouterLink>
            </div>

            <p class="mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Uploaded {{ timeAgo(image.createdAt) }} · ID {{ image.id.slice(0, 8) }}
            </p>
          </div>

          <div class="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-[11px] text-muted">
            <AppIcon name="info" :size="14" class="shrink-0 text-accent" />
            图片版权归原作者所有，转载请注明出处。
          </div>
        </aside>
      </div>

      <!-- comments -->
      <section class="mt-14 max-w-4xl">
        <div class="mb-5 flex items-end justify-between gap-4">
          <div>
            <p class="eyebrow mb-2">Comments</p>
            <h2 class="display text-[30px] text-ink">
              聊两句
              <span class="ml-1 align-super font-mono text-[10px] font-normal text-muted">{{ commentTotal }}</span>
            </h2>
          </div>
        </div>

        <div class="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
          <div class="flex gap-3">
            <UiAvatar :src="auth.user?.avatarUrl" :name="auth.user?.username || '?'" :size="38" class="mt-0.5" />
            <div class="min-w-0 flex-1">
              <textarea
                v-model="commentText"
                rows="3"
                maxlength="500"
                class="w-full resize-none rounded-2xl border border-line bg-paper/60 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink"
                :placeholder="auth.isLoggedIn ? '说点什么…（Ctrl + Enter 发送）' : '登录后就可以评论了'"
                aria-label="评论内容"
                :disabled="!auth.isLoggedIn"
                @keydown="onComposerKeydown"
              />
              <div class="mt-2 flex items-center justify-between gap-3">
                <span class="font-mono text-[9px] text-muted">{{ commentText.length }} / 500</span>
                <button
                  class="n-btn n-btn-primary n-btn-sm"
                  :disabled="!auth.isLoggedIn || commentMutation.isPending.value || !commentText.trim()"
                  @click="submitComment"
                >
                  <AppIcon name="send" :size="13" />
                  {{ commentMutation.isPending.value ? '发送中' : '发送' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="commentsQuery.isLoading.value" class="mt-5 space-y-3">
          <UiSkeleton v-for="i in 3" :key="i" height="86px" rounded="20px" />
        </div>

        <div v-else-if="comments.length === 0" class="mt-5 rounded-[24px] border border-dashed border-line px-6 py-12 text-center">
          <p class="font-display text-2xl text-ink">还没有人说话</p>
          <p class="mt-2 text-sm text-muted">第一条评论，留给你。</p>
        </div>

        <div v-else class="mt-5 space-y-3">
          <article v-for="comment in comments" :key="comment.id" class="group flex gap-3 rounded-[20px] border border-line bg-surface p-4">
            <RouterLink :to="`/users/${comment.userId}`" class="shrink-0">
              <UiAvatar :src="comment.user.avatarUrl" :name="comment.user.username" :size="38" />
            </RouterLink>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <RouterLink :to="`/users/${comment.userId}`" class="text-[13px] font-semibold text-ink no-underline hover:text-accent">
                  {{ comment.user.username }}
                </RouterLink>
                <span class="font-mono text-[9px] text-muted">{{ timeAgo(comment.createdAt) }}</span>
              </div>
              <p class="mt-1.5 whitespace-pre-line text-pretty text-[13.5px] leading-relaxed text-ink-2">{{ comment.content }}</p>
            </div>
            <div v-if="comment.canDelete" class="shrink-0">
              <template v-if="confirmingDelete === comment.id">
                <div class="flex flex-col items-end gap-1">
                  <button class="text-[11px] font-medium text-accent" :disabled="deleteMutation.isPending.value" @click="deleteMutation.mutate(comment.id)">确认删除</button>
                  <button class="text-[10px] text-muted" @click="confirmingDelete = null">取消</button>
                </div>
              </template>
              <button
                v-else
                class="grid h-7 w-7 place-items-center rounded-full text-muted opacity-0 transition hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                aria-label="删除评论"
                @click="confirmingDelete = comment.id"
              >
                <AppIcon name="trash" :size="13" />
              </button>
            </div>
          </article>

          <div v-if="commentsQuery.hasNextPage.value" class="flex justify-center pt-2">
            <button class="n-btn n-btn-outline n-btn-sm" :disabled="commentsQuery.isFetchingNextPage.value" @click="commentsQuery.fetchNextPage()">
              {{ commentsQuery.isFetchingNextPage.value ? '加载中' : '加载更多评论' }}
            </button>
          </div>
        </div>
      </section>

      <!-- related -->
      <section v-if="related?.length || relatedLoading" class="mt-16">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <p class="eyebrow mb-2">More like this</p>
            <h2 class="display text-[32px] text-ink">你可能还喜欢</h2>
          </div>
          <RouterLink to="/" class="n-btn n-btn-ghost n-btn-sm no-underline">继续逛 <AppIcon name="arrow-right" :size="13" /></RouterLink>
        </div>
        <ImageGrid :images="related ?? []" :loading="relatedLoading" :skeleton-count="4" />
      </section>
    </template>

    <CollectionPicker v-if="image" v-model="pickerOpen" :image-id="image.id" />

    <ImageLightbox
      v-if="image"
      v-model="lightboxOpen"
      :src="image.thumbnailUrl || image.url"
      :alt="image.title"
      :title="image.title"
    >
      <button class="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-4 text-xs text-white/80 transition hover:border-white/60 hover:text-white" @click="handleDownload">
        <AppIcon name="download" :size="14" /> 下载原图
      </button>
      <button class="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-4 text-xs text-white/80 transition hover:border-white/60 hover:text-white" @click="makeMeme">
        <AppIcon name="sparkles" :size="14" /> 做表情包
      </button>
    </ImageLightbox>
  </div>
</template>