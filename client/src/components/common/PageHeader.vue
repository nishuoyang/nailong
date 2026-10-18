<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    count?: number
    mark?: string
  }>(),
  { eyebrow: 'Nailong Archive', mark: '✳' },
)
</script>

<template>
  <header class="relative overflow-hidden border-b border-line">
    <div class="pointer-events-none absolute -right-10 -top-16 select-none font-display text-[180px] leading-none text-ink/[0.035] sm:text-[240px]">
      {{ mark }}
    </div>
    <div class="n-container relative pb-10 pt-12 sm:pb-14 sm:pt-16">
      <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-3xl">
          <p class="eyebrow mb-4 flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-accent" />
            {{ eyebrow }}
          </p>
          <h1 class="display text-[44px] leading-[0.95] text-ink sm:text-[64px]">
            {{ title }}
            <span v-if="count !== undefined" class="ml-2 align-super font-mono text-[12px] font-normal tracking-normal text-muted">
              ({{ count }})
            </span>
          </h1>
          <p v-if="description" class="mt-4 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
            {{ description }}
          </p>
        </div>
        <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
      <div v-if="$slots.meta" class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4">
        <slot name="meta" />
      </div>
    </div>
  </header>
</template>
