<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'
import BrandMark from '@/components/ui/BrandMark.vue'
</script>

<template>
  <div class="n-container py-8 sm:py-12">
    <div class="grid min-h-[68vh] overflow-hidden rounded-[30px] border-[1.5px] border-ink bg-surface shadow-[6px_6px_0_0_var(--ink)] lg:grid-cols-[0.88fr_1.12fr]">
      <aside class="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex">
        <div class="pointer-events-none absolute inset-0 dot-field opacity-[0.14]" />
        <div class="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full border-[26px] border-butter/20" />
        <div class="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rotate-12 rounded-[42px] border-[22px] border-accent/20" />

        <div class="relative flex items-center gap-3">
          <span class="rotate-[-5deg]"><BrandMark :size="44" /></span>
          <span>
            <span class="block font-display text-xl leading-none">奶龙宇宙</span>
            <span class="mt-1 block font-mono text-[8px] uppercase tracking-[0.24em] text-paper/45">Nailong Archive</span>
          </span>
        </div>

        <div class="relative">
          <p class="font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">A small archive of good images</p>
          <h2 class="display mt-4 text-[46px] leading-[0.94]">
            好图太多，<br />慢慢看。
          </h2>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-paper/55">
            收藏喜欢的图，关注有意思的人，顺手把一张图做成表情包。这里不着急。
          </p>

          <div class="mt-10 flex w-full max-w-xs items-start gap-3">
            <div class="relative w-32 -rotate-3 rounded-xl border border-paper/20 bg-[#fbf7ee] p-2 pb-7 shadow-xl">
              <div class="grid aspect-[4/3] place-items-center rounded-md bg-[#efbe4d] text-[#181510]"><AppIcon name="sparkles" :size="24" /></div>
              <p class="absolute inset-x-2 bottom-1.5 font-display text-[12px] text-[#181510]">今天也要开心</p>
            </div>
            <div class="relative mt-5 w-32 rotate-3 rounded-xl border border-paper/20 bg-[#fbf7ee] p-2 pb-7 shadow-xl">
              <div class="grid aspect-[4/3] place-items-center rounded-md bg-jade text-white"><AppIcon name="heart" :size="24" filled /></div>
              <p class="absolute inset-x-2 bottom-1.5 font-display text-[12px] text-[#181510]">收藏这一秒</p>
            </div>
          </div>
        </div>

        <div class="relative flex items-center justify-between border-t border-paper/15 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/35">
          <span>Est. 2024 · CN</span>
          <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-jade" /> Online</span>
        </div>
      </aside>

      <section class="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>