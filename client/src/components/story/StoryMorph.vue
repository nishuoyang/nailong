<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { morphStages } from '@/data/naiwaStory'

/**
 * “AI 事故模拟器”：用两张公开图片做视觉对照。
 * 它不是生成过程还原，只是把“龙 → 蛙”的形变差异做成可拖动的阅读装置。
 */
const value = ref(58)
const glitching = ref(false)
let glitchTimer: number | undefined

const stage = computed(() => {
  let current = morphStages[0]!
  for (const item of morphStages) {
    if (value.value >= item.at) current = item
  }
  return current
})

const glitchOpacity = computed(() => {
  const mid = 50
  const distance = Math.abs(value.value - mid)
  return Math.max(0, 0.34 - distance / 260)
})

function reroll() {
  value.value = 24 + Math.floor(Math.random() * 76)
  glitching.value = true
  if (glitchTimer) window.clearTimeout(glitchTimer)
  glitchTimer = window.setTimeout(() => {
    glitching.value = false
  }, 520)
}

onBeforeUnmount(() => {
  if (glitchTimer) window.clearTimeout(glitchTimer)
})
</script>

<template>
  <div class="relative overflow-hidden rounded-[26px] border border-line bg-surface">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div class="flex items-center gap-2">
        <span class="grid h-7 w-7 place-items-center rounded-full border border-ink/20 bg-butter text-[11px] font-bold text-[#181510]">AI</span>
        <div>
          <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Generation log</p>
          <p class="text-[13px] font-semibold text-ink">一次“事故”的可视化</p>
        </div>
      </div>
      <button class="n-btn n-btn-outline n-btn-sm" type="button" @click="reroll">
        重掷一次
      </button>
    </div>

    <div class="relative aspect-[16/10] overflow-hidden bg-paper-deep sm:aspect-[16/9]">
      <img
        src="/story/nailong-anime.jpg"
        alt="奶龙动画剧照：黄色圆头幼龙"
        class="absolute inset-0 h-full w-full object-cover"
        draggable="false"
      />
      <img
        src="/story/naiwa.jpg"
        alt="奶蛙：黄色梨形身体、绿色环状眼睛"
        class="absolute inset-0 h-full w-full object-cover will-change-[clip-path]"
        :style="{ clipPath: 'inset(0 0 0 ' + (100 - value) + '%)' }"
        draggable="false"
      />

      <!-- 扫描线 / 生成噪点 -->
      <div
        class="pointer-events-none absolute inset-0 mix-blend-overlay"
        :class="{ 'is-glitching': glitching }"
        :style="{
          opacity: glitchOpacity,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,.5) 0 1px, transparent 1px 4px)',
        }"
      />

      <!-- 分界线 -->
      <div class="pointer-events-none absolute inset-y-0 w-px bg-paper/90 shadow-[0_0_0_1px_rgba(24,21,16,.35)]" :style="{ left: value + '%' }" />
      <div
        class="pointer-events-none absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-ink bg-surface text-ink shadow-[2px_2px_0_0_var(--ink)]"
        :style="{ left: value + '%' }"
      >
        <span class="text-[13px]">↔</span>
      </div>

      <span class="absolute left-3 top-3 rounded-full border border-ink/15 bg-paper/85 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-ink backdrop-blur">
        奶龙 / 官方
      </span>
      <span class="absolute right-3 top-3 rounded-full border border-ink/15 bg-paper/85 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-ink backdrop-blur">
        奶蛙 / 野生
      </span>

      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#171208]/85 to-transparent px-4 pb-3 pt-10 text-paper">
        <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/60">{{ stage.code }}</p>
        <p class="mt-0.5 font-display text-[20px] leading-tight text-paper">{{ stage.label }}</p>
        <p class="mt-0.5 text-[11px] text-paper/75">{{ stage.note }}</p>
      </div>
    </div>

    <div class="px-4 pb-5 pt-4 sm:px-5">
      <label for="morph-range" class="sr-only">拖动查看奶龙到奶蛙的形变</label>
      <input
        id="morph-range"
        v-model.number="value"
        type="range"
        min="0"
        max="100"
        step="1"
        class="morph-range w-full"
        aria-valuetext="奶龙到奶蛙的形变程度"
      />
      <div class="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
        <span>0 · 龙</span>
        <span>{{ value }}%</span>
        <span>蛙 · 100</span>
      </div>
      <p class="mt-3 text-[12px] leading-relaxed text-muted">
        左半是官方奶龙，右半是 2026 年全网流传的奶蛙。拖动分界线，看看“圆头”是在哪一步变成“梨形”的。
        <span class="text-ink-2">这只是阅读装置，不是实际生成过程的还原。</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.morph-range {
  height: 22px;
  appearance: none;
  background: transparent;
  cursor: ew-resize;
}
.morph-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--jade), var(--butter));
}
.morph-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -8px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--surface);
  box-shadow: var(--shadow-hard-sm);
  transition: transform 0.15s var(--ease-spring);
}
.morph-range:active::-webkit-slider-thumb {
  transform: scale(1.12);
}
.morph-range::-moz-range-track {
  height: 4px;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--jade), var(--butter));
}
.morph-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--surface);
}
.is-glitching {
  animation: morph-glitch 0.16s steps(2) 3;
}
@keyframes morph-glitch {
  0% { transform: translateX(0); }
  50% { transform: translateX(-3px); }
  100% { transform: translateX(2px); }
}
@media (prefers-reduced-motion: reduce) {
  .is-glitching { animation: none; }
}
</style>
