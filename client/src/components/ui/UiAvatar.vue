<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { avatarHue } from '@/utils/avatar'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string | null
    size?: number
    rounded?: 'squircle' | 'full'
  }>(),
  { size: 40, rounded: 'squircle', name: '?' },
)

/** 图片加载失败（链接失效）时退回色块，而不是留一个破图标 */
const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const initial = computed(() => (props.name || '?').trim().charAt(0).toUpperCase())
const hue = computed(() => avatarHue(props.name))
const showImage = computed(() => !!props.src && !failed.value)
const style = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.max(12, props.size * 0.4) + 'px',
  borderRadius: props.rounded === 'full' ? '999px' : Math.round(props.size * 0.3) + 'px',
  background: showImage.value
    ? 'var(--surface-2)'
    : `linear-gradient(145deg, hsl(${hue.value} 46% 78%), hsl(${(hue.value + 38) % 360} 52% 62%))`,
}))

function onImageError() {
  failed.value = true
}
</script>

<template>
  <span class="inline-flex shrink-0 items-center justify-center overflow-hidden border border-ink/10 font-semibold text-ink/80" :style="style">
    <img v-if="showImage" :src="src ?? undefined" :alt="name || '头像'" class="h-full w-full object-cover" loading="lazy" @error="onImageError" />
    <span v-else>{{ initial }}</span>
  </span>
</template>
