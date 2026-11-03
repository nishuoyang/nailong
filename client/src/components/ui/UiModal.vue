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
    <!-- duration 必须显式给：遮罩层不再有 CSS 过渡，Vue 只能靠这里的毫秒数决定何时摘掉动画类 -->
    <Transition name="modal" :duration="{ enter: 380, leave: 380 }">
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="n-modal-scrim absolute inset-0" @click="closable && close()" />
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
/*
 * 遮罩层的虚化来自 backdrop-filter，因此**不能**给它或它的任何祖先加 opacity 动画：
 * opacity < 1 会把这一层变成 backdrop root，内部的 blur 只能采样 root 内（空）的内容，
 * 表现就是「底色先暗下来、过渡结束那一瞬背景才突然糊掉」（实测 ≈0.3s，图片页更久）。
 * 所以这里只渐变 background-color —— 模糊从挂载的第一帧就生效，压暗仍然柔和。
 *
 * 关闭时反过来：底色淡到透明后模糊还在，节点被摘掉那一刻整页突然变清晰（更突兀）。
 * 所以 leave 时把 blur 半径一起降到 0 —— 只能动 filter 参数，动 opacity 会再次触发上面的问题。
 * enter 阶段 blur 值不变（8px 常驻），不会触发过渡，开仍是瞬时的。
 */
.n-modal-scrim {
  background-color: rgba(21, 17, 11, 0.55);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition:
    background-color 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    -webkit-backdrop-filter 0.36s cubic-bezier(0.15, 0.5, 0.35, 1),
    backdrop-filter 0.36s cubic-bezier(0.15, 0.5, 0.35, 1);
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}
.modal-enter-from .n-modal-scrim {
  background-color: rgba(21, 17, 11, 0);
}
.modal-leave-to .n-modal-scrim {
  background-color: rgba(21, 17, 11, 0);
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(18px) scale(0.97);
  opacity: 0;
}
</style>
