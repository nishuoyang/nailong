<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
  }>(),
  { title: '这里还空着', description: '换个筛选条件，或者成为第一个留下内容的人。', icon: 'sparkles' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div class="relative mb-5 grid h-16 w-16 place-items-center rounded-[22px] border border-line bg-surface-2 text-accent">
      <span class="absolute -right-2 -top-2 h-3 w-3 rounded-full border border-ink/20 bg-butter" />
      <AppIcon :name="icon" :size="28" />
    </div>
    <h3 class="font-display text-xl text-ink">{{ title }}</h3>
    <p class="mt-1 max-w-sm text-sm leading-relaxed text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
