<script setup lang="ts">
import { ref } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const toast = useToast()
const queryClient = useQueryClient()
const page = ref(1)

const { data, isLoading } = useQuery({
  queryKey: ['admin-pending-bios', page],
  queryFn: () =>
    request.get('/users', { params: { page: page.value, size: 20, bioStatus: 'pending' } }).then((r) => ({
      data: r.data.data,
      meta: r.data.meta,
    })),
  placeholderData: keepPreviousData,
})

const approveMutation = useMutation({
  mutationFn: (id: string) => request.patch(`/users/${id}/approve-bio`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-bios'] })
    toast.success('简介已通过')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})

const rejectMutation = useMutation({
  mutationFn: (id: string) => request.patch(`/users/${id}`, { bioStatus: 'rejected' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-bios'] })
    toast.success('已拒绝这条简介')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})
</script>

<template>
  <AdminShell title="简介审核" eyebrow="Bio review" description="用户改简介后需要人工过一眼，避免广告和不当内容。">
    <div v-if="isLoading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="n-skeleton h-40 rounded-[24px]" />
    </div>

    <div v-else-if="data?.data?.length" class="space-y-3">
      <article v-for="user in data.data" :key="user.id" class="rounded-[24px] border border-line bg-surface p-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex items-center gap-3">
            <UiAvatar :src="user.avatarUrl" :name="user.username" :size="42" />
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-ink">
                {{ user.username }}
                <span v-if="user.role === 'admin'" class="rounded-full bg-butter/30 px-2 py-0.5 font-mono text-[8px] uppercase">Admin</span>
              </p>
              <p class="mt-0.5 font-mono text-[9px] text-muted">{{ user.email }} · 注册于 {{ formatDate(user.createdAt) }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="n-btn n-btn-sm !border-jade !bg-jade !text-white" :disabled="approveMutation.isPending.value" @click="approveMutation.mutate(user.id)">
              <AppIcon name="check" :size="12" /> 通过
            </button>
            <button class="n-btn n-btn-sm !border-accent/30 !text-accent" :disabled="rejectMutation.isPending.value" @click="rejectMutation.mutate(user.id)">
              <AppIcon name="close" :size="12" /> 拒绝
            </button>
          </div>
        </div>
        <blockquote class="mt-4 rounded-2xl border-l-[3px] border-butter bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
          {{ user.bio }}
        </blockquote>
      </article>
    </div>

    <div v-else class="rounded-[24px] border border-line bg-surface">
      <UiEmpty title="没有待审核的简介" description="大家都写得很规矩，或者还没人改简介。" icon="quote" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <span class="font-mono text-[10px] text-muted">第 {{ data.meta.page }} / {{ data.meta.totalPages }} 页</span>
      <div class="flex gap-1.5">
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page >= data.meta.totalPages" @click="page++">下一页</button>
      </div>
    </div>
  </AdminShell>
</template>
