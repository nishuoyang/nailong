<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { uploadImage } from '@/api/upload'
import { getCategories } from '@/api/images'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'

const router = useRouter()
const route = useRoute()
const isOtherSection = route.query.section === 'other'

const formRef = ref<FormInstance>()
const uploading = ref(false)
const fileList = ref<UploadFile[]>([])
const previewUrl = ref<string | null>(null)

const form = reactive({
  title: '',
  description: '',
  categoryIds: [] as string[],
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入图片标题', trigger: 'blur' },
    { max: 255, message: '标题不能超过 255 字', trigger: 'blur' },
  ],
}

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => getCategories().then((r) => r.data.data),
})

function handleFileChange(file: UploadFile) {
  if (file.raw) {
    previewUrl.value = URL.createObjectURL(file.raw)
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  if (fileList.value.length === 0) {
    ElMessage.warning('请选择要上传的图片')
    return
  }
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    uploading.value = true
    try {
      const file = fileList.value[0].raw!
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', form.title)
      if (form.description) formData.append('description', form.description)
      if (form.categoryIds.length > 0) formData.append('categoryIds', JSON.stringify(form.categoryIds))
      if (isOtherSection) formData.append('section', 'other')
      await uploadImage(formData)
      ElMessage.success('上传成功，等待管理员审核')
      router.push('/profile')
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '上传失败')
    } finally {
      uploading.value = false
    }
  })
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-8">
      {{ isOtherSection ? '上传其他推荐图片' : '上传图片' }}
    </h1>
    <p v-if="isOtherSection" class="text-gray-500 text-sm -mt-6 mb-6">
      上传到「其他推荐」板块，展示与奶龙主题无关的图片
    </p>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <!-- Preview -->
      <div v-if="previewUrl" class="mb-6 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center p-4">
        <img :src="previewUrl" alt="预览" class="max-h-80 max-w-full object-contain" />
      </div>

      <!-- File Upload -->
      <el-form-item label="选择图片" required>
        <el-upload
          ref="uploadRef"
          v-model:file-list="fileList"
          :auto-upload="false"
          :limit="1"
          accept="image/jpeg,image/png,image/webp"
          list-type="picture"
          :on-change="handleFileChange"
        >
          <el-button type="primary">
            选择图片
          </el-button>
          <template #tip>
            <div class="text-xs text-gray-400 mt-1">
              支持 JPEG、PNG、WebP 格式，单文件不超过 10MB
            </div>
          </template>
        </el-upload>
      </el-form-item>

      <!-- Title -->
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="给图片起个名字" maxlength="255" show-word-limit />
      </el-form-item>

      <!-- Description -->
      <el-form-item label="描述（可选）">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述一下这张图片..."
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <!-- Categories -->
      <el-form-item label="分类（可选）">
        <el-select v-model="form.categoryIds" multiple placeholder="选择分类" class="w-full">
          <el-option
            v-for="cat in categories"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" size="large" :loading="uploading" @click="handleSubmit" class="w-full">
          提交上传
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
