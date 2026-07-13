<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const queryClient = useQueryClient()
const page = ref(1)

const { data, isLoading } = useQuery({
  queryKey: ['admin-pending-bios', page],
  queryFn: () =>
    request.get('/users', { params: { page: page.value, size: 20, bioStatus: 'pending' } }).then((r) => ({
      data: r.data.data,
      meta: r.data.meta,
    })),
})

const approveMutation = useMutation({
  mutationFn: (id: string) => request.patch(`/users/${id}/approve-bio`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-bios'] })
    ElMessage.success('已通过')
  },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '操作失败'),
})

const rejectMutation = useMutation({
  mutationFn: (id: string) => request.patch(`/users/${id}`, { bioStatus: 'approved' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-bios'] })
    ElMessage.success('已拒绝')
  },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '操作失败'),
})

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
  <ProfileLayout title="Bio 审核">
    <template #menu>
      <router-link
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="px-3 py-2 rounded-lg text-sm no-underline transition-colors"
        :class="$route.path === item.to ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'"
      >
        {{ item.label }}
      </router-link>
    </template>

    <div v-if="isLoading" class="text-center py-20"><p class="text-gray-400">加载中...</p></div>

    <div v-else-if="!data?.data?.length" class="text-center py-20 bg-white rounded-xl">
      <p class="text-gray-400">暂无待审核 Bio</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="user in data.data"
        :key="user.id"
        class="bg-white rounded-xl shadow-sm p-6"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <span class="font-medium text-gray-800">{{ user.username }}</span>
            <span class="text-gray-400 text-sm ml-2">{{ user.email }}</span>
            <el-tag v-if="user.role === 'admin'" size="small" type="danger" class="ml-2">管理员</el-tag>
          </div>
          <div class="flex gap-2">
            <el-button
              type="success"
              size="small"
              :loading="approveMutation.isPending.value"
              @click="approveMutation.mutate(user.id)"
            >
              通过
            </el-button>
            <el-button
              type="danger"
              size="small"
              plain
              :loading="rejectMutation.isPending.value"
              @click="rejectMutation.mutate(user.id)"
            >
              拒绝
            </el-button>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
          {{ user.bio }}
        </div>
      </div>
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-6">
      <el-pagination v-model:current-page="page" :page-size="20" :total="data.meta.total"
        background layout="prev, pager, next" />
    </div>
  </ProfileLayout>
</template>
