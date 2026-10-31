<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 首屏的奶蛙脸：眼球跟随指针，点击/回车会“捧腹大笑”。
 * 全部用内联 SVG 画，避免再引入图片资源；也方便适配暗色模式。
 */
const root = ref<HTMLElement | null>(null)
const pupil = ref({ x: 0, y: 0 })
const laughing = ref(false)
const laughs = ref(0)
let laughTimer: number | undefined

function onPointerMove(event: PointerEvent) {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.38
  const dx = event.clientX - cx
  const dy = event.clientY - cy
  const distance = Math.hypot(dx, dy) || 1
  const strength = Math.min(1, distance / 180) * 7
  pupil.value = {
    x: Number(((dx / distance) * strength).toFixed(2)),
    y: Number(((dy / distance) * strength).toFixed(2)),
  }
}

function laugh() {
  if (laughing.value) return
  laughing.value = true
  laughs.value += 1
  try {
    localStorage.setItem('naiwa-story-laughs', String(laughs.value))
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  laughTimer = window.setTimeout(() => {
    laughing.value = false
  }, reduce ? 220 : 1100)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    laugh()
  }
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  try {
    laughs.value = Number(localStorage.getItem('naiwa-story-laughs') || '0') || 0
  } catch {
    laughs.value = 0
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  if (laughTimer) window.clearTimeout(laughTimer)
})
</script>

<template>
  <div ref="root" class="naiwa-stage">
    <div
      class="naiwa-hit"
      role="button"
      tabindex="0"
      aria-label="戳一下奶蛙，让它笑"
      :class="{ 'is-laughing': laughing }"
      @click="laugh"
      @keydown="onKeydown"
    >
      <svg viewBox="0 0 320 340" class="naiwa-svg" aria-hidden="true">
        <defs>
          <radialGradient id="naiwaBody" cx="38%" cy="26%" r="78%">
            <stop offset="0%" stop-color="#ffe27a" />
            <stop offset="52%" stop-color="#f4c944" />
            <stop offset="100%" stop-color="#e3a92c" />
          </radialGradient>
          <linearGradient id="naiwaBelly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6dd" />
            <stop offset="100%" stop-color="#eeddb7" />
          </linearGradient>
          <filter id="naiwaShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <ellipse cx="160" cy="330" rx="104" ry="10" fill="#181510" opacity="0.16" filter="url(#naiwaShadow)" />

        <path
          class="naiwa-body"
          d="M160 24 C118 24 92 56 88 102 C84 146 62 184 54 232 C44 292 94 330 160 330 C226 330 276 292 266 232 C258 184 236 146 232 102 C228 56 202 24 160 24 Z"
          fill="url(#naiwaBody)"
          stroke="#c58f22"
          stroke-width="1.5"
        />

        <ellipse cx="160" cy="256" rx="84" ry="60" fill="url(#naiwaBelly)" />
        <path d="M96 246 Q160 226 224 246" fill="none" stroke="#e2cfa5" stroke-width="2" opacity="0.8" />

        <!-- 左眼 -->
        <g class="naiwa-eye">
          <circle cx="122" cy="118" r="27" fill="#8fc47f" stroke="#5f9457" stroke-width="2.5" />
          <circle cx="122" cy="118" r="22" fill="#a9d494" opacity="0.55" />
          <circle :cx="122 + pupil.x" :cy="118 + pupil.y" r="9.5" fill="#171b0e" />
          <circle :cx="118.5 + pupil.x" :cy="114.5 + pupil.y" r="2.6" fill="#fff" opacity="0.5" />
        </g>

        <!-- 右眼 -->
        <g class="naiwa-eye">
          <circle cx="198" cy="118" r="27" fill="#8fc47f" stroke="#5f9457" stroke-width="2.5" />
          <circle cx="198" cy="118" r="22" fill="#a9d494" opacity="0.55" />
          <circle :cx="198 + pupil.x" :cy="118 + pupil.y" r="9.5" fill="#171b0e" />
          <circle :cx="194.5 + pupil.x" :cy="114.5 + pupil.y" r="2.6" fill="#fff" opacity="0.5" />
        </g>

        <!-- 普通嘴 / 大笑嘴 -->
        <path v-if="!laughing" d="M144 177 Q160 184 176 177" fill="none" stroke="#4a3714" stroke-width="3.6" stroke-linecap="round" />
        <g v-else class="naiwa-mouth">
          <path d="M128 166 Q160 158 192 166 Q188 210 160 216 Q132 210 128 166 Z" fill="#2a140c" stroke="#4a3714" stroke-width="2" />
          <ellipse cx="160" cy="201" rx="15" ry="8" fill="#cf7568" />
        </g>
      </svg>

      <div class="naiwa-has" aria-hidden="true">
        <span v-for="i in 3" :key="i" :style="'--i: ' + i">哈</span>
      </div>
    </div>

    <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
      <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        戳一下 · 它会笑
      </p>
      <p class="font-mono text-[9px] tabular text-muted">
        本机笑场 <span class="text-accent">{{ laughs }}</span> 次
      </p>
    </div>
  </div>
</template>

<style scoped>
.naiwa-stage {
  position: relative;
}
.naiwa-hit {
  position: relative;
  display: block;
  width: 100%;
  cursor: pointer;
  border-radius: 24px;
  outline: none;
  transition: transform 0.35s var(--ease-spring);
  -webkit-tap-highlight-color: transparent;
}
.naiwa-hit:hover {
  transform: translateY(-3px) rotate(-0.6deg);
}
.naiwa-hit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}
.naiwa-hit:active {
  transform: scale(0.985);
}
.naiwa-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.naiwa-body {
  transform-origin: 160px 300px;
}
.naiwa-hit.is-laughing .naiwa-body {
  animation: naiwa-bounce 0.9s var(--ease-spring);
}
.naiwa-hit.is-laughing .naiwa-eye {
  animation: naiwa-squint 0.9s var(--ease-spring);
  transform-box: fill-box;
  transform-origin: center;
}
.naiwa-mouth {
  animation: naiwa-mouth-pop 0.55s var(--ease-spring) both;
  transform-box: fill-box;
  transform-origin: center;
}
.naiwa-has {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: visible;
}
.naiwa-has span {
  position: absolute;
  left: 50%;
  top: 34%;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--accent);
  opacity: 0;
  transform: translate(-50%, 0) rotate(calc((var(--i) - 2) * 14deg));
}
.naiwa-hit.is-laughing .naiwa-has span {
  animation: naiwa-ha 0.95s var(--ease-out-expo) both;
  animation-delay: calc(var(--i) * 90ms);
}
@keyframes naiwa-bounce {
  0% { transform: scale(1, 1); }
  28% { transform: scale(1.06, 0.92); }
  55% { transform: scale(0.97, 1.04); }
  100% { transform: scale(1, 1); }
}
@keyframes naiwa-squint {
  0%, 100% { transform: scaleY(1); }
  40% { transform: scaleY(0.42); }
  70% { transform: scaleY(1); }
}
@keyframes naiwa-mouth-pop {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes naiwa-ha {
  0% { opacity: 0; transform: translate(-50%, 8px) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + (var(--i) - 2) * 26px), -54px) scale(1.1) rotate(calc((var(--i) - 2) * 18deg)); }
}
@media (prefers-reduced-motion: reduce) {
  .naiwa-hit,
  .naiwa-body,
  .naiwa-eye,
  .naiwa-mouth,
  .naiwa-has span {
    animation: none !important;
    transition: none !important;
  }
}
</style>
