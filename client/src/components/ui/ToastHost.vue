<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import AppIcon from './AppIcon.vue'

const { state } = useToast()
const iconByType = { success: 'check', error: 'alert', info: 'info', warning: 'alert' } as const
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-6 left-1/2 z-[120] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in state.items"
          :key="t.id"
          class="pointer-events-auto flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_-18px_rgba(20,15,8,.55)]"
          :class="{
            'border-jade/30 bg-jade text-white': t.type === 'success',
            'border-accent/30 bg-accent text-accent-ink': t.type === 'error',
            'border-line bg-surface text-ink': t.type === 'info' || t.type === 'warning',
          }"
        >
          <AppIcon :name="iconByType[t.type]" :size="15" />
          <span class="leading-snug">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
</style>