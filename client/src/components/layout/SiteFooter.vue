<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'
import BrandMark from '@/components/ui/BrandMark.vue'

const emit = defineEmits<{ (e: 'feedback'): void }>()
const year = new Date().getFullYear()

const groups = [
  {
    title: '逛一逛',
    links: [
      { label: '发现', to: '/' },
      { label: '精选', to: '/featured' },
      { label: '其他推荐', to: '/other' },
      { label: '收藏夹', to: '/collections' },
    ],
  },
  {
    title: '玩一玩',
    links: [
      { label: '表情包工坊', to: '/studio' },
      { label: '奶蛙史', to: '/story' },
      { label: '投稿', to: '/upload' },
      { label: '关注动态', to: '/feed' },
    ],
  },
]

const phrases = ['发现好图', '收藏灵感', '三秒出片', '把喜欢的贴满宇宙', '奶龙宇宙']
</script>

<template>
  <footer class="relative mt-24 overflow-hidden border-t border-line bg-paper-deep">
    <!-- marquee -->
    <div class="overflow-hidden border-b border-line py-2.5">
      <div class="flex w-max animate-marquee items-center gap-6 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
        <template v-for="n in 2" :key="n">
          <span v-for="phrase in phrases" :key="phrase + n" class="flex items-center gap-6">
            {{ phrase }}
            <span class="text-accent">✳</span>
          </span>
        </template>
      </div>
    </div>

    <div class="n-container relative py-16 sm:py-20">
      <div class="grid gap-12 lg:grid-cols-[1.35fr_1fr_1fr]">
        <div>
          <p class="eyebrow mb-5">The Nailong Archive</p>
          <h2 class="display max-w-md text-[38px] text-ink sm:text-[46px]">
            好图不该<br />
            只躺在<span class="relative inline-block text-accent">相册里<span class="absolute -right-3 -top-1 text-[14px]">✳</span></span>。
          </h2>
          <p class="mt-5 max-w-sm text-sm leading-relaxed text-ink-2">
            一个不太正经的图片档案馆。看图、收藏、聊天，顺手把一张图做成只属于你的表情包。
          </p>
          <div class="mt-7 flex flex-wrap gap-2">
            <RouterLink to="/" class="n-btn n-btn-primary no-underline">
              开始逛逛 <AppIcon name="arrow-right" :size="15" />
            </RouterLink>
            <RouterLink to="/studio" class="n-btn n-btn-outline no-underline">
              <AppIcon name="sparkles" :size="15" /> 做张表情包
            </RouterLink>
          </div>
        </div>

        <div v-for="group in groups" :key="group.title">
          <p class="eyebrow mb-5">{{ group.title }}</p>
          <ul class="space-y-3">
            <li v-for="link in group.links" :key="link.to">
              <RouterLink :to="link.to" class="group inline-flex items-center gap-2 text-sm text-ink-2 no-underline transition hover:text-accent">
                {{ link.label }}
                <AppIcon name="arrow-up-right" :size="12" class="opacity-0 transition group-hover:opacity-100" />
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-16 flex flex-col gap-6 border-t border-line pt-7 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex items-center gap-3">
          <span class="rotate-[-5deg]"><BrandMark :size="42" /></span>
          <div>
            <p class="font-display text-lg leading-none text-ink">奶龙宇宙</p>
            <p class="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Images belong to their authors</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <button class="inline-flex items-center gap-1.5 transition hover:text-ink" @click="emit('feedback')">
            <AppIcon name="mail" :size="13" /> 意见反馈
          </button>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" class="no-underline transition hover:text-ink">
            苏ICP备2026047429号-1
          </a>
          <span class="font-mono">© {{ year }} NAILONG</span>
        </div>
      </div>
    </div>

    <!-- oversized watermark -->
    <div aria-hidden="true" class="pointer-events-none select-none overflow-hidden">
      <p class="translate-y-[28%] whitespace-nowrap text-center font-display text-[18vw] leading-none text-ink/[0.045]">
        NAILONG UNIVERSE
      </p>
    </div>
  </footer>
</template>