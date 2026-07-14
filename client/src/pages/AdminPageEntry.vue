<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login, register, getCaptcha } from '@/api/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const loading = ref(false)
const errorMsg = ref('')
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

// ========== 登录 ==========
const loginForm = reactive({ email: '', password: '' })
const loginRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true; errorMsg.value = ''
    try {
      const res = await login(loginForm)
      authStore.setTokens(res.data.data.accessToken, res.data.data.refreshToken)
      authStore.setUser(res.data.data.user)
      router.push('/admin')
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || '登录失败'
    } finally { loading.value = false }
  })
}

// ========== 注册 ==========
const registerForm = reactive({ username: '', email: '', password: '', confirmPassword: '', captchaText: '' })
const captchaSvg = ref('')
const captchaSessionId = ref('')

const validateConfirm = (_r: any, v: string, cb: any) => {
  cb(v !== registerForm.password ? new Error('两次密码不一致') : undefined)
}

const registerRules: FormRules = {
  username: [{ required: true, message: '请输入用户名' }, { min: 2, max: 32, message: '2-32位' }],
  email: [{ required: true, message: '请输入邮箱' }, { type: 'email', message: '无效邮箱' }],
  password: [{ required: true, message: '请输入密码' }, { min: 6, max: 64, message: '6-64位' }],
  confirmPassword: [{ required: true, message: '请确认密码' }, { validator: validateConfirm, trigger: 'blur' }],
  captchaText: [{ required: true, message: '请输入验证码' }],
}

async function fetchCaptcha() {
  try {
    const res = await getCaptcha()
    captchaSvg.value = res.data.data.svg
    captchaSessionId.value = res.data.data.sessionId
    registerForm.captchaText = ''
  } catch { /* ignore */ }
}
fetchCaptcha()

async function handleRegister() {
  if (!registerFormRef.value) return
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true; errorMsg.value = ''
    try {
      const res = await register({
        username: registerForm.username, email: registerForm.email, password: registerForm.password,
        captchaSessionId: captchaSessionId.value, captchaText: registerForm.captchaText,
      })
      authStore.setTokens(res.data.data.accessToken, res.data.data.refreshToken)
      authStore.setUser(res.data.data.user)
      router.push('/admin')
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || '注册失败'
      fetchCaptcha()
    } finally { loading.value = false }
  })
}

// 已登录则直接跳转后台
if (authStore.isLoggedIn && authStore.isAdmin) {
  router.replace('/admin')
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <img src="/logo.jpeg" alt="奶龙" class="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
        <h1 class="text-xl font-bold">奶龙后台管理</h1>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-8">
        <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon class="mb-4" closable @close="errorMsg = ''" />

        <el-tabs v-model="activeTab" class="mb-2">
          <el-tab-pane label="登录" name="login" />
          <el-tab-pane label="注册" name="register" />
        </el-tabs>

        <!-- 登录表单 -->
        <el-form v-if="activeTab === 'login'" ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top" @submit.prevent="handleLogin">
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="loginForm.email" placeholder="请输入邮箱" size="large" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" :loading="loading" class="w-full" size="large">登录</el-button>
          </el-form-item>
        </el-form>

        <!-- 注册表单 -->
        <el-form v-if="activeTab === 'register'" ref="registerFormRef" :model="registerForm" :rules="registerRules" label-position="top" @submit.prevent="handleRegister">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="registerForm.username" placeholder="输入用户名" />
          </el-form-item>
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="registerForm.email" placeholder="输入邮箱" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="registerForm.password" type="password" placeholder="输入密码（至少6位）" show-password />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="registerForm.confirmPassword" type="password" placeholder="再次输入密码" show-password />
          </el-form-item>
          <el-form-item label="验证码" prop="captchaText">
            <div class="flex gap-3 items-start">
              <el-input v-model="registerForm.captchaText" placeholder="输入验证码" class="flex-1" />
              <div class="h-10 bg-gray-100 rounded cursor-pointer border border-gray-200 flex items-center" v-html="captchaSvg" @click="fetchCaptcha" />
              <el-button text size="small" @click="fetchCaptcha">换一张</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" :loading="loading" class="w-full" size="large">注册</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>
