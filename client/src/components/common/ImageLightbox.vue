<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    src: string
    alt: string
    title?: string
    /** 同批次多图时显示左右箭头，并启用方向键翻页 */
    hasNav?: boolean
    prevDisabled?: boolean
    nextDisabled?: boolean
    /** 形如 "2 / 5"，显示在标题下方 */
    indexLabel?: string
  }>(),
  { hasNav: false, prevDisabled: false, nextDisabled: false },
)
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

function close() {
  emit('update:modelValue', false)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (!props.hasNav) return
  if (event.key === 'ArrowLeft' && !props.prevDisabled) {
    event.preventDefault()
    emit('prev')
  } else if (event.key === 'ArrowRight' && !props.nextDisabled) {
    event.preventDefault()
    emit('next')
  }
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
    <Transition name="lightbox">
      <div v-if="modelValue" class="fixed inset-0 z-[95] flex flex-col bg-[#0d0a07]/96 text-white backdrop-blur-xl">
        <div class="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div class="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="" class="h-8 w-8 rounded-lg object-cover" />
            <div class="min-w-0">
              <p class="truncate font-display text-lg leading-none">{{ title || alt }}</p>
              <p class="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                <span>Nailong Archive · Original lightbox</span>
                <span v-if="indexLabel" class="rounded-full border border-white/20 px-2 py-0.5 tracking-[0.1em] text-white/70">{{ indexLabel }}</span>
              </p>
            </div>
          </div>
          <button class="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/80 transition hover:border-white/60 hover:text-white" aria-label="关闭大图" @click="close">
            <AppIcon name="close" :size="19" />
          </button>
        </div>
        <div class="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-8" @click="close">
          <img
            :src="src"
            :alt="alt"
            class="max-h-full max-w-full rounded-lg object-contain shadow-[0_30px_100px_-20px_rgba(0,0,0,.8)]"
            @click.stop
          />

          <template v-if="hasNav">
            <button
              class="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-25 sm:left-8"
              :disabled="prevDisabled"
              aria-label="上一张"
              @click.stop="emit('prev')"
            >
              <AppIcon name="chevron-left" :size="22" />
            </button>
            <button
              class="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-25 sm:right-8"
              :disabled="nextDisabled"
              aria-label="下一张"
              @click.stop="emit('next')"
            >
              <AppIcon name="chevron-right" :size="22" />
            </button>
          </template>
        </div>
        <div class="flex items-center justify-center gap-2 px-5 pb-5 sm:pb-7">
          <slot />
          <span class="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 sm:block">ESC 关闭</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.25s ease;
}
.lightbox-enter-active img,
.lightbox-leave-active img {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
.lightbox-enter-from img,
.lightbox-leave-to img {
  transform: scale(0.96);
}
</style>
