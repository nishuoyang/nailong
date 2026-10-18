<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    rounded?: string
    circle?: boolean
  }>(),
  { width: '100%', height: '16px', rounded: '12px', circle: false },
)
</script>

<template>
  <div
    class="n-skeleton"
    :style="{ width, height, borderRadius: circle ? '999px' : rounded }"
    aria-hidden="true"
  />
</template>
