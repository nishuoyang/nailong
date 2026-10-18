<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getCategories } from '@/api/images'
import { createCategory, deleteCategory, updateCategory } from '@/api/admin'
import { useToast } from '@/composables/useToast'
import AdminShell from '@/components/layout/AdminShell.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const toast = useToast()
const queryClient = useQueryClient()

const { data: categories, isLoading } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const deleteTarget = ref<{ id: string; name: string; count?: number } | null>(null)
const form = reactive({ name: '', slug: '', description: '' })

function openCreate() {
  editingId.value = null
  form.name = ''
  form.slug = ''
  form.description = ''
  dialogOpen.value = true
}

function openEdit(category: { id: string; name: string; slug: string; description?: string | null }) {
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
  form.description = category.description || ''
  dialogOpen.value = true
}

async function save() {
  if (!form.name.trim()) return toast.warning('请输入分类名称')
  if (!/^[a-z0-9-]+$/.test(form.slug)) return toast.warning('slug 仅支持小写字母、数字和连字符')
  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, { ...form })
      toast.success('分类已更新')
    } else {
      await createCategory({ ...form })
      toast.success('分类已创建')
    }
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    dialogOpen.value = false
  } catch (err: any) {
    toast.error(err.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteCategory(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    deleteTarget.value = null
    toast.success('分类已删除')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '删除失败'),
})

function autoSlug() {
  if (!editingId.value && !form.slug) {
    form.slug = form.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}
</script>

<template>
  <AdminShell title="分类管理" eyebrow="Categories" description="分类会显示在发现页筛选和投稿表单里。">
    <template #actions>
      <button class="n-btn n-btn-primary n-btn-sm" @click="openCreate"><AppIcon name="plus" :size="13" /> 新增分类</button>
    </template>

    <div v-if="isLoading" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 6" :key="i" class="n-skeleton h-32 rounded-[22px]" />
    </div>

    <div v-else-if="categories?.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article v-for="category in categories" :key="category.id" class="group rounded-[22px] border border-line bg-surface p-4 transition hover:border-ink/40">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-display text-[26px] leading-none text-ink">{{ category.name }}</p>
            <p class="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">/{{ category.slug }}</p>
          </div>
          <span class="shrink-0 rounded-full bg-surface-2 px-2 py-1 font-mono text-[9px] text-muted">{{ category.count ?? 0 }} 张</span>
        </div>
        <p class="mt-3 line-clamp-2 min-h-[2.4em] text-[11px] leading-relaxed text-muted">{{ category.description || '还没有描述' }}</p>
        <div class="mt-4 flex gap-1.5 opacity-60 transition group-hover:opacity-100">
          <button class="n-btn n-btn-outline n-btn-sm !h-7" @click="openEdit(category)"><AppIcon name="edit" :size="11" /> 编辑</button>
          <button class="n-btn n-btn-ghost n-btn-sm !h-7 !text-accent" @click="deleteTarget = category"><AppIcon name="trash" :size="11" /> 删除</button>
        </div>
      </article>
    </div>

    <div v-else class="rounded-[24px] border border-line bg-surface">
      <UiEmpty title="还没有分类" description="建几个分类，让发现页更好逛。" icon="grid">
        <button class="n-btn n-btn-primary" @click="openCreate">新增第一个</button>
      </UiEmpty>
    </div>

    <UiModal v-model="dialogOpen" :title="editingId ? '编辑分类' : '新增分类'" width="500px">
      <label class="mb-1.5 block text-xs font-medium text-ink-2">名称</label>
      <input v-model="form.name" class="n-input mb-4" placeholder="例如：风景" maxlength="40" @blur="autoSlug" />
      <label class="mb-1.5 block text-xs font-medium text-ink-2">Slug</label>
      <input v-model="form.slug" class="n-input mb-1.5 font-mono" placeholder="landscape" maxlength="60" />
      <p class="mb-4 font-mono text-[9px] text-muted">仅小写字母、数字和连字符，用于 URL</p>
      <label class="mb-1.5 block text-xs font-medium text-ink-2">描述</label>
      <textarea v-model="form.description" rows="3" maxlength="200" class="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-ink" placeholder="这个分类收些什么？" />
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="ghost" @click="dialogOpen = false">取消</UiButton>
        <UiButton variant="primary" :loading="saving" @click="save">保存</UiButton>
      </div>
    </UiModal>

    <UiModal :model-value="!!deleteTarget" title="删除分类" width="420px" @update:model-value="deleteTarget = null">
      <p class="text-sm leading-relaxed text-ink-2">
        确定删除「{{ deleteTarget?.name }}」吗？
        <span v-if="deleteTarget?.count" class="text-accent">该分类下还有 {{ deleteTarget.count }} 张图片，需要先移除关联。</span>
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="ghost" @click="deleteTarget = null">取消</UiButton>
        <UiButton variant="accent" :loading="deleteMutation.isPending.value" @click="deleteTarget && deleteMutation.mutate(deleteTarget.id)">确认删除</UiButton>
      </div>
    </UiModal>
  </AdminShell>
</template>
