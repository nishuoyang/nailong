<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getMe } from '@/api/auth'
import request from '@/utils/request'
import ProfileLayout from '@/components/layout/ProfileLayout.vue'
import ImageCard from '@/components/common/ImageCard.vue'
// ElMessage 由 unplugin-auto-import 按需注入（见 vite.config.ts）

const router = useRouter()
const queryClient = useQueryClient()

const page = ref(1)
const editingBio = ref(false)
const bioText = ref('')
const savingBio = ref(false)

const { data: user } = useQuery({
  queryKey: ['me'],
  queryFn: () => getMe().then((r) => r.data.data),
})

const { data: myImages, isLoading } = useQuery({
  queryKey: ['my-images', page],
  queryFn: () =>
    request.get('/users/me/images', { params: { page: page.value, size: 20 } }).then((r) => ({
      data: r.data.data,
      meta: r.data.meta,
    })),
  placeholderData: keepPreviousData,
})

function startEditBio() {
  bioText.value = user.value?.bio || ''
  editingBio.value = true
}

async function saveBio() {
  savingBio.value = true
  try {
    await request.patch('/users/me/bio', { bio: bioText.value })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    ElMessage.success('个人介绍已更新' + (user.value?.role !== 'admin' ? '，等待管理员审核' : ''))
    editingBio.value = false
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || '保存失败')
  } finally {
    savingBio.value = false
  }
}

function cancelEdit() {
  editingBio.value = false
}

const menuItems = [
  { label: '个人主页', to: '/profile' },
  { label: '我的上传', to: '/profile?tab=images' },
]
</script>

<template>
  <ProfileLayout title="个人主页">
    <template #menu>
      <router-link
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="px-3 py-2 rounded-lg text-sm no-underline transition-colors"
        :class="$route.fullPath === item.to || (item.to === '/profile' && !$route.query.tab)
          ? 'bg-blue-50 text-blue-600 font-medium'
          : 'text-gray-600 hover:bg-gray-50'"
      >
        {{ item.label }}
      </router-link>
    </template>

    <!-- User Info Card -->
    <div class="bg-white rounded-xl shadow-sm p-8 mb-8">
      <div class="flex items-start gap-6">
        <div class="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl shrink-0">
          {{ user?.username?.charAt(0)?.toUpperCase() || '?' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-1">
            <h2 class="text-xl font-bold">{{ user?.username }}</h2>
            <el-tag v-if="user?.role === 'admin'" size="small" type="danger">管理员</el-tag>
          </div>
          <p class="text-gray-400 text-sm mb-4">{{ user?.email }}</p>

          <!-- Bio -->
          <div v-if="!editingBio" class="text-gray-600">
            <p>
              {{ user?.bio && user?.bioStatus === 'approved' ? user.bio : '这个人很懒，什么也没留下' }}
              <span
                v-if="user?.bio && user?.bioStatus === 'pending'"
                class="text-xs text-orange-500 ml-2"
              >
                （审核中）
              </span>
            </p>
            <el-button size="small" text type="primary" class="mt-2" @click="startEditBio">
              {{ user?.bio ? '编辑' : '添加个人介绍' }}
            </el-button>
          </div>
          <div v-else class="flex flex-col gap-3">
            <el-input
              v-model="bioText"
              type="textarea"
              :rows="3"
              placeholder="介绍一下自己..."
              maxlength="500"
              show-word-limit
            />
            <div class="flex gap-2">
              <el-button size="small" type="primary" :loading="savingBio" @click="saveBio">保存</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- My Uploads -->
    <h2 class="text-lg font-bold mb-4">我的上传</h2>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-gray-400">加载中...</p>
    </div>

    <div v-else-if="!myImages?.data?.length" class="text-center py-10 bg-white rounded-xl">
      <p class="text-gray-400">还没有上传过图片</p>
      <el-button type="primary" class="mt-3" @click="router.push('/upload')">去上传第一张</el-button>
    </div>

    <div v-else class="columns-2 md:columns-3 gap-2 [column-fill:balance]">
      <ImageCard v-for="image in myImages.data" :key="image.id" :image="image" class="mb-2 break-inside-avoid" />
    </div>

    <div v-if="myImages?.meta && myImages.meta.totalPages > 1" class="flex justify-center mt-6">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="myImages.meta.total"
        background
        layout="prev, pager, next"
      />
    </div>
  </ProfileLayout>
</template>
