<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { getCategories } from '@/api/images'
import { createCategory, updateCategory, deleteCategory } from '@/api/admin'
// ElMessage / ElMessageBox 由 unplugin-auto-import 按需注入（见 vite.config.ts）
import type { FormInstance } from 'element-plus'
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const queryClient = useQueryClient()

const dialogVisible = ref(false)
const dialogTitle = ref('新增分类')
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = ref({ name: '', slug: '', description: '' })
const submitting = ref(false)

// 与首页/上传页共用 ['categories'] 同一个缓存条目（同一个接口），
// 之前用 ['admin-categories'] 会多存一份、并需要在两处分别 invalidate。
const { data: categories, isLoading } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

function openCreate() {
  editingId.value = null; dialogTitle.value = '新增分类'
  form.value = { name: '', slug: '', description: '' }; dialogVisible.value = true
}

// el-table 的插槽行类型是 Record<PropertyKey, any>（DefaultRow），无法满足具名属性，
// 因此这里用具名类型 + 模板处断言收窄，兼顾可读性与类型安全。
type Category = { id: string; name: string; slug: string; description: string | null }

function openEdit(cat: Category) {
  editingId.value = cat.id; dialogTitle.value = '编辑分类'
  form.value = { name: cat.name, slug: cat.slug, description: cat.description || '' }; dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (editingId.value) { await updateCategory(editingId.value, form.value); ElMessage.success('更新成功') }
      else { await createCategory(form.value); ElMessage.success('创建成功') }
      dialogVisible.value = false
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    } catch (err: any) { ElMessage.error(err.response?.data?.message || '操作失败') }
    finally { submitting.value = false }
  })
}

async function handleDelete(id: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定要删除分类"${name}"吗？`, '确认删除', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deleteCategory(id); ElMessage.success('已删除')
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  } catch (err: any) { if (err !== 'cancel') ElMessage.error(err.response?.data?.message || '删除失败') }
}

const menuItems = [
  { label: '管理概览', to: '/admin' },
  { label: '图片管理', to: '/admin/images' },
  { label: '用户管理', to: '/admin/users' },
  { label: 'Bio 审核', to: '/admin/bio-review' },
  { label: '分类管理', to: '/admin/categories' },
  { label: '设置', to: '/admin/settings' },
]
</script>

<template>
  <ProfileLayout title="分类管理">
    <template #menu>
      <router-link
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="px-3 py-2 rounded-lg text-sm no-underline transition-colors"
        :class="$route.path === item.to
          ? 'bg-orange-50 text-orange-600 font-medium'
          : 'text-gray-600 hover:bg-gray-50'"
      >
        {{ item.label }}
      </router-link>
    </template>

    <div class="mb-4">
      <el-button type="primary" @click="openCreate">新增分类</el-button>
    </div>

    <div v-if="isLoading" class="text-center py-20"><p class="text-gray-400">加载中...</p></div>

    <div v-else class="bg-white rounded-xl shadow-sm p-6">
      <el-table :data="categories" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="slug" label="Slug" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row as Category)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(row.id, row.name)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form ref="formRef" :model="form" label-position="top">
        <el-form-item label="名称" prop="name" :rules="[{ required: true, message: '请输入分类名称' }]">
          <el-input v-model="form.name" placeholder="例如：风景" />
        </el-form-item>
        <el-form-item label="Slug" prop="slug" :rules="[{ required: true, message: '请输入 slug' }, { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和连字符' }]">
          <el-input v-model="form.slug" placeholder="例如：landscape" />
        </el-form-item>
        <el-form-item label="描述（可选）">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="分类描述..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </ProfileLayout>
</template>
