<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getUserImages, getUserProfile, getUserCollections, toggleFollow, type CollectionSummary } from '@/api/social'
import type { ImageItem } from '@/api/images'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import ProfileHeader from '@/components/common/ProfileHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import CollectionCard from '@/components/common/CollectionCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

const id = computed(() => route.params.id as string)
const tab = computed(() => ((route.query.tab as string) === 'collections' ? 'collections' : 'works'))

const { data: profile, isLoading: profileLoading } = useQuery({
  queryKey: ['user-profile', id],
  queryFn: () => getUserProfile(id.value).then((r) => r.data.data),
})

const { data: imagePages, isLoading: imagesLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: computed(() => ['user-images', id.value]),
  queryFn: ({ pageParam }) =>
    getUserImages(id.value, pageParam as number, 24).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const { data: collections, isLoading: collectionsLoading } = useQuery({
  queryKey: ['user-collections', id],
  queryFn: () => getUserCollections(id.value).then((r) => r.data.data),
})

const images = computed<ImageItem[]>(() => imagePages.value?.pages.flatMap((page) => page.data) ?? [])
const collectionList = computed<CollectionSummary[]>(() => collections.value ?? [])

const followMutation = useMutation({
  mutationFn: () => toggleFollow(id.value),
  onSuccess: (res) => {
    queryClient.setQueryData(['user-profile', id.value], (old: any) =>
      old
        ? { ...old, isFollowing: res.data.data.following, followerCount: res.data.data.followerCount }
        : old,
    )
    toast.success(res.data.data.following ? `已关注 ${profile.value?.username}` : '已取消关注')
  },
  onError: () => toast.error('操作失败，稍后再试'),
})

function handleFollow() {
  if (!auth.isLoggedIn) {
    toast.warning('登录后才能关注')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  followMutation.mutate()
}

async function copyProfile() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('主页链接已复制')
  } catch {
    toast.warning('复制失败')
  }
}
</script>

<template>
  <div v-if="profileLoading" class="n-container py-16">
    <div class="flex items-center gap-6">
      <div class="n-skeleton h-24 w-24 rounded-[28px]" />
      <div class="space-y-3">
        <div class="n-skeleton h-10 w-56 rounded-full" />
        <div class="n-skeleton h-4 w-72 rounded-full" />
      </div>
    </div>
  </div>

  <div v-else-if="!profile" class="n-container py-24">
    <UiEmpty title="找不到这个用户" description="可能改名了，或者从来没有存在过。" icon="user">
      <RouterLink to="/" class="n-btn n-btn-primary no-underline">回首页</RouterLink>
    </UiEmpty>
  </div>

  <div v-else>
    <ProfileHeader
      :name="profile.username"
      :avatar-url="profile.avatarUrl"
      :bio="profile.bio"
      :role="profile.role"
      :joined-at="profile.createdAt"
      :works="profile.imageCount"
      :followers="profile.followerCount"
      :following="profile.followingCount"
      :likes="profile.totalLikes"
    >
      <template #actions>
        <template v-if="profile.isSelf">
          <RouterLink to="/profile" class="n-btn n-btn-primary no-underline">
            <AppIcon name="edit" :size="14" /> 编辑资料
          </RouterLink>
        </template>
        <template v-else>
          <button
            class="n-btn"
            :class="profile.isFollowing ? 'n-btn-outline' : 'n-btn-primary'"
            :disabled="followMutation.isPending.value"
            @click="handleFollow"
          >
            <AppIcon :name="profile.isFollowing ? 'check' : 'plus'" :size="15" />
            {{ profile.isFollowing ? '已关注' : '关注' }}
          </button>
        </template>
        <button class="n-btn n-btn-ghost" @click="copyProfile">
          <AppIcon name="share" :size="15" /> 分享
        </button>
      </template>
    </ProfileHeader>

    <div class="n-container py-8 sm:py-10">
      <div class="mb-8 flex items-center gap-1 border-b border-line">
        <button
          class="relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition"
          :class="tab === 'works' ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'"
          @click="router.replace({ query: { ...route.query, tab: undefined } })"
        >
          作品 <span class="font-mono text-[10px] opacity-50">{{ profile.imageCount }}</span>
        </button>
        <button
          class="relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition"
          :class="tab === 'collections' ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'"
          @click="router.replace({ query: { ...route.query, tab: 'collections' } })"
        >
          收藏夹 <span class="font-mono text-[10px] opacity-50">{{ collectionList.length }}</span>
        </button>
      </div>

      <template v-if="tab === 'works'">
        <ImageGrid :images="images" :loading="imagesLoading" :skeleton-count="8">
          <template #empty>
            <UiEmpty title="还没有作品" description="这位创作者还在酝酿第一张图。" icon="image" />
          </template>
        </ImageGrid>
        <div v-if="images.length && hasNextPage" class="mt-10 flex justify-center">
          <button class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
            {{ isFetchingNextPage ? '加载中' : '加载更多' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div v-if="collectionsLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 3" :key="i" class="n-skeleton h-64 rounded-[24px]" />
        </div>
        <div v-else-if="collectionList.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CollectionCard v-for="collection in collectionList" :key="collection.id" :collection="collection" />
        </div>
        <UiEmpty v-else title="还没有公开收藏夹" description="收藏夹可以是私密的，主人没有公开的话就看不到。" icon="folder" />
      </template>
    </div>
  </div>
</template>