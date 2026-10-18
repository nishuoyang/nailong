<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 40 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" aria-hidden="true" class="shrink-0">
    <rect x="3" y="3" width="42" height="42" rx="13" fill="#efbe4d" stroke="#181510" stroke-width="2.2" />
    <!-- little horns -->
    <path d="M15.5 9.5c-1.8-3-1-6 1.5-7.2 2.4 1.3 3.1 4.2 2 6.8" fill="#d9552b" stroke="#181510" stroke-width="1.8" stroke-linejoin="round" />
    <path d="M32.5 9.5c1.8-3 1-6-1.5-7.2-2.4 1.3-3.1 4.2-2 6.8" fill="#d9552b" stroke="#181510" stroke-width="1.8" stroke-linejoin="round" />
    <!-- eyes -->
    <ellipse cx="17.2" cy="23" rx="3.1" ry="3.9" fill="#181510" />
    <ellipse cx="30.8" cy="23" rx="3.1" ry="3.9" fill="#181510" />
    <circle cx="18.1" cy="21.7" r="1" fill="#fff8ee" />
    <circle cx="31.7" cy="21.7" r="1" fill="#fff8ee" />
    <!-- snout -->
    <path d="M15.5 30.5c0-4.1 3.8-6.4 8.5-6.4s8.5 2.3 8.5 6.4c0 4.2-3.8 7-8.5 7s-8.5-2.8-8.5-7Z" fill="#f6d98b" stroke="#181510" stroke-width="1.8" />
    <path d="M21 31.5c1.2 1.5 4.8 1.5 6 0" stroke="#181510" stroke-width="1.8" stroke-linecap="round" />
    <!-- cheeks -->
    <path d="M11 27.5c1 .4 1.6 1.2 1.8 2.2" stroke="#d9552b" stroke-width="1.6" stroke-linecap="round" opacity=".55" />
    <path d="M37 27.5c-1 .4-1.6 1.2-1.8 2.2" stroke="#d9552b" stroke-width="1.6" stroke-linecap="round" opacity=".55" />
  </svg>
</template>
