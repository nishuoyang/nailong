<script setup lang="ts">
import { ref, watch } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { deleteAdminComment, getAdminComments, type AdminComment } from '@/api/admin'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'

const toast = useToast()
const queryClient = useQueryClient()
const page = ref(1)
const searchInput = ref('')
const search = ref('')
const target = ref<AdminComment | null>(null)

let timer: number | undefined
watch(searchInput, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    search.value = value.trim()
    page.value = 1
  }, 300)
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-comments', page, search],
  queryFn: () =>
    getAdminComments({ page: page.value, size: 20, search: search.value || undefined }).then((r) => ({
      data: r.data.data,
      meta: r.data.meta,
    })),
  placeholderData: keepPreviousData,
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAdminComment(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    target.value = null
    toast.success('评论已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})
</script>

<template>
  <AdminShell title="评论管理" eyebrow="Comments" description="看看大家在聊什么，处理不合适的内容。">
    <div class="rounded-[24px] border border-line bg-surface">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Total <span class="text-ink">{{ data?.meta?.total ?? 0 }}</span>
        </p>
        <div class="relative w-full sm:w-72">
          <AppIcon name="search" :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input v-model="searchInput" type="search" class="h-9 w-full rounded-full border border-line bg-paper/50 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-muted focus:border-ink" placeholder="搜评论、用户或图片…" />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2 p-4">
        <div v-for="i in 5" :key="i" class="n-skeleton h-24 rounded-2xl" />
      </div>

      <div v-else-if="data?.data?.length" class="divide-y divide-line">
        <article v-for="comment in data.data" :key="comment.id" class="flex gap-3 p-4">
          <UiAvatar :src="comment.user.avatarUrl" :name="comment.user.username" :size="38" class="mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <RouterLink :to="`/users/${comment.user.id}`" class="text-[13px] font-semibold text-ink no-underline hover:text-accent">{{ comment.user.username }}</RouterLink>
              <span class="font-mono text-[9px] text-muted">{{ timeAgo(comment.createdAt) }}</span>
            </div>
            <p class="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{{ comment.content }}</p>
            <RouterLink :to="`/images/${comment.image.id}`" class="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-paper/50 p-1.5 pr-3 no-underline transition hover:border-ink/40">
              <img :src="comment.image.thumbnailSmUrl || comment.image.thumbnailUrl || ''" alt="" class="h-8 w-8 rounded-lg object-cover" loading="lazy" />
              <span class="max-w-[240px] truncate text-[10px] text-muted">{{ comment.image.title }}</span>
              <AppIcon name="arrow-up-right" :size="11" class="text-muted" />
            </RouterLink>
          </div>
          <button class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent" aria-label="删除评论" @click="target = comment">
            <AppIcon name="trash" :size="13" />
          </button>
        </article>
      </div>

      <UiEmpty v-else title="没有评论" description="换个关键词，或者等着大家开口。" icon="comment" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <span class="font-mono text-[10px] text-muted">第 {{ data.meta.page }} / {{ data.meta.totalPages }} 页</span>
      <div class="flex gap-1.5">
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page >= data.meta.totalPages" @click="page++">下一页</button>
      </div>
    </div>

    <UiModal :model-value="!!target" title="删除评论" width="420px" @update:model-value="target = null">
      <p class="text-sm leading-relaxed text-ink-2">确定删除这条评论吗？图片的评论数会同步减少。</p>
      <p v-if="target" class="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">{{ target.content }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="ghost" @click="target = null">取消</UiButton>
        <UiButton variant="accent" :loading="deleteMutation.isPending.value" @click="target && deleteMutation.mutate(target.id)">确认删除</UiButton>
      </div>
    </UiModal>
  </AdminShell>
</template>
