<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  deleteCollection,
  getCollection,
  removeImageFromCollection,
  type CollectionSummary,
} from '@/api/social'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import ImageCard from '@/components/common/ImageCard.vue'
import CollectionFormModal from '@/components/common/CollectionFormModal.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

const id = computed(() => route.params.id as string)
const showEdit = ref(false)
const showDelete = ref(false)
const removingId = ref<string | null>(null)

const { data: collection, isLoading } = useQuery({
  queryKey: ['collection', id],
  queryFn: () => getCollection(id.value).then((r) => r.data.data),
})

const isOwner = computed(() => collection.value?.isOwner || auth.user?.id === collection.value?.userId)

const removeMutation = useMutation({
  mutationFn: (imageId: string) => removeImageFromCollection(id.value, imageId),
  onMutate: (imageId) => {
    removingId.value = imageId
  },
  onSuccess: () => {
    toast.success('已从收藏夹移除')
    queryClient.invalidateQueries({ queryKey: ['collection', id.value] })
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '移除失败'),
  onSettled: () => {
    removingId.value = null
  },
})

const deleteMutation = useMutation({
  mutationFn: () => deleteCollection(id.value),
  onSuccess: () => {
    toast.success('收藏夹已删除')
    queryClient.invalidateQueries({ queryKey: ['collections'] })
    router.replace('/collections')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})

function onSaved(updated: CollectionSummary) {
  queryClient.setQueryData(['collection', id.value], (old: any) => (old ? { ...old, ...updated } : old))
  queryClient.invalidateQueries({ queryKey: ['collection', id.value] })
}
</script>

<template>
  <div>
    <div v-if="isLoading" class="n-container py-10">
      <UiSkeleton height="280px" rounded="30px" />
      <div class="mt-8 grid gap-4 sm:grid-cols-3">
        <UiSkeleton v-for="i in 6" :key="i" height="240px" rounded="22px" />
      </div>
    </div>

    <template v-else-if="collection">
      <header class="relative overflow-hidden border-b border-line">
        <div class="pointer-events-none absolute inset-0 dot-field opacity-20" />
        <div class="n-container relative grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <RouterLink to="/collections" class="mb-6 inline-flex items-center gap-1.5 text-xs text-muted no-underline transition hover:text-ink">
              <AppIcon name="arrow-left" :size="13" /> 收藏夹广场
            </RouterLink>
            <p class="eyebrow mb-3 flex items-center gap-2">
              <span class="h-1.5 w-1.5 rounded-full" :class="collection.isPublic ? 'bg-jade' : 'bg-accent'" />
              {{ collection.isPublic ? 'Public collection' : 'Private collection' }} · {{ collection.itemCount }} images
            </p>
            <h1 class="display text-[46px] leading-[0.95] text-ink sm:text-[64px]">{{ collection.name }}</h1>
            <p v-if="collection.description" class="mt-4 max-w-lg text-pretty text-sm leading-relaxed text-ink-2">
              {{ collection.description }}
            </p>
            <p v-else class="mt-4 text-sm text-muted">这个收藏夹还没有写简介。</p>

            <div class="mt-6 flex flex-wrap items-center gap-4">
              <RouterLink v-if="collection.user" :to="`/users/${collection.userId}`" class="flex items-center gap-2 no-underline">
                <UiAvatar :src="collection.user.avatarUrl" :name="collection.user.username" :size="36" />
                <span>
                  <span class="block text-sm font-semibold text-ink">{{ collection.user.username }}</span>
                  <span class="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Curator</span>
                </span>
              </RouterLink>
              <span class="h-8 w-px bg-line" />
              <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Updated {{ formatDate(collection.updatedAt) }}
              </span>
            </div>

            <div v-if="isOwner" class="mt-7 flex flex-wrap gap-2">
              <button class="n-btn n-btn-outline n-btn-sm" @click="showEdit = true">
                <AppIcon name="edit" :size="13" /> 编辑
              </button>
              <button class="n-btn n-btn-ghost n-btn-sm !text-accent" @click="showDelete = true">
                <AppIcon name="trash" :size="13" /> 删除
              </button>
              <RouterLink to="/" class="n-btn n-btn-ghost n-btn-sm no-underline">
                <AppIcon name="plus" :size="13" /> 去挑图
              </RouterLink>
            </div>
          </div>

          <div class="grid aspect-[16/11] grid-cols-2 gap-2">
            <div v-for="n in 4" :key="n" class="overflow-hidden rounded-[20px] border border-line bg-surface">
              <img
                v-if="collection.previews?.[n - 1]"
                :src="collection.previews[n - 1].thumbnailSmUrl || collection.previews[n - 1].thumbnailUrl || ''"
                :alt="collection.name"
                class="h-full w-full object-cover"
                :class="n === 1 ? 'scale-105' : ''"
              />
              <div v-else class="grid h-full w-full place-items-center bg-surface-2 text-line-strong">
                <AppIcon name="image" :size="26" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="n-container py-10 sm:py-12">
        <div v-if="collection.items.length" class="columns-2 gap-3 md:columns-3 xl:columns-4">
          <ImageCard
            v-for="image in collection.items"
            :key="image.id"
            :image="image"
            :removable="isOwner"
            :class="removingId === image.id ? 'opacity-40' : ''"
            @remove="removeMutation.mutate"
          />
        </div>

        <UiEmpty
          v-else
          title="这个收藏夹还是空的"
          description="在任意图片的详情页点「收藏到收藏夹」，就能把图放进来。"
          icon="bookmark"
        >
          <RouterLink to="/" class="n-btn n-btn-primary no-underline">去找图</RouterLink>
        </UiEmpty>
      </div>

      <CollectionFormModal v-model="showEdit" :collection="collection" @saved="onSaved" />

      <UiModal v-model="showDelete" title="删除收藏夹" width="420px">
        <p class="text-sm leading-relaxed text-ink-2">
          确定删除「{{ collection.name }}」吗？只会删除收藏夹本身，不会删除里面的图片。
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <UiButton variant="ghost" @click="showDelete = false">算了</UiButton>
          <UiButton variant="accent" :loading="deleteMutation.isPending.value" @click="deleteMutation.mutate()">确认删除</UiButton>
        </div>
      </UiModal>
    </template>

    <div v-else class="n-container py-24">
      <UiEmpty title="收藏夹不存在" description="它可能被主人删除了，或者是私密的。" icon="folder">
        <RouterLink to="/collections" class="n-btn n-btn-primary no-underline">回收藏夹广场</RouterLink>
      </UiEmpty>
    </div>
  </div>
</template>
