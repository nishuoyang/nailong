<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { eventYears, events, evidenceMeta } from '@/data/naiwaStory'

/**
 * 完整时间线：年份筛选、只看关键节点、自动放映。
 * 自动放映只是把年份轮播一遍，方便一眼看完 2020→2026 的节奏。
 */
const activeYear = ref<'all' | number>('all')
const keyOnly = ref(false)
const compact = ref(false)
const playing = ref(false)
let playTimer: number | undefined

const keyCount = events.filter((event) => event.key).length

const yearCounts = computed(() =>
  eventYears.map((year) => ({
    year,
    count: events.filter((event) => event.year === year).length,
  })),
)

const visibleEvents = computed(() =>
  events.filter((event) => {
    if (activeYear.value !== 'all' && event.year !== activeYear.value) return false
    if (keyOnly.value && !event.key) return false
    return true
  }),
)

function stopPlay() {
  playing.value = false
  if (playTimer) {
    window.clearInterval(playTimer)
    playTimer = undefined
  }
}

function advance() {
  const index = activeYear.value === 'all' ? -1 : eventYears.indexOf(activeYear.value)
  const next = eventYears[(index + 1) % eventYears.length]
  activeYear.value = next ?? 'all'
}

function togglePlay() {
  if (playing.value) {
    stopPlay()
    return
  }
  playing.value = true
  if (activeYear.value === 'all') advance()
  playTimer = window.setInterval(advance, 2200)
}

function pickYear(year: 'all' | number) {
  activeYear.value = year
  stopPlay()
}

function resetFilters() {
  activeYear.value = 'all'
  keyOnly.value = false
  compact.value = false
  stopPlay()
}

onBeforeUnmount(stopPlay)
</script>

<template>
  <div>
    <!-- 控制台 -->
    <div class="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="n-chip !h-8 !text-[11px]"
            :class="{ 'is-active': activeYear === 'all' }"
            :aria-pressed="activeYear === 'all'"
            @click="pickYear('all')"
          >
            全部 <span class="ml-1 font-mono text-[9px] opacity-70">{{ events.length }}</span>
          </button>
          <button
            v-for="item in yearCounts"
            :key="item.year"
            type="button"
            class="n-chip !h-8 !text-[11px]"
            :class="{ 'is-active': activeYear === item.year }"
            :aria-pressed="activeYear === item.year"
            @click="pickYear(item.year)"
          >
            {{ item.year }} <span class="ml-1 font-mono text-[9px] opacity-70">{{ item.count }}</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
            <input v-model="keyOnly" type="checkbox" class="h-3.5 w-3.5 accent-[var(--accent)]" />
            只看关键节点
          </label>
          <label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
            <input v-model="compact" type="checkbox" class="h-3.5 w-3.5 accent-[var(--accent)]" />
            精简正文
          </label>
          <button type="button" class="n-btn n-btn-outline n-btn-sm" :aria-pressed="playing" @click="togglePlay">
            <span class="font-mono text-[10px]">{{ playing ? 'Ⅱ' : '▶' }}</span>
            {{ playing ? '暂停放映' : '自动放映' }}
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
        <span>显示 {{ visibleEvents.length }} / {{ events.length }} 条 · 关键节点 {{ keyCount }}</span>
        <span>证据标签：确证 / 报道 / 争议 / 辟谣</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="relative mt-6 pl-[18px] sm:pl-[26px]">
      <div class="absolute bottom-2 left-[5px] top-2 w-px bg-line sm:left-[9px]" aria-hidden="true" />

      <TransitionGroup name="tl" tag="div" class="space-y-5">
        <article v-for="event in visibleEvents" :key="event.id" class="relative">
          <span
            class="absolute -left-[17px] top-[22px] h-2.5 w-2.5 rounded-full border-2 border-paper sm:-left-[21px]"
            :class="event.key ? 'bg-accent' : 'bg-line-strong'"
            aria-hidden="true"
          />

          <div class="rounded-[22px] border border-line bg-surface p-4 transition hover:border-line-strong sm:p-5">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <time class="font-mono text-[11px] tabular text-accent">{{ event.date }}</time>
              <span class="rounded-full border px-2 py-0.5 font-mono text-[8px] tracking-[0.08em]" :class="evidenceMeta[event.level].tone">
                {{ evidenceMeta[event.level].label }}
              </span>
              <span v-if="event.chip" class="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[8px] tracking-[0.08em] text-muted">
                {{ event.chip }}
              </span>
              <span v-if="event.key" class="ml-auto font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Key</span>
            </div>

            <h3 class="font-display text-[22px] leading-tight text-ink sm:text-[25px]">{{ event.title }}</h3>
            <p class="mt-1.5 text-[13px] leading-relaxed text-ink-2">{{ event.lead }}</p>
            <p v-if="event.body && !compact" class="mt-2 text-[12px] leading-relaxed text-muted">{{ event.body }}</p>

            <figure v-if="event.image" class="mt-3 max-w-md overflow-hidden rounded-xl border border-line">
              <img :src="event.image" :alt="event.imageAlt || event.title" class="aspect-[16/9] w-full object-cover" loading="lazy" />
              <figcaption class="px-3 py-2 text-[10px] leading-relaxed text-muted">{{ event.imageCaption }}</figcaption>
            </figure>

            <div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-2.5">
              <span class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">出处</span>
              <a
                v-for="id in event.sources"
                :key="id"
                :href="'#src-' + id"
                class="rounded-full border border-line bg-paper/60 px-2 py-0.5 font-mono text-[9px] text-accent no-underline transition hover:border-accent"
              >
                {{ id }}
              </a>
            </div>
          </div>
        </article>
      </TransitionGroup>

      <div v-if="!visibleEvents.length" class="rounded-[22px] border border-dashed border-line-strong bg-surface p-8 text-center">
        <p class="font-display text-[22px] text-ink">这一年没有符合条件的记录</p>
        <p class="mt-1 text-[12px] text-muted">换一年，或者关掉“只看关键节点”。</p>
        <button type="button" class="n-btn n-btn-outline n-btn-sm mt-4" @click="resetFilters">重置筛选</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl-enter-active,
.tl-leave-active {
  transition: opacity 0.25s ease, transform 0.25s var(--ease-out-expo);
}
.tl-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.tl-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.tl-move {
  transition: transform 0.3s var(--ease-out-expo);
}
@media (prefers-reduced-motion: reduce) {
  .tl-enter-active,
  .tl-leave-active,
  .tl-move {
    transition: none;
  }
}
</style>
