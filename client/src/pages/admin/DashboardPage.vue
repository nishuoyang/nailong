<script setup lang="ts">
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { deleteAdminComment, getAdminComments, getAdminImages, getAdminStats, updateImageStatus } from '@/api/admin'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'

const toast = useToast()
const queryClient = useQueryClient()

const { data: stats } = useQuery({
  queryKey: ['admin-stats'],
  queryFn: () => getAdminStats().then((r) => r.data.data),
  staleTime: 30_000,
})

const { data: pending, isLoading: pendingLoading } = useQuery({
  queryKey: ['admin-images', 'pending', 'dashboard'],
  queryFn: () => getAdminImages({ status: 'pending', size: 5 }).then((r) => r.data.data),
})

const { data: recentComments } = useQuery({
  queryKey: ['admin-comments', 'dashboard'],
  queryFn: () => getAdminComments({ page: 1, size: 5 }).then((r) => r.data.data),
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) => updateImageStatus(id, status),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    toast.success(variables.status === 'approved' ? '已通过' : '已拒绝')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})

const commentDelete = useMutation({
  mutationFn: (id: string) => deleteAdminComment(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    toast.success('评论已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})

const composition = computed(() => {
  const s = stats.value
  if (!s) return []
  const total = Math.max(1, s.approved + s.pending + s.rejected + s.offline)
  return [
    { label: '已通过', value: s.approved, color: 'bg-jade' },
    { label: '待审核', value: s.pending, color: 'bg-butter' },
    { label: '已下架', value: s.offline, color: 'bg-line-strong' },
    { label: '已拒绝', value: s.rejected, color: 'bg-accent' },
  ].map((item) => ({ ...item, percent: (item.value / total) * 100 }))
})

const statCards = computed(() => [
  { label: '待审核', value: stats.value?.pending ?? 0, icon: 'clock', tone: 'bg-butter/40 text-ink', hint: '需要你处理' },
  { label: '已通过', value: stats.value?.approved ?? 0, icon: 'check', tone: 'bg-jade/12 text-jade', hint: `今日 +${stats.value?.todayUploads ?? 0}` },
  { label: '注册用户', value: stats.value?.users ?? 0, icon: 'users', tone: 'bg-sky/12 text-sky', hint: '站内成员' },
  { label: '评论', value: stats.value?.comments ?? 0, icon: 'comment', tone: 'bg-accent/10 text-accent', hint: `收藏 ${stats.value?.favorites ?? 0}` },
])
</script>

<template>
  <AdminShell title="概览" eyebrow="Overview" description="今天要处理什么，一眼看完。">
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div v-for="card in statCards" :key="card.label" class="rounded-[22px] border border-line bg-surface p-4">
        <div class="flex items-start justify-between">
          <span class="grid h-9 w-9 place-items-center rounded-xl" :class="card.tone"><AppIcon :name="card.icon" :size="17" /></span>
          <span class="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{{ card.hint }}</span>
        </div>
        <p class="mt-4 font-display text-[36px] leading-none tabular text-ink">{{ card.value }}</p>
        <p class="mt-1.5 text-[11px] text-muted">{{ card.label }}</p>
      </div>
    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <!-- review queue -->
      <section class="rounded-[24px] border border-line bg-surface">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p class="eyebrow mb-1.5">Review queue</p>
            <h2 class="font-display text-[26px] leading-none text-ink">待审核图片</h2>
          </div>
          <RouterLink to="/admin/images?status=pending" class="n-btn n-btn-outline n-btn-sm no-underline">
            全部 <AppIcon name="arrow-right" :size="12" />
          </RouterLink>
        </div>

        <div v-if="pendingLoading" class="space-y-2 p-4">
          <div v-for="i in 3" :key="i" class="n-skeleton h-20 rounded-2xl" />
        </div>

        <div v-else-if="pending?.length" class="divide-y divide-line">
          <div v-for="image in pending" :key="image.id" class="flex items-center gap-3 px-4 py-3">
            <RouterLink :to="`/images/${image.id}`" class="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              <img :src="image.thumbnailSmUrl || image.thumbnailUrl || image.url" :alt="image.title" class="h-full w-full object-cover" loading="lazy" />
            </RouterLink>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-medium text-ink">{{ image.title }}</p>
              <p class="mt-1 truncate font-mono text-[9px] text-muted">{{ image.user?.username }} · {{ timeAgo(image.createdAt) }}</p>
            </div>
            <div class="flex shrink-0 gap-1.5">
              <button class="n-btn n-btn-sm !h-8 !bg-jade !border-jade !text-white" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'approved' })">
                通过
              </button>
              <button class="n-btn n-btn-sm !h-8 !border-accent/30 !text-accent" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'rejected' })">
                拒绝
              </button>
            </div>
          </div>
        </div>

        <UiEmpty v-else title="审核队列是空的" description="暂时没有待处理的图片。去喝杯茶。" icon="check" />
      </section>

      <!-- right rail -->
      <div class="space-y-4">
        <section class="rounded-[24px] border border-line bg-surface p-5">
          <p class="eyebrow mb-3">Content mix</p>
          <div class="flex h-3 overflow-hidden rounded-full bg-surface-2">
            <span v-for="part in composition" :key="part.label" :class="part.color" :style="{ width: part.percent + '%' }" />
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div v-for="part in composition" :key="part.label" class="flex items-center gap-1.5 text-[11px] text-muted">
              <span class="h-2 w-2 rounded-full" :class="part.color" />
              {{ part.label }} <span class="ml-auto font-mono tabular text-ink">{{ part.value }}</span>
            </div>
          </div>
        </section>

        <section class="rounded-[24px] border border-line bg-surface p-5">
          <p class="eyebrow mb-3">Quick actions</p>
          <div class="grid grid-cols-2 gap-2">
            <RouterLink to="/upload" class="rounded-2xl border border-line p-3 no-underline transition hover:border-ink hover:bg-surface-2">
              <AppIcon name="upload" :size="17" class="text-accent" />
              <p class="mt-2 text-[12px] font-medium text-ink">上传图片</p>
            </RouterLink>
            <RouterLink to="/admin/categories" class="rounded-2xl border border-line p-3 no-underline transition hover:border-ink hover:bg-surface-2">
              <AppIcon name="grid" :size="17" class="text-jade" />
              <p class="mt-2 text-[12px] font-medium text-ink">分类管理</p>
            </RouterLink>
            <RouterLink to="/admin/settings" class="rounded-2xl border border-line p-3 no-underline transition hover:border-ink hover:bg-surface-2">
              <AppIcon name="settings" :size="17" class="text-sky" />
              <p class="mt-2 text-[12px] font-medium text-ink">站点设置</p>
            </RouterLink>
            <RouterLink to="/" class="rounded-2xl border border-line p-3 no-underline transition hover:border-ink hover:bg-surface-2">
              <AppIcon name="compass" :size="17" class="text-ink-2" />
              <p class="mt-2 text-[12px] font-medium text-ink">看看前台</p>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>

    <!-- recent comments -->
    <section class="mt-4 rounded-[24px] border border-line bg-surface">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p class="eyebrow mb-1.5">Community</p>
          <h2 class="font-display text-[24px] leading-none text-ink">最新评论</h2>
        </div>
        <RouterLink to="/admin/comments" class="n-btn n-btn-ghost n-btn-sm no-underline">评论管理 <AppIcon name="arrow-right" :size="12" /></RouterLink>
      </div>
      <div v-if="recentComments?.length" class="divide-y divide-line">
        <div v-for="comment in recentComments" :key="comment.id" class="flex items-start gap-3 px-4 py-3">
          <UiAvatar :src="comment.user.avatarUrl" :name="comment.user.username" :size="32" class="mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-[12px]"><span class="font-semibold text-ink">{{ comment.user.username }}</span> <span class="text-muted">评论了</span> <RouterLink :to="`/images/${comment.image.id}`" class="text-ink underline decoration-line underline-offset-2 hover:text-accent">{{ comment.image.title }}</RouterLink></p>
            <p class="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-2">{{ comment.content }}</p>
            <p class="mt-1 font-mono text-[9px] text-muted">{{ timeAgo(comment.createdAt) }}</p>
          </div>
          <button class="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-accent/10 hover:text-accent" aria-label="删除评论" @click="commentDelete.mutate(comment.id)">
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
      <p v-else class="px-5 py-10 text-center text-sm text-muted">还没有评论。</p>
    </section>
  </AdminShell>
</template>
