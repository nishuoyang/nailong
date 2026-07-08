<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { getAdminImages } from '@/api/admin'
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const { data: pendingData } = useQuery({
  queryKey: ['admin-images', 'pending'],
  queryFn: () => getAdminImages({ status: 'pending', size: 1 }).then((r) => r.data),
})

const { data: allData } = useQuery({
  queryKey: ['admin-images', 'all'],
  queryFn: () => getAdminImages({ size: 1 }).then((r) => r.data),
})

const menuItems = [
  { label: '管理概览', to: '/admin' },
  { label: '图片管理', to: '/admin/images' },
  { label: '分类管理', to: '/admin/categories' },
]
</script>

<template>
  <ProfileLayout title="管理概览">
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

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6">
        <p class="text-3xl font-bold text-orange-500">{{ pendingData?.meta?.total || 0 }}</p>
        <p class="text-gray-500 text-sm mt-1">待审核图片</p>
        <router-link to="/admin/images?status=pending" class="text-blue-600 text-sm no-underline">去审核 →</router-link>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <p class="text-3xl font-bold text-blue-500">{{ allData?.meta?.total || 0 }}</p>
        <p class="text-gray-500 text-sm mt-1">图片总数</p>
        <router-link to="/admin/images" class="text-blue-600 text-sm no-underline">查看全部 →</router-link>
      </div>
    </div>
  </ProfileLayout>
</template>
