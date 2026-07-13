<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { register, getCaptcha } from '@/api/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const captchaSvg = ref('')
const captchaSessionId = ref('')
const showTerms = ref(false)

const form = reactive({
  username: '',
  agreed: false,
  email: '',
  password: '',
  confirmPassword: '',
  captchaText: '',
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
  captchaText: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
  ],
  agreed: [
    {
      validator: (_rule, value, callback) => {
        if (!value) callback(new Error('请先阅读并同意用户协议'))
        else callback()
      },
      trigger: 'change',
    },
  ],
}

async function fetchCaptcha() {
  try {
    const res = await getCaptcha()
    captchaSvg.value = res.data.data.svg
    captchaSessionId.value = res.data.data.sessionId
    form.captchaText = ''
  } catch {
    // ignore
  }
}

onMounted(fetchCaptcha)

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
        captchaSessionId: captchaSessionId.value,
        captchaText: form.captchaText,
      })
      const { user, accessToken, refreshToken } = res.data.data
      authStore.setTokens(accessToken, refreshToken)
      authStore.setUser(user)
      router.push('/')
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || '注册失败，请稍后重试'
      fetchCaptcha() // 刷新验证码
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
      <el-form-item label="验证码" prop="captchaText">
        <div class="flex gap-3 items-start">
          <el-input v-model="form.captchaText" placeholder="输入验证码" size="large" class="flex-1" />
          <div class="flex items-center gap-2 shrink-0">
            <div
              class="h-10 bg-gray-100 rounded cursor-pointer border border-gray-200 flex items-center"
              v-html="captchaSvg"
              @click="fetchCaptcha"
            />
            <el-button text size="small" @click="fetchCaptcha" class="shrink-0">
              换一张
            </el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item prop="agreed">
        <el-checkbox v-model="form.agreed">
          <span class="text-sm text-gray-600">
            已阅读并同意
            <button type="button" class="text-blue-600 bg-transparent border-none cursor-pointer hover:underline" @click="showTerms = true">《用户协议》</button>
          </span>
        </el-checkbox>
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

    <!-- 用户协议弹窗 -->
    <el-dialog v-model="showTerms" title="用户协议" width="560px">
      <div class="text-sm text-gray-600 leading-relaxed max-h-80 overflow-y-auto space-y-3">
        <p>欢迎使用 奶龙 图片展示平台（以下简称"本平台"）。请您仔细阅读以下条款：</p>
        <p><strong>一、服务说明</strong><br />本平台提供图片浏览、上传、下载、点赞及交流互动服务。用户上传内容须遵守国家法律法规，不得上传违法、侵权、暴力、色情等内容。</p>
        <p><strong>二、用户行为规范</strong><br />1. 用户应对自己上传的内容承担全部责任；2. 禁止上传侵犯他人知识产权、肖像权、隐私权的内容；3. 禁止利用本平台进行任何违法活动；4. 禁止上传恶意代码、病毒或进行任何危害平台安全的行为。</p>
        <p><strong>三、内容审核</strong><br />用户上传的图片需经管理员审核后方可公开展示。管理员有权拒绝、下架或删除不符合规范的内容，无需事先通知。</p>
        <p><strong>四、知识产权</strong><br />用户保留对其上传内容的著作权。用户授予本平台在平台范围内展示、分发其内容的非独占许可。未经作者许可，其他用户不得将平台内容用于商业用途。</p>
        <p><strong>五、免责声明</strong><br />本平台不对用户上传内容的合法性、真实性负责。因用户违反本协议造成的任何法律后果，由用户自行承担。本平台有权随时修改本协议，修改后将在平台公示。</p>
        <p><strong>六、隐私保护</strong><br />本平台重视用户隐私，不会向第三方出售或分享用户个人信息。用户上传的图片如包含个人隐私信息，由上传者自行承担风险。</p>
        <p>若您不同意以上条款，请停止使用本平台。继续使用即表示您已阅读并同意本协议的全部内容。</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showTerms = false">我知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>
