<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import request from '@/utils/request'
import { useToast } from '@/composables/useToast'
import AdminShell from '@/components/layout/AdminShell.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const toast = useToast()
const queryClient = useQueryClient()

const { data: settings, isLoading } = useQuery({
  queryKey: ['admin-settings'],
  queryFn: () => request.get('/admin/settings').then((r) => r.data.data),
})

const mutation = useMutation({
  mutationFn: (data: { registrationOpen?: boolean; loginRestricted?: boolean }) =>
    request.patch('/admin/settings', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    toast.success('设置已保存')
  },
  onError: (err: any) => toast.error(err.response?.data?.message || '保存失败'),
})

function toggleRegistration() {
  mutation.mutate({ registrationOpen: !settings.value?.registrationOpen })
}

function toggleLogin() {
  mutation.mutate({ loginRestricted: !settings.value?.loginRestricted })
}
</script>

<template>
  <AdminShell title="站点设置" eyebrow="Settings" description="应急开关会立刻生效，保存在数据库里，不依赖缓存。">
    <div v-if="isLoading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="n-skeleton h-28 rounded-[24px]" />
    </div>

    <div v-else class="space-y-3">
      <section class="flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jade/10 text-jade"><AppIcon name="users" :size="18" /></span>
          <div>
            <p class="text-sm font-semibold text-ink">开放注册</p>
            <p class="mt-1 text-xs leading-relaxed text-muted">关闭后，新用户无法注册。已有用户不受影响。</p>
            <p class="mt-2 font-mono text-[9px] uppercase tracking-[0.14em]" :class="settings?.registrationOpen ? 'text-jade' : 'text-accent'">
              {{ settings?.registrationOpen ? '● Registration open' : '● Registration closed' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="settings?.registrationOpen"
          :disabled="mutation.isPending.value"
          class="relative h-8 w-14 shrink-0 rounded-full transition"
          :class="settings?.registrationOpen ? 'bg-jade' : 'bg-line-strong'"
          @click="toggleRegistration"
        >
          <span class="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all" :class="settings?.registrationOpen ? 'left-7' : 'left-1'" />
        </button>
      </section>

      <section class="flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><AppIcon name="lock" :size="18" /></span>
          <div>
            <p class="text-sm font-semibold text-ink">限制登录</p>
            <p class="mt-1 text-xs leading-relaxed text-muted">开启后，仅管理员账号可以登录。适合维护或应急状态。</p>
            <p class="mt-2 font-mono text-[9px] uppercase tracking-[0.14em]" :class="settings?.loginRestricted ? 'text-accent' : 'text-muted'">
              {{ settings?.loginRestricted ? '● Admin only' : '● Everyone can sign in' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="settings?.loginRestricted"
          :disabled="mutation.isPending.value"
          class="relative h-8 w-14 shrink-0 rounded-full transition"
          :class="settings?.loginRestricted ? 'bg-accent' : 'bg-line-strong'"
          @click="toggleLogin"
        >
          <span class="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all" :class="settings?.loginRestricted ? 'left-7' : 'left-1'" />
        </button>
      </section>

      <section class="rounded-[24px] border border-dashed border-line px-5 py-4">
        <p class="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <AppIcon name="info" :size="14" class="mt-0.5 shrink-0 text-accent" />
          设置写入数据库 Setting 表，Redis 不可用或重启都不会让开关静默恢复默认值。修改会立即影响登录与注册接口。
        </p>
      </section>
    </div>
  </AdminShell>
</template>
