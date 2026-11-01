<script setup lang="ts">
import { computed } from 'vue'
import { WHALE_TONES, type WhaleTone } from '@/data/whaleMemes'

/**
 * 表情包的底：渐变海面 + 光晕 + 气泡。所有颜色取自 tone，
 * 蓝色系为主，粉/沙色只作点缀，避免整面墙花掉。
 */
const props = defineProps<{
  tone: WhaleTone
  uid: string
}>()

const colors = computed(() => WHALE_TONES[props.tone])
const isNight = computed(() => colors.value.night)

const bubbles = [
  { x: 44, y: 118, r: 10, o: 0.55 },
  { x: 352, y: 92, r: 7, o: 0.5 },
  { x: 330, y: 262, r: 12, o: 0.42 },
  { x: 68, y: 310, r: 6, o: 0.5 },
  { x: 372, y: 196, r: 5, o: 0.6 },
  { x: 26, y: 214, r: 4, o: 0.5 },
  { x: 300, y: 42, r: 5, o: 0.55 },
  { x: 112, y: 58, r: 4, o: 0.45 },
]
</script>

<template>
  <g>
    <defs>
      <linearGradient :id="`${uid}-sky`" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0%" :stop-color="colors.from" />
        <stop offset="100%" :stop-color="colors.to" />
      </linearGradient>
      <radialGradient :id="`${uid}-glow`" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#FFFFFF" :stop-opacity="isNight ? 0.22 : 0.72" />
        <stop offset="62%" stop-color="#FFFFFF" :stop-opacity="isNight ? 0.06 : 0.24" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </radialGradient>
      <pattern :id="`${uid}-dots`" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="3.2" fill="#FFFFFF" :opacity="isNight ? 0.12 : 0.4" />
      </pattern>
      <pattern :id="`${uid}-grid`" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34 0H0V34" fill="none" stroke="#FFFFFF" stroke-width="1.4" :opacity="isNight ? 0.1 : 0.32" />
      </pattern>
      <pattern :id="`${uid}-stripe`" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <rect width="9" height="26" fill="#FFFFFF" :opacity="isNight ? 0.05 : 0.18" />
      </pattern>
    </defs>

    <rect width="400" height="400" :fill="`url(#${uid}-sky)`" />
    <circle cx="200" cy="186" r="164" :fill="`url(#${uid}-glow)`" />

    <!-- 纸感底纹 -->
    <rect v-if="tone === 'pink' || tone === 'sand'" width="400" height="400" :fill="`url(#${uid}-dots)`" />
    <rect v-else-if="tone === 'peri'" width="400" height="400" :fill="`url(#${uid}-grid)`" />
    <rect v-else-if="tone === 'night'" width="400" height="400" :fill="`url(#${uid}-grid)`" />
    <rect v-else width="400" height="400" :fill="`url(#${uid}-stripe)`" />

    <!-- 夜海：星星 + 月亮 -->
    <g v-if="isNight">
      <circle cx="326" cy="74" r="30" fill="#FFF3C4" opacity="0.95" />
      <circle cx="338" cy="64" r="27" :fill="colors.to" opacity="0.95" />
      <g fill="#EAF4FF">
        <path d="M70 74l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" opacity="0.85" />
        <path d="M286 156l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" opacity="0.7" />
        <path d="M54 224l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" opacity="0.5" />
        <circle cx="360" cy="250" r="2.6" opacity="0.8" />
        <circle cx="96" cy="332" r="2" opacity="0.6" />
        <circle cx="250" cy="30" r="2" opacity="0.7" />
      </g>
    </g>

    <!-- 光斑 -->
    <g v-else fill="#FFFFFF">
      <circle cx="72" cy="92" r="44" opacity="0.14" />
      <circle cx="334" cy="304" r="56" opacity="0.12" />
      <circle cx="300" cy="52" r="20" opacity="0.18" />
    </g>

    <!-- 海面波纹 -->
    <g :opacity="isNight ? 0.2 : 0.5" fill="none" stroke="#FFFFFF" stroke-linecap="round">
      <path d="M-10 352Q30 338 70 352T150 352T230 352T310 352T410 352" stroke-width="7" />
      <path d="M-10 372Q30 358 70 372T150 372T230 372T310 372T410 372" stroke-width="5" opacity="0.6" />
      <path d="M-10 390Q30 378 70 390T150 390T230 390T310 390T410 390" stroke-width="4" opacity="0.4" />
    </g>

    <!-- 气泡 -->
    <g fill="#FFFFFF" :opacity="isNight ? 0.5 : 0.85">
      <circle v-for="(bubble, index) in bubbles" :key="index" :cx="bubble.x" :cy="bubble.y" :r="bubble.r" :opacity="bubble.o" />
    </g>
    <g fill="none" stroke="#FFFFFF" :opacity="isNight ? 0.4 : 0.8" stroke-width="2">
      <circle cx="44" cy="118" r="10" />
      <circle cx="330" cy="262" r="12" />
    </g>
  </g>
</template>
