<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const queryClient = useQueryClient()

const { data: settings, isLoading } = useQuery({
  queryKey: ['admin-settings'],
  queryFn: () => request.get('/admin/settings').then((r) => r.data.data),
})

const mutation = useMutation({
  mutationFn: (data: { registrationOpen: boolean }) =>
    request.patch('/admin/settings', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    ElMessage.success('设置已更新')
  },
  onError: (err: any) => ElMessage.error(err.response?.data?.message || '保存失败'),
})

const menuItems = [
  { label: '管理概览', to: '/admin' },
  { label: '图片管理', to: '/admin/images' },
  { label: '用户管理', to: '/admin/users' },
  { label: '分类管理', to: '/admin/categories' },
  { label: '设置', to: '/admin/settings' },
]
</script>

<template>
  <ProfileLayout title="设置">
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

    <div v-else class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between py-4">
        <div>
          <h3 class="font-medium text-gray-800">开放注册</h3>
          <p class="text-sm text-gray-400 mt-1">关闭后，新用户无法注册账号</p>
        </div>
        <el-switch
          :model-value="settings?.registrationOpen !== false"
          :loading="mutation.isPending.value"
          @change="(val: boolean) => mutation.mutate({ registrationOpen: val })"
        />
      </div>
    </div>
  </ProfileLayout>
</template>
