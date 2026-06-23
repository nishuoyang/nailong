<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { register } from '@/api/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const validateConfirm = (_rule: unknown, value: string, callback: (err?: Error) => void) => {
  if (value !== form.password) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度 2-32 位', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      const { user, accessToken, refreshToken } = res.data.data
      authStore.setTokens(accessToken, refreshToken)
      authStore.setUser(user)
      router.push('/')
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || '注册失败，请稍后重试'
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold mb-2 text-center">注册</h1>
    <p class="text-gray-400 text-center mb-8">加入 奶龙，分享精彩图片</p>

    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon class="mb-4" closable @close="errorMsg = ''" />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="输入用户名" size="large" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="输入邮箱" size="large" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" placeholder="输入密码（至少6位）" size="large" show-password />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" size="large" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="w-full" size="large">
          注册
        </el-button>
      </el-form-item>
    </el-form>

    <p class="text-center text-sm text-gray-400">
      已有账号？
      <router-link to="/login" class="text-blue-600 no-underline hover:underline">去登录</router-link>
    </p>
  </div>
</template>
