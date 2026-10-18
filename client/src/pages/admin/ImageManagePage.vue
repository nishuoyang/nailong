<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  deleteImage,
  getAdminImages,
  getAdminStats,
  toggleFeatured,
  updateImage,
  updateImageStatus,
} from '@/api/admin'
import { getCategories } from '@/api/images'
import type { ImageItem } from '@/api/images'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/format'
import AdminShell from '@/components/layout/AdminShell.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()

const page = ref(1)
const statusFilter = ref((route.query.status as string) || '')
const searchInput = ref('')
const search = ref('')

watch(
  () => route.query.status,
  (value) => {
    statusFilter.value = (value as string) || ''
    page.value = 1
  },
)

let searchTimer: number | undefined
watch(searchInput, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    search.value = value.trim()
    page.value = 1
  }, 300)
})

const { data: stats } = useQuery({
  queryKey: ['admin-stats'],
  queryFn: () => getAdminStats().then((r) => r.data.data),
  staleTime: 30_000,
})

const { data, isLoading } = useQuery({
  queryKey: ['admin-images', page, statusFilter, search],
  queryFn: () =>
    getAdminImages({
      page: page.value,
      size: 20,
      status: statusFilter.value || undefined,
      search: search.value || undefined,
    }).then((r) => r.data),
  placeholderData: keepPreviousData,
})

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) => updateImageStatus(id, status),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    toast.success(variables.status === 'approved' ? '已通过' : variables.status === 'rejected' ? '已拒绝' : '状态已更新')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})

const featuredMutation = useMutation({
  mutationFn: (id: string) => toggleFeatured(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    toast.success('精选状态已更新')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '操作失败'),
})

