<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { getCollections, type CollectionSummary } from '@/api/social'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'
import CollectionCard from '@/components/common/CollectionCard.vue'
import CollectionFormModal from '@/components/common/CollectionFormModal.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const auth = useAuthStore()
const showCreate = ref(false)

const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['collections', 'public'],
  queryFn: ({ pageParam }) =>
    getCollections(pageParam as number, 12).then((r) => ({ ...r.data, page: pageParam as number })),
  initialPageParam: 1,
  getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
})

const collections = computed<CollectionSummary[]>(() => data.value?.pages.flatMap((page) => page.data) ?? [])
const total = computed(() => data.value?.pages[0]?.meta.total ?? 0)

function onSaved(collection: CollectionSummary) {
  router.push(`/collections/${collection.id}`)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Collection square"
      title="收藏夹广场"
      description="有人按主题收图，有人只是把喜欢的都扔在一起。点进去看看别人的品味。"
      :count="total"
      mark="▤"
    >
      <template #actions>
        <button v-if="auth.isLoggedIn" class="n-btn n-btn-primary" @click="showCreate = true">
          <AppIcon name="plus" :size="15" /> 新建收藏夹
        </button>
        <RouterLink v-else to="/login" class="n-btn n-btn-outline no-underline">登录后创建</RouterLink>
        <RouterLink v-if="auth.isLoggedIn" to="/profile?tab=collections" class="n-btn n-btn-ghost no-underline">
          我的收藏夹
        </RouterLink>
      </template>
    </PageHeader>

    <div class="n-container py-10 sm:py-12">
      <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="overflow-hidden rounded-[24px] border border-line bg-surface p-3">
          <div class="n-skeleton aspect-[16/10] rounded-[17px]" />
          <div class="space-y-2 px-1 pt-3">
            <div class="n-skeleton h-4 w-1/2 rounded-full" />
            <div class="n-skeleton h-3 w-1/3 rounded-full" />
          </div>
        </div>
      </div>

      <div v-else-if="collections.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CollectionCard v-for="collection in collections" :key="collection.id" :collection="collection" show-owner />
      </div>

      <UiEmpty
        v-else
        title="广场上还没有收藏夹"
        description="做第一个整理图的人。建一个收藏夹，把喜欢的图放进去。"
        icon="folder"
      >
        <button v-if="auth.isLoggedIn" class="n-btn n-btn-primary" @click="showCreate = true">新建第一个</button>
        <RouterLink v-else to="/login" class="n-btn n-btn-primary no-underline">登录后创建</RouterLink>
      </UiEmpty>

      <div v-if="collections.length" class="mt-10 flex justify-center">
        <button v-if="hasNextPage" class="n-btn n-btn-outline n-btn-lg min-w-44" :disabled="isFetchingNextPage" @click="fetchNextPage()">
          {{ isFetchingNextPage ? '加载中' : '看更多收藏夹' }}
        </button>
      </div>
    </div>

    <CollectionFormModal v-model="showCreate" @saved="onSaved" />
  </div>
</template>
