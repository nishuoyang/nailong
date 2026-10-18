<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AuthShell from '@/components/layout/AuthShell.vue'
import TermsModal from '@/components/layout/TermsModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const toast = useToast()

const form = reactive({ email: '', password: '', agreed: false })
const loading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)
const showTerms = ref(false)

async function submit() {
  errorMsg.value = ''
  if (!form.email.trim()) {
    errorMsg.value = '请输入邮箱'
    return
  }
  if (form.password.length < 6) {
    errorMsg.value = '密码至少 6 位'
    return
  }
  if (!form.agreed) {
    errorMsg.value = '请先阅读并同意用户协议'
    return
  }
  loading.value = true
  try {
    const res = await login({ email: form.email.trim(), password: form.password })
    const { user, accessToken, refreshToken } = res.data.data
    auth.setTokens(accessToken, refreshToken)
    auth.setUser(user)
    toast.success(`欢迎回来，${user.username}`)
    router.push((route.query.redirect as string) || '/')
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <p class="eyebrow mb-3">Welcome back</p>
    <h1 class="display text-[42px] leading-none text-ink">登录</h1>
    <p class="mt-3 text-sm text-muted">回来看看今天又有什么新图。</p>

    <div v-if="errorMsg" class="mt-6 flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent/8 px-4 py-3 text-sm text-accent">
      <AppIcon name="alert" :size="16" class="mt-0.5 shrink-0" />
      {{ errorMsg }}
    </div>

    <form class="mt-7 space-y-5" autocomplete="on" @submit.prevent="submit">
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-2">邮箱</span>
        <div class="relative">
          <AppIcon name="mail" :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input v-model="form.email" type="email" autocomplete="email" class="n-input !rounded-2xl !py-3 pl-11" placeholder="you@example.com" />
        </div>
      </label>

      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-2">密码</span>
        <div class="relative">
          <AppIcon name="lock" :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="n-input !rounded-2xl !py-3 pl-11 pr-11"
            placeholder="至少 6 位"
          />
          <button type="button" class="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink" aria-label="显示或隐藏密码" @click="showPassword = !showPassword">
            <AppIcon :name="showPassword ? 'eye' : 'lock'" :size="14" />
          </button>
        </div>
      </label>

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
        进入宇宙 <AppIcon name="arrow-right" :size="16" />
      </UiButton>
    </form>

    <p class="mt-6 text-center text-xs text-muted">
      还没有账号？
      <RouterLink to="/register" class="font-medium text-ink no-underline underline decoration-accent/50 underline-offset-4 hover:text-accent">加入奶龙宇宙</RouterLink>
    </p>

    <TermsModal v-model="showTerms" />
  </AuthShell>
</template>
