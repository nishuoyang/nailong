<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
    closable?: boolean
    padded?: boolean
  }>(),
  { width: '560px', closable: true, padded: true },
)
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function close() {
  emit('update:modelValue', false)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-[#15110b]/55 backdrop-blur-sm" @click="closable && close()" />
        <div
          class="relative max-h-[90dvh] w-full overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_40px_120px_-30px_rgba(20,15,8,.65)]"
          :style="{ maxWidth: width }"
        >
          <header v-if="title || closable" class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div class="min-w-0">
              <h2 class="truncate font-display text-xl text-ink">{{ title }}</h2>
              <slot name="subtitle" />
            </div>
            <button v-if="closable" class="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" aria-label="关闭" @click="close">
              <AppIcon name="close" :size="17" />
            </button>
          </header>
          <div class="max-h-[calc(90dvh-64px)] overflow-y-auto" :class="padded ? 'p-5 sm:p-6' : ''">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(18px) scale(0.97);
  opacity: 0;
}
</style>
