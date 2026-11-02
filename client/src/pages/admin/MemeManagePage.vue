<script setup lang="ts">
import { ref, watch } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { deleteAdminMeme, getAdminMemes, updateMemeStatus, type AdminMemeItem } from '@/api/admin'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'

const toast = useToast()
const queryClient = useQueryClient()
const page = ref(1)
const searchInput = ref('')
const search = ref('')
const statusFilter = ref('')
const target = ref<AdminMemeItem | null>(null)

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '未通过' },
  { key: 'offline', label: '已下架' },
]

const MOOD_LABELS: Record<string, string> = {
  fish: '摸鱼',
  work: '打工',
  break: '破防',
  night: '深夜',
  cute: '可爱',
}

// 与后端状态机一致：pending → approved/rejected；approved ↔ offline
const transitions: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['offline'],
  rejected: [],
  offline: ['approved'],
}

const actionLabel: Record<string, string> = {
  approved: '通过',
  rejected: '拒绝',
  offline: '下架',
}

let timer: number | undefined
watch(searchInput, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    search.value = value.trim()
    page.value = 1
  }, 300)
})

watch(statusFilter, () => {
  page.value = 1
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-memes', page, search, statusFilter],
  queryFn: () =>
    getAdminMemes({
      page: page.value,
      size: 20,
      search: search.value || undefined,
      status: statusFilter.value || undefined,
    }).then((r) => ({ data: r.data.data, meta: r.data.meta })),
  placeholderData: keepPreviousData,
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) => updateMemeStatus(id, status),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['admin-memes'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    queryClient.invalidateQueries({ queryKey: ['whale-memes'] })
    toast.success(variables.status === 'approved' ? '已通过' : variables.status === 'rejected' ? '已拒绝' : '状态已更新')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAdminMeme(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-memes'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    queryClient.invalidateQueries({ queryKey: ['whale-memes'] })
    target.value = null
    toast.success('表情包已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})
</script>

<template>
  <AdminShell title="表情包审核" eyebrow="Memes" description="管理大肥鱼鱼塘：过目用户的投喂，随时上下架。">
    <div class="rounded-[24px] border border-line bg-surface">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.key"
            class="rounded-full border px-3 py-1.5 text-[11px] transition"
            :class="
              statusFilter === tab.key
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-paper/50 text-ink-2 hover:border-ink/50 hover:text-ink'
            "
            type="button"
            @click="statusFilter = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="relative w-full sm:w-72">
          <AppIcon name="search" :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            v-model="searchInput"
            type="search"
            class="h-9 w-full rounded-full border border-line bg-paper/50 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-muted focus:border-ink"
            placeholder="搜标题、备注、编号或用户…"
          />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2 p-4">
        <div v-for="i in 5" :key="i" class="n-skeleton h-24 rounded-2xl" />
      </div>

      <div v-else-if="data?.data?.length" class="divide-y divide-line">
        <article v-for="meme in data.data" :key="meme.id" class="flex gap-3 p-4">
          <img
            :src="meme.url"
            :alt="meme.title"
            class="h-20 w-20 shrink-0 rounded-2xl border border-line bg-white object-contain"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p class="text-[13px] font-semibold text-ink">{{ meme.title }}</p>
              <span class="rounded-full border border-line bg-paper/50 px-2 py-0.5 font-mono text-[9px] text-muted">{{ meme.code }}</span>
              <span class="rounded-full border border-line bg-paper/50 px-2 py-0.5 text-[9px] text-ink-2">
                {{ MOOD_LABELS[meme.mood] ?? meme.mood }}
              </span>
              <span
                class="rounded-full border px-2 py-0.5 text-[9px]"
                :class="
                  meme.status === 'approved'
                    ? 'border-jade/40 bg-jade/15 text-jade'
                    : meme.status === 'pending'
                      ? 'border-[#ffd84d]/50 bg-[#ffd84d]/20 text-[#8a6a00]'
                      : 'border-ink/25 bg-ink/10 text-ink-2'
                "
              >
                {{ STATUS_TABS.find((t) => t.key === meme.status)?.label ?? meme.status }}
              </span>
            </div>
            <p v-if="meme.note" class="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">{{ meme.note }}</p>
            <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] text-muted">
              <span v-if="meme.user">by {{ meme.user.username }}</span>
              <span>{{ timeAgo(meme.createdAt) }}</span>
              <span v-if="meme.tags.length">#{{ meme.tags.join(' #') }}</span>
              <span v-if="meme.source === 'archive'">· 合集归档</span>
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <template v-for="next in transitions[meme.status] ?? []" :key="next">
                <UiButton
                  size="sm"
                  :variant="next === 'approved' ? 'primary' : 'outline'"
                  :disabled="statusMutation.isPending.value"
                  @click="statusMutation.mutate({ id: meme.id, status: next })"
                >
                  {{ actionLabel[next] ?? next }}
                </UiButton>
              </template>
              <UiButton size="sm" variant="ghost" @click="target = meme">
                <AppIcon name="trash" :size="13" /> 删除
              </UiButton>
            </div>
          </div>
        </article>
      </div>

      <UiEmpty v-else title="没有表情包" description="换个筛选或关键词试试。" icon="image" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <span class="font-mono text-[10px] text-muted">第 {{ data.meta.page }} / {{ data.meta.totalPages }} 页</span>
      <div class="flex gap-1.5">
        <UiButton size="sm" variant="outline" :disabled="page <= 1" @click="page--">上一页</UiButton>
        <UiButton size="sm" variant="outline" :disabled="page >= data.meta.totalPages" @click="page++">下一页</UiButton>
      </div>
    </div>

    <UiModal :model-value="Boolean(target)" title="删除表情包？" width="420px" @update:model-value="!$event && (target = null)">
      <p class="text-sm leading-relaxed text-ink-2">
        确定要删除「{{ target?.title }}」吗？用户投喂的连带 MinIO 文件一起清掉，合集归档条目只删记录。
        此操作不可撤销。
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="outline" @click="target = null">再想想</UiButton>
        <UiButton
          variant="accent"
          :loading="deleteMutation.isPending.value"
          @click="target && deleteMutation.mutate(target.id)"
        >
          确认删除
        </UiButton>
      </div>
    </UiModal>
  </AdminShell>
</template>
