<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from './AppIcon.vue'

defineProps<{
  label: string
  to?: string
  icon?: string
  active?: boolean
}>()
</script>

<template>
  <RouterLink v-if="to" :to="to" class="n-chip" :class="{ 'is-active': active }">
    <AppIcon v-if="icon" :name="icon" :size="13" />
    {{ label }}
  </RouterLink>
  <span v-else class="n-tag"><AppIcon v-if="icon" :name="icon" :size="11" />{{ label }}</span>
</template>
