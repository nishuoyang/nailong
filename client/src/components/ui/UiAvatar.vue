<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string | null
    size?: number
    rounded?: 'squircle' | 'full'
  }>(),
  { size: 40, rounded: 'squircle', name: '?' },
)

const initial = computed(() => (props.name || '?').trim().charAt(0).toUpperCase())
const hue = computed(() => {
  let hash = 0
  for (const ch of props.name || 'nailong') hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return hash
})
const style = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.max(12, props.size * 0.4) + 'px',
  borderRadius: props.rounded === 'full' ? '999px' : Math.round(props.size * 0.3) + 'px',
  background: props.src
    ? 'var(--surface-2)'
    : `linear-gradient(145deg, hsl(${hue.value} 46% 78%), hsl(${(hue.value + 38) % 360} 52% 62%))`,
}))
</script>

<template>
  <span class="inline-flex shrink-0 items-center justify-center overflow-hidden border border-ink/10 font-semibold text-ink/80" :style="style">
    <img v-if="src" :src="src" :alt="name || '头像'" class="h-full w-full object-cover" loading="lazy" />
    <span v-else>{{ initial }}</span>
  </span>
</template>
