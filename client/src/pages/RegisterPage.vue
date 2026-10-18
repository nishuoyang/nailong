<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCaptcha, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AuthShell from '@/components/layout/AuthShell.vue'
import TermsModal from '@/components/layout/TermsModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  captchaText: '',
  agreed: false,
})
const loading = ref(false)
const errorMsg = ref('')
const captchaSvg = ref('')
const captchaSessionId = ref('')
const showTerms = ref(false)
const showPassword = ref(false)

const passwordStrength = computed(() => {
  let score = 0
  if (form.password.length >= 6) score++
  if (form.password.length >= 10) score++
  if (/[A-Z]/.test(form.password) || /[^a-zA-Z0-9]/.test(form.password)) score++
  return score
})

async function fetchCaptcha() {
  try {
    const res = await getCaptcha()
    captchaSvg.value = res.data.data.svg
    captchaSessionId.value = res.data.data.sessionId
    form.captchaText = ''
  } catch {
    errorMsg.value = '验证码加载失败，点一下图片重试'
  }
}

onMounted(fetchCaptcha)

async function submit() {
  errorMsg.value = ''
  if (form.username.trim().length < 2) return (errorMsg.value = '用户名至少 2 个字符')
  if (!/^\S+@\S+\.\S+$/.test(form.email)) return (errorMsg.value = '请输入有效的邮箱')
  if (form.password.length < 6) return (errorMsg.value = '密码至少 6 位')
  if (form.password !== form.confirmPassword) return (errorMsg.value = '两次输入的密码不一致')
  if (!form.captchaText.trim()) return (errorMsg.value = '请输入验证码')
  if (!form.agreed) return (errorMsg.value = '请先阅读并同意用户协议')

  loading.value = true
  try {
    const res = await register({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      captchaSessionId: captchaSessionId.value,
      captchaText: form.captchaText.trim(),
    })
    const { user, accessToken, refreshToken } = res.data.data
    auth.setTokens(accessToken, refreshToken)
    auth.setUser(user)
    toast.success(`欢迎加入，${user.username}`)
    router.push('/')
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || '注册失败，请稍后重试'
    void fetchCaptcha()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <p class="eyebrow mb-3">Create account</p>
    <h1 class="display text-[40px] leading-none text-ink">加入宇宙</h1>
    <p class="mt-3 text-sm text-muted">一个账号，用来收藏、评论和投稿。</p>

    <div v-if="errorMsg" class="mt-5 flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent/8 px-4 py-3 text-sm text-accent">
      <AppIcon name="alert" :size="16" class="mt-0.5 shrink-0" />
      {{ errorMsg }}
    </div>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-ink-2">用户名</span>
          <input v-model="form.username" class="n-input !rounded-2xl !py-2.5" placeholder="怎么称呼你" maxlength="32" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-ink-2">邮箱</span>
          <input v-model="form.email" type="email" autocomplete="email" class="n-input !rounded-2xl !py-2.5" placeholder="you@example.com" />
        </label>
      </div>

      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-2">密码</span>
        <div class="relative">
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="n-input !rounded-2xl !py-2.5 pr-11"
            placeholder="至少 6 位"
          />
          <button type="button" class="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink" @click="showPassword = !showPassword">
            <AppIcon :name="showPassword ? 'eye' : 'lock'" :size="14" />
          </button>
        </div>
        <div class="mt-1.5 flex gap-1">
          <span v-for="i in 3" :key="i" class="h-1 flex-1 rounded-full transition" :class="passwordStrength >= i ? 'bg-jade' : 'bg-line'" />
        </div>
      </label>

      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-2">确认密码</span>
        <input v-model="form.confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="n-input !rounded-2xl !py-2.5" placeholder="再输一次" />
      </label>

      <div>
        <span class="mb-1.5 block text-xs font-medium text-ink-2">验证码</span>
        <div class="flex items-center gap-2">
          <input v-model="form.captchaText" class="n-input !rounded-2xl !py-2.5" placeholder="输入右侧字符" maxlength="8" />
          <button type="button" class="h-11 w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2 p-1 text-left" title="点击换一张" @click="fetchCaptcha">
            <span v-if="captchaSvg" class="flex h-full w-full items-center justify-center" v-html="captchaSvg" />
            <span v-else class="grid h-full place-items-center text-[10px] text-muted">加载中…</span>
          </button>
        </div>
      </div>

      <label class="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted">
        <button
          type="button"
          role="checkbox"
          :aria-checked="form.agreed"
          class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition"
          :class="form.agreed ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface'"
          @click="form.agreed = !form.agreed"
        >
          <AppIcon v-if="form.agreed" name="check" :size="10" :stroke-width="2.4" />
        </button>
        <span>
          我已阅读并同意
          <button type="button" class="text-ink underline decoration-accent/60 underline-offset-2 hover:text-accent" @click.prevent="showTerms = true">《用户协议》</button>
        </span>
      </label>

      <UiButton type="submit" variant="primary" size="lg" block :loading="loading">
        创建账号 <AppIcon name="arrow-right" :size="16" />
      </UiButton>
    </form>

    <p class="mt-5 text-center text-xs text-muted">
      已经有账号？
      <RouterLink to="/login" class="font-medium text-ink no-underline underline decoration-accent/50 underline-offset-4 hover:text-accent">去登录</RouterLink>
    </p>

    <TermsModal v-model="showTerms" />
  </AuthShell>
</template>
