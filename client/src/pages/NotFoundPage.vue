<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const term = ref('')

function search() {
  if (term.value.trim()) router.push({ name: 'search', query: { q: term.value.trim() } })
}
</script>

<template>
  <div class="n-container relative overflow-hidden py-20 text-center sm:py-28">
    <div class="pointer-events-none absolute inset-0 dot-field opacity-20" />
    <div class="relative">
      <p class="font-display text-[120px] leading-none text-ink sm:text-[180px]">404</p>
      <div class="mx-auto -mt-4 mb-6 inline-flex -rotate-3 items-center gap-2 rounded-full border border-ink bg-butter px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#181510] shadow-[3px_3px_0_0_var(--ink)]">
        <AppIcon name="compass" :size="13" /> Lost in the universe
      </div>
      <h1 class="display text-[38px] leading-none text-ink sm:text-[54px]">这张图不在宇宙里</h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
        链接可能写错了，或者内容已经被删除。你可以回到发现页，或者搜一张新的。
      </p>

      <div class="mx-auto mt-7 flex max-w-md gap-2">
        <input v-model="term" class="n-input" placeholder="搜一张图…" @keyup.enter="search" />
        <button class="n-btn n-btn-primary" @click="search">搜索</button>
      </div>

      <div class="mt-7 flex flex-wrap justify-center gap-2">
        <RouterLink to="/" class="n-btn n-btn-primary no-underline">回发现页</RouterLink>
        <RouterLink to="/collections" class="n-btn n-btn-outline no-underline">逛收藏夹</RouterLink>
        <RouterLink to="/studio" class="n-btn n-btn-ghost no-underline"><AppIcon name="sparkles" :size="14" /> 做表情包</RouterLink>
      </div>
    </div>
  </div>
</template>