<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { getAdminImages } from '@/api/admin'

const { data: pendingData } = useQuery({
  queryKey: ['admin-images', 'pending'],
  queryFn: () => getAdminImages({ status: 'pending', size: 1 }).then((r) => r.data),
})

const { data: allData } = useQuery({
  queryKey: ['admin-images', 'all'],
  queryFn: () => getAdminImages({ size: 1 }).then((r) => r.data),
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-8">管理后台</h1>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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
      <div class="bg-white rounded-xl shadow-sm p-6">
        <p class="text-3xl font-bold text-green-500">📁</p>
        <p class="text-gray-500 text-sm mt-1">分类管理</p>
        <router-link to="/admin/categories" class="text-blue-600 text-sm no-underline">管理分类 →</router-link>
      </div>
    </div>
  </div>
</template>
