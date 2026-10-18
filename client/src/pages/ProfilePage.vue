<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getMe } from '@/api/auth'
import {
  getMyCollections,
  getMyFavorites,
  getMyImages,
  getUserProfile,
  updateBio,
  type CollectionSummary,
} from '@/api/social'
import type { ImageItem } from '@/api/images'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import ProfileHeader from '@/components/common/ProfileHeader.vue'
import ImageGrid from '@/components/common/ImageGrid.vue'
import CollectionCard from '@/components/common/CollectionCard.vue'
import CollectionFormModal from '@/components/common/CollectionFormModal.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()

const tab = computed(() => {
  const value = route.query.tab
  return value === 'favorites' || value === 'collections' ? value : 'works'
})

const { data: me } = useQuery({
  queryKey: ['me'],
  queryFn: () => getMe().then((r) => r.data.data),
})

const userId = computed(() => auth.user?.id || '')
const { data: profile } = useQuery({
  queryKey: ['user-profile', userId],
  queryFn: () => getUserProfile(userId.value).then((r) => r.data.data),
  enabled: computed(() => !!userId.value),
})

const { data: imagePages, isLoading: worksLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['my-images'],
  queryFn: ({ pageParam }) =>
    getMyImages(pageParam as number, 24).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const { data: favoritePages, isLoading: favoritesLoading } = useInfiniteQuery({
  queryKey: ['my-favorites'],
  queryFn: ({ pageParam }) =>
    getMyFavorites(pageParam as number, 24).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const { data: collections, isLoading: collectionsLoading } = useQuery({
  queryKey: ['my-collections'],
  queryFn: () => getMyCollections().then((r) => r.data.data),
})

const works = computed<ImageItem[]>(() => imagePages.value?.pages.flatMap((page) => page.data) ?? [])
const favorites = computed<ImageItem[]>(() => favoritePages.value?.pages.flatMap((page) => page.data) ?? [])
const collectionList = computed<CollectionSummary[]>(() => collections.value ?? [])
const workTotal = computed(() => imagePages.value?.pages[0]?.meta.total ?? 0)
const favoriteTotal = computed(() => favoritePages.value?.pages[0]?.meta.total ?? 0)

const showBio = ref(false)
const showCreate = ref(false)
const bioText = ref('')

const bioMutation = useMutation({
  mutationFn: (bio: string) => updateBio(bio),
  onSuccess: (res) => {
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId.value] })
    toast.success(res.data.data.bioStatus === 'pending' ? '已保存，等待管理员审核' : '简介已更新')
    showBio.value = false
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '保存失败'),
})

function openBio() {
  bioText.value = me.value?.bio || ''
  showBio.value = true
}

function saveBio() {
  if (bioText.value.length > 500) {
    toast.warning('简介最多 500 字')
    return
  }
  bioMutation.mutate(bioText.value)
}

function setTab(value: string) {
  router.replace({ query: { ...route.query, tab: value === 'works' ? undefined : value } })
}

function onCollectionSaved(collection: CollectionSummary) {
  queryClient.invalidateQueries({ queryKey: ['my-collections'] })
  router.push(`/collections/${collection.id}`)
}
</script>

<template>
  <div>
    <ProfileHeader
      :name="me?.username"
      :avatar-url="me?.avatarUrl"
      :bio="me?.bio"
      :bio-pending="me?.bioStatus === 'pending'"
      :role="me?.role"
      :joined-at="me?.createdAt"
      :works="profile?.imageCount ?? workTotal"
      :followers="profile?.followerCount ?? 0"
      :following="profile?.followingCount ?? 0"
      :likes="profile?.totalLikes ?? 0"
    >
      <template #under-bio>
        <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{{ me?.email }}</p>
      </template>
      <template #actions>
        <button class="n-btn n-btn-outline" @click="openBio">
          <AppIcon name="edit" :size="14" /> 编辑简介
        </button>
        <RouterLink to="/upload" class="n-btn n-btn-primary no-underline">
          <AppIcon name="plus" :size="15" /> 投稿
        </RouterLink>
      </template>
    </ProfileHeader>

    <div class="n-container py-8 sm:py-10">
      <div class="mb-8 flex items-center gap-1 overflow-x-auto border-b border-line no-scrollbar">
        <button
          v-for="item in [
            { value: 'works', label: '我的作品', count: workTotal },
            { value: 'favorites', label: '收藏的图', count: favoriteTotal },
            { value: 'collections', label: '收藏夹', count: collectionList.length },
          ]"
          :key="item.value"
          class="relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition"
          :class="tab === item.value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'"
          @click="setTab(item.value)"
        >
          {{ item.label }} <span class="font-mono text-[10px] opacity-50">{{ item.count }}</span>
        </button>
      </div>

      <template v-if="tab === 'works'">
        <ImageGrid :images="works" :loading="worksLoading" :skeleton-count="8">
          <template #empty>
            <UiEmpty title="还没投过稿" description="把你收藏的好图放进来，通过审核后就会出现在这里。" icon="image">
              <RouterLink to="/upload" class="n-btn n-btn-primary no-underline">去投稿</RouterLink>
            </UiEmpty>
          </template>
        </ImageGrid>
        <div v-if="works.length && hasNextPage" class="mt-10 flex justify-center">
          <button class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
            {{ isFetchingNextPage ? '加载中' : '加载更多' }}
          </button>
        </div>
      </template>

      <template v-else-if="tab === 'favorites'">
        <ImageGrid :images="favorites" :loading="favoritesLoading" :skeleton-count="8">
          <template #empty>
            <UiEmpty title="还没有收藏" description="在图片卡片或详情页点一下书签，图就会出现在这里。" icon="bookmark">
              <RouterLink to="/" class="n-btn n-btn-primary no-underline">去逛逛</RouterLink>
            </UiEmpty>
          </template>
        </ImageGrid>
      </template>

      <template v-else>
        <div class="mb-5 flex items-center justify-between gap-3">
          <p class="text-sm text-muted">收藏夹可以公开，也可以只给自己看。</p>
          <button class="n-btn n-btn-primary n-btn-sm" @click="showCreate = true">
            <AppIcon name="plus" :size="13" /> 新建
          </button>
        </div>
        <div v-if="collectionsLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 3" :key="i" class="n-skeleton h-64 rounded-[24px]" />
        </div>
        <div v-else-if="collectionList.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CollectionCard v-for="collection in collectionList" :key="collection.id" :collection="collection" />
        </div>
        <UiEmpty v-else title="还没有收藏夹" description="按主题整理图片：奶龙、名场面、配色灵感，随便你。" icon="folder">
          <button class="n-btn n-btn-primary" @click="showCreate = true">新建收藏夹</button>
        </UiEmpty>
      </template>
    </div>

    <UiModal v-model="showBio" title="编辑个人简介" width="520px">
      <p class="mb-4 text-xs leading-relaxed text-muted">
        保存后需要管理员审核才会公开显示。审核期间，访客看到的仍是上一版。
      </p>
      <textarea
        v-model="bioText"
        rows="5"
        maxlength="500"
        class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-ink"
        placeholder="介绍一下自己…"
      />
      <div class="mt-1 text-right font-mono text-[9px] text-muted">{{ bioText.length }} / 500</div>
      <div class="mt-4 flex justify-end gap-2">
        <UiButton variant="ghost" @click="showBio = false">取消</UiButton>
        <UiButton variant="primary" :loading="bioMutation.isPending.value" @click="saveBio">保存</UiButton>
      </div>
    </UiModal>

    <CollectionFormModal v-model="showCreate" @saved="onCollectionSaved" />
  </div>
</template>
