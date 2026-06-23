<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getAdminImages, updateImageStatus, deleteImage } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const queryClient = useQueryClient()

const page = ref(1)
const statusFilter = ref<string>((route.query.status as string) || '')

watch(
  () => route.query.status,
  (s) => {
    statusFilter.value = (s as string) || ''
    page.value = 1
  },
)

const { data, isLoading } = useQuery({
  queryKey: ['admin-images', page, statusFilter],
  queryFn: () =>
    getAdminImages({ page: page.value, size: 20, status: statusFilter.value || undefined }).then(
      (r) => r.data,
    ),
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) => updateImageStatus(id, status),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    ElMessage.success('操作成功')
  },
  onError: (err: any) => {
    ElMessage.error(err.response?.data?.message || '操作失败')
  },
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteImage(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-images'] })
    ElMessage.success('已删除')
  },
  onError: (err: any) => {
    ElMessage.error(err.response?.data?.message || '删除失败')
  },
})

async function handleDelete(id: string, title: string) {
  try {
    await ElMessageBox.confirm(`确定要删除"${title}"吗？此操作不可撤销。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    deleteMutation.mutate(id)
  } catch {
    // cancelled
  }
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
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold">图片管理</h1>
      <el-radio-group v-model="statusFilter" size="small" @change="page = 1">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已拒绝</el-radio-button>
        <el-radio-button value="offline">已下架</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="isLoading" class="text-center py-20">
      <p class="text-gray-400">加载中...</p>
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data?.data" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="100">
          <template #default="{ row }">
            <span class="text-xs text-gray-400">{{ row.id.slice(0, 8) }}...</span>
          </template>
        </el-table-column>
        <el-table-column label="图片" width="100">
          <template #default="{ row }">
            <img
              :src="row.thumbnailUrl || row.url"
              class="w-16 h-12 object-cover rounded"
              loading="lazy"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="user.username" label="上传者" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status).type" size="small">
              {{ getStatusTag(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数据" width="140">
          <template #default="{ row }">
            <span class="text-xs text-gray-500">
              ❤️{{ row.likeCount }} ⬇{{ row.downloadCount }} 👁{{ row.viewCount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="上传时间" width="120">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="flex gap-1 flex-wrap">
              <el-button
                v-if="row.status === 'pending'"
                type="success"
                size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'approved' })"
              >
                通过
              </el-button>
              <el-button
                v-if="row.status === 'pending'"
                type="danger"
                size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'rejected' })"
              >
                拒绝
              </el-button>
              <el-button
                v-if="row.status === 'approved'"
                type="warning"
                size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'offline' })"
              >
                下架
              </el-button>
              <el-button
                v-if="row.status === 'offline'"
                type="success"
                size="small"
                :loading="statusMutation.isPending.value"
                @click="statusMutation.mutate({ id: row.id, status: 'approved' })"
              >
                上架
              </el-button>
              <el-button
                type="danger"
                size="small"
                plain
                :loading="deleteMutation.isPending.value"
                @click="handleDelete(row.id, row.title)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-6">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="data.meta.total"
        background
        layout="prev, pager, next"
      />
    </div>
  </div>
</template>
