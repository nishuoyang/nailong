<script setup lang="ts">
defineProps<{
  no: string
  title: string
  kicker?: string
  lede?: string
}>()
</script>

<template>
  <header class="mb-7">
    <div class="flex items-end gap-3 sm:gap-4">
      <span class="font-display text-[46px] leading-[0.8] tabular text-ink/15 sm:text-[56px]" aria-hidden="true">{{ no }}</span>
      <div class="min-w-0 pb-0.5">
        <p v-if="kicker" class="eyebrow mb-1.5">{{ kicker }}</p>
        <h2 class="display text-[30px] leading-[0.95] text-ink sm:text-[40px]">{{ title }}</h2>
      </div>
    </div>
    <p v-if="lede" class="mt-4 max-w-2xl text-[14px] leading-[1.85] text-ink-2">{{ lede }}</p>
    <div class="mt-5 flex items-center gap-2" aria-hidden="true">
      <span class="h-1.5 w-1.5 bg-accent" />
      <span class="h-px flex-1 bg-line" />
    </div>
  </header>
</template>
