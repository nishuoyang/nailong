<script setup lang="ts">
import { ref } from 'vue'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
// ElMessage 由 unplugin-auto-import 按需注入（见 vite.config.ts）
import ProfileLayout from '@/components/layout/ProfileLayout.vue'

const queryClient = useQueryClient()
const page = ref(1)
const dialogVisible = ref(false)
const editingUser = ref<any>(null)
const form = ref({ username: '', email: '', role: 'user', bioStatus: 'approved' })
const submitting = ref(false)

const { data, isLoading } = useQuery({
  queryKey: ['admin-users', page],
  queryFn: () =>
    request.get('/users', { params: { page: page.value, size: 20 } }).then((r) => ({
      data: r.data.data,
      meta: r.data.meta,
    })),
  placeholderData: keepPreviousData,
})

function openEdit(user: any) {
  editingUser.value = user
  form.value = {
    username: user.username,
    email: user.email,
    role: user.role,
    bioStatus: user.bioStatus || 'approved',
  }
  dialogVisible.value = true
}

async function handleSave() {
  submitting.value = true
  try {
    await request.patch(`/users/${editingUser.value.id}`, form.value)
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    ElMessage.success('保存成功')
    dialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || '保存失败')
  } finally {
    submitting.value = false
  }
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
  <ProfileLayout title="用户管理">
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

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <el-table :data="data?.data" stripe>
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : '用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Bio 状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.bio" :type="row.bioStatus === 'approved' ? 'success' : 'warning'" size="small">
              {{ row.bioStatus === 'approved' ? '已审核' : '待审核' }}
            </el-tag>
            <span v-else class="text-gray-300 text-xs">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="120">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="data?.meta && data.meta.totalPages > 1" class="flex justify-center mt-6">
      <el-pagination v-model:current-page="page" :page-size="20" :total="data.meta.total"
        background layout="prev, pager, next" />
    </div>

    <!-- Edit Dialog -->
    <el-dialog v-model="dialogVisible" title="编辑用户" width="480px">
      <el-form :model="form" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role">
            <el-option label="用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editingUser?.bio" label="Bio 状态">
          <el-select v-model="form.bioStatus">
            <el-option label="已审核" value="approved" />
            <el-option label="待审核" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </ProfileLayout>
</template>
