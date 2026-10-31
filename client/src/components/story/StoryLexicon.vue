<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { glossary } from '@/data/naiwaStory'

const query = ref('')
const category = ref<'全部' | '人物' | '形象' | '梗' | '平台' | '事件'>('全部')
const openTerm = ref<string | null>('奶蛙')

const categories = ['全部', '人物', '形象', '梗', '平台', '事件'] as const

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return glossary.filter((entry) => {
    if (category.value !== '全部' && entry.category !== category.value) return false
    if (!q) return true
    return [entry.term, entry.alias ?? '', entry.short, entry.detail]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
})

function toggle(term: string) {
  openTerm.value = openTerm.value === term ? null : term
}

function reset() {
  query.value = ''
  category.value = '全部'
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative w-full sm:max-w-xs">
        <AppIcon name="search" :size="15" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          v-model="query"
          type="search"
          class="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-[13px] text-ink outline-none transition placeholder:text-muted focus:border-ink"
          placeholder="搜一个词，比如“蛙母”"
          aria-label="搜索奶蛙词典"
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="item in categories"
          :key="item"
          type="button"
          class="n-chip !h-8 !text-[11px]"
          :class="{ 'is-active': category === item }"
          :aria-pressed="category === item"
          @click="category = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2">
      <article
        v-for="entry in filtered"
        :key="entry.term"
        class="overflow-hidden rounded-[20px] border bg-surface transition"
        :class="openTerm === entry.term ? 'border-ink shadow-[3px_3px_0_0_var(--ink)]' : 'border-line hover:border-line-strong'"
      >
        <button type="button" class="flex w-full items-start gap-3 p-4 text-left" :aria-expanded="openTerm === entry.term" @click="toggle(entry.term)">
          <span class="mt-0.5 shrink-0 rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
            {{ entry.category }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span class="font-display text-[23px] leading-none text-ink">{{ entry.term }}</span>
              <span v-if="entry.alias" class="font-mono text-[9px] text-muted">{{ entry.alias }}</span>
            </span>
            <span class="mt-1.5 block text-[12px] leading-relaxed text-ink-2">{{ entry.short }}</span>
          </span>
          <span class="mt-1 font-mono text-[13px] text-muted transition" :class="{ 'rotate-45': openTerm === entry.term }">＋</span>
        </button>

        <Transition name="lex">
          <div v-if="openTerm === entry.term" class="border-t border-line/70 bg-paper-deep/35 px-4 py-3">
            <p class="text-[12px] leading-relaxed text-muted">{{ entry.detail }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">出处</span>
              <a
                v-for="id in entry.sources"
                :key="id"
                :href="'#src-' + id"
                class="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[9px] text-accent no-underline transition hover:border-accent"
              >
                {{ id }}
              </a>
            </div>
          </div>
        </Transition>
      </article>
    </div>

    <div v-if="!filtered.length" class="mt-5 rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center">
      <p class="font-display text-[22px] text-ink">词典里没有这个词</p>
      <p class="mt-1 text-[12px] text-muted">换一个关键词，或者回到全部分类。</p>
      <button type="button" class="n-btn n-btn-outline n-btn-sm mt-4" @click="reset">清空筛选</button>
    </div>
  </div>
</template>

<style scoped>
.lex-enter-active,
.lex-leave-active {
  transition: opacity 0.18s ease;
}
.lex-enter-from,
.lex-leave-to {
  opacity: 0;
}
</style>
