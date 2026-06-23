<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login } from '@/api/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  email: '',
  password: '',
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await login(form)
      const { user, accessToken, refreshToken } = res.data.data
      authStore.setTokens(accessToken, refreshToken)
      authStore.setUser(user)
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || '登录失败，请稍后重试'
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold mb-2 text-center">登录</h1>
    <p class="text-gray-400 text-center mb-8">欢迎回到 Nai Long</p>

    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon class="mb-4" closable @close="errorMsg = ''" />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱" size="large" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="w-full" size="large">
          登录
        </el-button>
      </el-form-item>
    </el-form>

    <p class="text-center text-sm text-gray-400">
      还没有账号？
      <router-link to="/register" class="text-blue-600 no-underline hover:underline">去注册</router-link>
    </p>
  </div>
</template>
