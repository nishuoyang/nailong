<script setup lang="ts">
import UiSpinner from './UiSpinner.vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'accent' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="n-btn"
    :class="[
      variant === 'primary' ? 'n-btn-primary' : '',
      variant === 'accent' ? 'n-btn-accent' : '',
      variant === 'outline' ? 'n-btn-outline' : '',
      variant === 'ghost' ? 'n-btn-ghost' : '',
      size === 'sm' ? 'n-btn-sm' : size === 'lg' ? 'n-btn-lg' : '',
      block ? 'w-full' : '',
    ]"
    :disabled="disabled || loading"
  >
    <UiSpinner v-if="loading" :size="size === 'lg' ? 18 : 15" />
    <slot />
  </button>
</template>