const deleteTarget = ref<ImageItem | null>(null)
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteImage(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    deleteTarget.value = null
    toast.success('图片已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})

const editOpen = ref(false)
const editingId = ref('')
const editForm = reactive({
  title: '',
  description: '',
  categoryIds: [] as string[],
  tags: [] as string[],
  tagInput: '',
  section: 'general',
})

function openEdit(image: ImageItem) {
  editingId.value = image.id
  editForm.title = image.title
  editForm.description = image.description || ''
  editForm.categoryIds = (image.categories || []).map((c) => c.id)
  editForm.tags = (image.tags || []).map((t) => t.name)
  editForm.tagInput = ''
  editForm.section = image.section || 'general'
  editOpen.value = true
}

const editMutation = useMutation({
  mutationFn: () =>
    updateImage(editingId.value, {
      title: editForm.title,
      description: editForm.description,
      categoryIds: editForm.categoryIds,
      tagNames: editForm.tags,
      section: editForm.section,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    queryClient.invalidateQueries({ queryKey: ['image', editingId.value] })
    editOpen.value = false
    toast.success('已保存')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '保存失败'),
})

function saveEdit() {
  if (!editForm.title.trim()) {
    toast.warning('标题不能为空')
    return
  }
  editMutation.mutate()
}

function toggleCategory(id: string) {
  const index = editForm.categoryIds.indexOf(id)
  if (index >= 0) editForm.categoryIds.splice(index, 1)
  else editForm.categoryIds.push(id)
}

function addEditTag() {
  const value = editForm.tagInput.trim().replace(/^#/, '')
  if (!value) return
  if (editForm.tags.length >= 6) {
    toast.warning('最多 6 个标签')
    return
  }
  if (!editForm.tags.includes(value)) editForm.tags.push(value.slice(0, 20))
  editForm.tagInput = ''
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addEditTag()
  }
}

function setStatusFilter(value: string) {
  statusFilter.value = value
  page.value = 1
  router.replace({ query: value ? { status: value } : {} })
}

const tabs = computed(() => [
  { value: '', label: '全部', count: (stats.value?.approved ?? 0) + (stats.value?.pending ?? 0) + (stats.value?.rejected ?? 0) + (stats.value?.offline ?? 0) },
  { value: 'pending', label: '待审核', count: stats.value?.pending ?? 0 },
  { value: 'approved', label: '已通过', count: stats.value?.approved ?? 0 },
  { value: 'rejected', label: '已拒绝', count: stats.value?.rejected ?? 0 },
  { value: 'offline', label: '已下架', count: stats.value?.offline ?? 0 },
])

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-butter/30 text-ink' },
  approved: { label: '已通过', cls: 'bg-jade/12 text-jade' },
  rejected: { label: '已拒绝', cls: 'bg-accent/10 text-accent' },
  offline: { label: '已下架', cls: 'bg-surface-2 text-muted' },
}
</script>

<template>
  <AdminShell title="图片管理" eyebrow="Images" description="审核、上架、精选与元信息维护。">
    <template #actions>
      <RouterLink to="/upload" class="n-btn n-btn-primary n-btn-sm no-underline">
        <AppIcon name="plus" :size="13" /> 上传
      </RouterLink>
    </template>

    <div class="rounded-[24px] border border-line bg-surface">
      <div class="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex gap-1 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition"
            :class="statusFilter === tab.value ? 'bg-ink text-paper' : 'text-muted hover:bg-surface-2 hover:text-ink'"
            @click="setStatusFilter(tab.value)"
          >
            {{ tab.label }}
            <span class="font-mono text-[9px] opacity-60">{{ tab.count }}</span>
          </button>
        </div>
        <div class="relative w-full xl:w-64">
          <AppIcon name="search" :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            v-model="searchInput"
            type="search"
            class="h-9 w-full rounded-full border border-line bg-paper/50 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-muted focus:border-ink"
            placeholder="搜标题、描述或上传者…"
          />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2 p-4">
        <div v-for="i in 6" :key="i" class="n-skeleton h-20 rounded-2xl" />
      </div>

      <div v-else-if="data?.data?.length" class="divide-y divide-line">
        <div v-for="image in data.data" :key="image.id" class="group flex flex-col gap-3 p-4 transition hover:bg-surface-2/50 sm:flex-row sm:items-center">
          <RouterLink :to="`/images/${image.id}`" class="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2">
            <img :src="image.thumbnailSmUrl || image.thumbnailUrl || image.url" :alt="image.title" class="h-full w-full object-cover" loading="lazy" />
          </RouterLink>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <RouterLink :to="`/images/${image.id}`" class="max-w-full truncate text-[13px] font-semibold text-ink no-underline hover:text-accent">{{ image.title }}</RouterLink>
              <span v-if="image.isFeatured" class="rounded-full bg-butter/30 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wide text-ink">精选</span>
              <span class="rounded-full px-2 py-0.5 font-mono text-[8px]" :class="statusMeta[image.status]?.cls">{{ statusMeta[image.status]?.label || image.status }}</span>
            </div>
            <p class="mt-1 line-clamp-1 text-[11px] text-muted">{{ image.description || '没有描述' }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span class="flex items-center gap-1"><AppIcon name="user" :size="10" />{{ image.user?.username }}</span>
              <span>·</span>
              <span>{{ timeAgo(image.createdAt) }}</span>
              <template v-if="image.tags?.length">
                <span>·</span>
                <span v-for="tag in image.tags.slice(0, 3)" :key="tag.id" class="rounded-full bg-surface-2 px-1.5 py-0.5">#{{ tag.name }}</span>
              </template>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-1.5">
            <template v-if="image.status === 'pending'">
              <button class="n-btn n-btn-sm !h-8 !border-jade !bg-jade !text-white" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'approved' })">通过</button>
              <button class="n-btn n-btn-sm !h-8 !border-accent/30 !text-accent" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'rejected' })">拒绝</button>
            </template>
            <button v-if="image.status === 'approved'" class="n-btn n-btn-outline n-btn-sm !h-8" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'offline' })">下架</button>
            <button v-if="image.status === 'offline'" class="n-btn n-btn-outline n-btn-sm !h-8" :disabled="statusMutation.isPending.value" @click="statusMutation.mutate({ id: image.id, status: 'approved' })">上架</button>
            <button class="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition hover:border-butter hover:text-ink" :title="image.isFeatured ? '取消精选' : '设为精选'" @click="featuredMutation.mutate(image.id)">
              <AppIcon name="star" :size="13" :filled="image.isFeatured" />
            </button>
            <button class="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink" title="编辑" @click="openEdit(image)">
              <AppIcon name="edit" :size="13" />
            </button>
            <button class="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent" title="删除" @click="deleteTarget = image">
              <AppIcon name="trash" :size="13" />
            </button>
          </div>
        </div>
      </div>

      <UiEmpty v-else title="没有符合条件的图片" description="换一个状态或关键词试试。" icon="image" />
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <span class="font-mono text-[10px] text-muted">{{ data.meta.total }} 张 · 第 {{ data.meta.page }} / {{ data.meta.totalPages }} 页</span>
      <div class="flex gap-1.5">
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="n-btn n-btn-outline n-btn-sm" :disabled="page >= data.meta.totalPages" @click="page++">下一页</button>
      </div>
    </div>

    <!-- edit modal -->
    <UiModal v-model="editOpen" title="编辑图片信息" width="620px">
      <label class="mb-1.5 block text-xs font-medium text-ink-2">标题</label>
      <input v-model="editForm.title" class="n-input mb-4" maxlength="255" />

      <label class="mb-1.5 block text-xs font-medium text-ink-2">描述</label>
      <textarea v-model="editForm.description" rows="3" maxlength="500" class="mb-4 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-ink" />

      <label class="mb-1.5 block text-xs font-medium text-ink-2">分类</label>
      <div class="mb-4 flex flex-wrap gap-1.5">
        <button v-for="cat in categories" :key="cat.id" class="n-chip !h-7 !text-[11px]" :class="{ 'is-active': editForm.categoryIds.includes(cat.id) }" @click="toggleCategory(cat.id)">{{ cat.name }}</button>
      </div>

      <label class="mb-1.5 block text-xs font-medium text-ink-2">标签</label>
      <div class="mb-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-2">
        <span v-for="tag in editForm.tags" :key="tag" class="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] text-paper">
          #{{ tag }}
          <button class="text-paper/60 hover:text-paper" @click="editForm.tags = editForm.tags.filter((item) => item !== tag)"><AppIcon name="close" :size="9" /></button>
        </span>
        <input v-model="editForm.tagInput" class="min-w-[90px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted" placeholder="回车添加" @keydown="onTagKeydown" @blur="addEditTag" />
      </div>

      <label class="mb-1.5 block text-xs font-medium text-ink-2">板块</label>
      <div class="mb-5 grid grid-cols-2 gap-2">
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="editForm.section === 'general' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="editForm.section = 'general'">发现页</button>
        <button class="rounded-2xl border px-3 py-2.5 text-left text-sm transition" :class="editForm.section === 'other' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2'" @click="editForm.section = 'other'">其他推荐</button>
      </div>

      <div class="flex justify-end gap-2">
        <UiButton variant="ghost" @click="editOpen = false">取消</UiButton>
        <UiButton variant="primary" :loading="editMutation.isPending.value" @click="saveEdit">保存</UiButton>
      </div>
    </UiModal>

    <!-- delete confirm -->
    <UiModal :model-value="!!deleteTarget" title="删除图片" width="440px" @update:model-value="deleteTarget = null">
      <p class="text-sm leading-relaxed text-ink-2">
        确定删除「{{ deleteTarget?.title }}」吗？图片文件、评论和收藏记录都会一并删除，无法撤销。
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <UiButton variant="ghost" @click="deleteTarget = null">取消</UiButton>
        <UiButton variant="accent" :loading="deleteMutation.isPending.value" @click="deleteTarget && deleteMutation.mutate(deleteTarget.id)">确认删除</UiButton>
      </div>
    </UiModal>
  </AdminShell>
</template>