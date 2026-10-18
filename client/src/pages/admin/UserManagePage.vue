<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const toast = useToast()
const queryClient = useQueryClient()
const page = ref(1)
const searchInput = ref('')
const search = ref('')

let timer: number | undefined
watch(searchInput, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    search.value = value.trim()
    page.value = 1
  }, 300)
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-users', page, search],
  queryFn: () =>
    request
      .get('/users', { params: { page: page.value, size: 20, search: search.value || undefined } })
      .then((r) => ({ data: r.data.data, meta: r.data.meta })),
  placeholderData: keepPreviousData,
})

const editing = ref<any>(null)
const saving = ref(false)
const form = reactive({ username: '', email: '', role: 'user', bioStatus: 'approved' })

function openEdit(user: any) {
  editing.value = user
  form.username = user.username
  form.email = user.email
  form.role = user.role
  form.bioStatus = user.bioStatus || 'approved'
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    await request.patch(`/users/${editing.value.id}`, { ...form })
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    toast.success('用户信息已更新')
    editing.value = null
  } catch (err: any) {
    toast.error(err.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminShell title="用户管理" eyebrow="Members" description="查看成员、调整角色和简介审核状态。">
    <div class="rounded-[24px] border border-line bg-surface">
      <div class="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Total <span class="text-ink">{{ data?.meta?.total ?? 0 }}</span></p>
        <div class="relative w-full sm:w-72">
          <AppIcon name="search" :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input v-model="searchInput" type="search" class="h-9 w-full rounded-full border border-line bg-paper/50 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-muted focus:border-ink" placeholder="搜用户名或邮箱…" />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2 p-4">
        <div v-for="i in 5" :key="i" class="n-skeleton h-16 rounded-2xl" />
      </div>

      <div v-else-if="data?.data?.length" class="divide-y divide-line">
        <div v-for="user in data.data" :key="user.id" class="flex items-center gap-3 p-4">
          <UiAvatar :src="user.avatarUrl" :name="user.username" :size="38" />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
              {{ user.username }}
              <span v-if="user.role === 'admin'" class="rounded-full bg-butter/30 px-2 py-0.5 font-mono text-[8px] uppercase">Admin</span>
              <span v-if="user.bio && user.bioStatus === 'pending'" class="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[8px] text-accent">简介待审</span>
            </p>
            <p class="mt-0.5 truncate font-mono text-[9px] text-muted">{{ user.email }} · 加入于 {{ formatDate(user.createdAt) }}</p>
          </div>
          <button class="n-btn n-btn-outline n-btn-sm shrink-0" @click="openEdit(user)"><AppIcon name="edit" :size="12" /> 编辑</button>
        </div>
      </div>

      <UiEmpty v-else title="没有找到用户" description="试试别的关键词。" icon="users" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <span class="font-mono text-[10px] text-muted">第 {{ data.meta.page }} / {{ data.meta.totalPages }} 页</span>
      <div class="flex gap-1.5">
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page >= data.meta.totalPages" @click="page++">下一页</button>
      </div>
    </div>

    <UiModal :model-value="!!editing" title="编辑用户" width="500px" @update:model-value="editing = null">
      <label class="mb-1.5 block text-xs font-medium text-ink-2">用户名</label>
      <input v-model="form.username" class="n-input mb-4" />
      <label class="mb-1.5 block text-xs font-medium text-ink-2">邮箱</label>
      <input v-model="form.email" class="n-input mb-4" />
      <label class="mb-1.5 block text-xs font-medium text-ink-2">角色</label>
      <div class="mb-4 grid grid-cols-2 gap-2">
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="form.role === 'user' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="form.role = 'user'">普通用户</button>
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="form.role === 'admin' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="form.role = 'admin'">管理员</button>
      </div>
      <label v-if="editing?.bio" class="mb-1.5 block text-xs font-medium text-ink-2">简介状态</label>
      <div v-if="editing?.bio" class="mb-2 grid grid-cols-2 gap-2">
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="form.bioStatus === 'approved' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="form.bioStatus = 'approved'">已通过</button>
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="form.bioStatus === 'pending' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="form.bioStatus = 'pending'">待审核</button>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="ghost" @click="editing = null">取消</UiButton>
        <UiButton variant="primary" :loading="saving" @click="save">保存</UiButton>
      </div>
    </UiModal>
  </AdminShell>
</template>
