<script setup lang="ts">
import { computed, ref } from 'vue'
import { recipeIngredients } from '@/data/naiwaStory'

/**
 * “爆款配方”拆解：不是教人做视频，而是把媒体报道里的共同元素
 * 变成一个可以拨动的解释器。分值只是叙事化的权重，不是数据模型。
 */
const picked = ref<string[]>(['yellow', 'laugh', 'voice'])

const score = computed(() =>
  recipeIngredients
    .filter((item) => picked.value.includes(item.id))
    .reduce((total, item) => total + item.points, 0),
)

const filledSegments = computed(() => Math.round(score.value / 5))

const pickedItems = computed(() => recipeIngredients.filter((item) => picked.value.includes(item.id)))

const verdict = computed(() => {
  const value = score.value
  if (value === 0) return '一张普通的奶龙截图。还没有人笑。'
  if (value <= 30) return '有点怪，但还绷得住。适合发在只有三个人的小群。'
  if (value <= 60) return '群里开始有人问“这是什么”。第一张表情包已经被保存。'
  if (value <= 85) return '算法开始推了。评论区出现第一批“哈哈哈哈”和第一批“好恶心”。'
  if (value < 100) return '已经在三个群里看到它了。有人开始做名画二创。'
  return '现象级。官方准备关闭评论区。你拦不住它了。'
})

function toggle(id: string) {
  picked.value = picked.value.includes(id)
    ? picked.value.filter((item) => item !== id)
    : [...picked.value, id]
}

function randomize() {
  const shuffled = [...recipeIngredients].sort(() => Math.random() - 0.5)
  const count = 3 + Math.floor(Math.random() * 4)
  picked.value = shuffled.slice(0, count).map((item) => item.id)
}

function clearAll() {
  picked.value = []
}
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
    <!-- 材料 -->
    <div class="rounded-[26px] border border-line bg-surface p-4 sm:p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Recipe lab · 2026</p>
          <h4 class="mt-1 font-display text-[26px] leading-none text-ink">一条奶蛙视频的配方</h4>
        </div>
        <div class="flex gap-1.5">
          <button type="button" class="n-btn n-btn-outline n-btn-sm" @click="randomize">随机</button>
          <button type="button" class="n-btn n-btn-ghost n-btn-sm" @click="clearAll">清空</button>
        </div>
      </div>

      <div class="mt-4 space-y-2">
        <label
          v-for="item in recipeIngredients"
          :key="item.id"
          class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition"
          :class="picked.includes(item.id) ? 'border-ink bg-butter/15' : 'border-line hover:border-line-strong hover:bg-surface-2'"
        >
          <input
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            :checked="picked.includes(item.id)"
            @change="toggle(item.id)"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-3">
              <span class="text-[13px] font-semibold text-ink">{{ item.label }}</span>
              <span class="shrink-0 font-mono text-[10px] text-muted">+{{ item.points }}</span>
            </span>
            <span class="mt-0.5 block text-[11px] leading-relaxed text-muted">{{ item.note }}</span>
          </span>
        </label>
      </div>

      <p class="mt-4 text-[10px] leading-relaxed text-muted">
        配方拆解自 3DM、手谈姬、机核与 B 站二创的公开描述；分值只是叙事化权重，不是传播学模型。
      </p>
    </div>

    <!-- 结果 -->
    <div class="relative overflow-hidden rounded-[26px] border border-ink/20 bg-paper-deep/60 p-4 sm:p-5">
      <div class="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-butter/30 blur-2xl" />
      <div class="relative">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Abstract index</p>
            <p class="mt-1 font-display text-[56px] leading-none tabular text-ink">
              {{ String(score).padStart(3, '0') }}<span class="ml-1 text-[16px] text-muted">/100</span>
            </p>
          </div>
          <span class="mr-1.5 shrink-0 rotate-[-4deg] rounded-md border-2 border-accent px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-accent">
            {{ score >= 86 ? '已失控' : score >= 61 ? '在扩散' : '可控' }}
          </span>
        </div>

        <div class="mt-4 flex gap-[3px]" role="img" :aria-label="'抽象指数 ' + score + ' / 100'">
          <span
            v-for="segment in 20"
            :key="segment"
            class="h-7 flex-1 rounded-[2px] transition-colors duration-300"
            :class="segment <= filledSegments ? 'bg-accent' : 'bg-ink/10'"
          />
        </div>
        <div class="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
          <span>0 · 正常</span>
          <span>50 · 开始抽象</span>
          <span>100 · 关评</span>
        </div>

        <div class="mt-5 rounded-2xl border border-line bg-surface p-4">
          <p class="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">Predicted outcome</p>
          <p class="mt-1.5 text-[14px] leading-relaxed text-ink-2">{{ verdict }}</p>
        </div>

        <div class="mt-4">
          <p class="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">当前配方</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span
              v-for="item in pickedItems"
              :key="item.id"
              class="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] text-ink-2"
            >
              {{ item.label }}
            </span>
            <span v-if="!pickedItems.length" class="text-[11px] text-muted">还没有选材料。</span>
          </div>
        </div>

        <p class="mt-5 border-t border-line pt-3 text-[10px] leading-relaxed text-muted">
          这不是“教你做爆款”。它只是把已经发生的事，拆成可以逐项指认的零件。
        </p>
      </div>
    </div>
  </div>
</template>
