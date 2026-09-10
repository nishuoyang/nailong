<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getAdminImages, updateImageStatus, deleteImage, toggleFeatured, updateImage } from '@/api/admin'
import { getCategories } from '@/api/images'
// ElMessage / ElMessageBox 由 unplugin-auto-import 按需注入（见 vite.config.ts）
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const route = useRoute()
const queryClient = useQueryClient()

const page = ref(1)
const statusFilter = ref<string>((route.query.status as string) || '')

watch(
  () => route.query.status,
  (s) => { statusFilter.value = (s as string) || ''; page.value = 1 },
)

const { data, isLoading } = useQuery({
  queryKey: ['admin-images', page, statusFilter],
  queryFn: () =>
    getAdminImages({ page: page.value, size: 20, status: statusFilter.value || undefined }).then((r) => r.data),
  placeholderData: keepPreviousData,
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) => updateImageStatus(id, status),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-images'] }); ElMessage.success('操作成功') },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '操作失败'),
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteImage(id),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-images'] }); ElMessage.success('已删除') },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '删除失败'),
})

const featuredMutation = useMutation({
  mutationFn: (id: string) => toggleFeatured(id),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-images'] }); ElMessage.success('操作成功') },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '操作失败'),
})

// —— 编辑图片信息 ——
const dialogVisible = ref(false)
const editingId = ref('')
const editForm = reactive({ title: '', description: '', categoryIds: [] as string[] })

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
  staleTime: 10 * 60_000,
})

const editMutation = useMutation({
  mutationFn: ({ id, data }: { id: string; data: { title: string; description: string; categoryIds: string[] } }) =>
    updateImage(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    ElMessage.success('保存成功')
    dialogVisible.value = false
  },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '保存失败'),
})

function openEdit(row: any) {
  editingId.value = row.id
  editForm.title = row.title || ''
  editForm.description = row.description || ''
  editForm.categoryIds = (row.categories || []).map((c: any) => c.category.id)
  dialogVisible.value = true
}

function saveEdit() {
  if (!editForm.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }
  editMutation.mutate({
    id: editingId.value,
    data: { title: editForm.title, description: editForm.description, categoryIds: editForm.categoryIds },
  })
}

async function handleDelete(id: string, title: string) {
  try {
    await ElMessageBox.confirm(`确定要删除"${title}"吗？此操作不可撤销。`, '确认删除', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    deleteMutation.mutate(id)
  } catch { /* cancelled */ }
}

function getStatusTag(status: string) {
  const map: Record<string, { type: 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
    pending: { type: 'warning', label: '待审核' },
    approved: { type: 'success', label: '已通过' },
    rejected: { type: 'danger', label: '已拒绝' },
    offline: { type: 'info', label: '已下架' },
  }
  return map[status] || { type: 'info', label: status }
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
  <ProfileLayout title="图片管理">
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
      <el-radio-group v-model="statusFilter" size="small" @change="page = 1">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已拒绝</el-radio-button>
        <el-radio-button value="offline">已下架</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="isLoading" class="text-center py-20"><p class="text-gray-400">加载中...</p></div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data?.data" stripe style="width: 100%">
        <el-table-column label="图片" width="100">
          <template #default="{ row }">
            <img :src="row.thumbnailUrl || row.url" class="w-16 h-12 object-cover rounded" loading="lazy" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="user.username" label="上传者" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status).type" size="small">{{ getStatusTag(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <div class="flex gap-1 flex-wrap">
              <el-button v-if="row.status === 'pending'" type="success" size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'approved' })">通过</el-button>
              <el-button v-if="row.status === 'pending'" type="danger" size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'rejected' })">拒绝</el-button>
              <el-button v-if="row.status === 'approved'" type="warning" size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'offline' })">下架</el-button>
              <el-button v-if="row.status === 'offline'" type="success" size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'approved' })">上架</el-button>
              <el-button size="small" plain :loading="editMutation.isPending.value" @click="openEdit(row)">
                编辑
              </el-button>
              <el-button
                :type="row.isFeatured ? 'warning' : 'info'"
                size="small"
                plain
                :loading="featuredMutation.isPending.value"
                @click="featuredMutation.mutate(row.id)"
              >
                {{ row.isFeatured ? '取消精选' : '精选' }}
              </el-button>
              <el-button type="danger" size="small" plain
                :loading="deleteMutation.isPending.value"
                @click="handleDelete(row.id, row.title)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-6">
      <el-pagination v-model:current-page="page" :page-size="20" :total="data.meta.total"
        background layout="prev, pager, next" />
    </div>

    <!-- 编辑图片信息弹窗 -->
    <el-dialog v-model="dialogVisible" title="编辑图片" width="480px">
      <el-form label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" placeholder="请输入图片标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3"
            placeholder="图片描述（可选）" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.categoryIds" multiple clearable placeholder="选择分类（可多选）" style="width: 100%">
            <el-option v-for="c in categories || []" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editMutation.isPending.value" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </ProfileLayout>
</template>
