<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppIcon from '@/components/ui/AppIcon.vue'
import MemeSticker from '@/components/whale/MemeSticker.vue'
import MemeUploadModal from '@/components/whale/MemeUploadModal.vue'
import MemeViewer from '@/components/whale/MemeViewer.vue'
import { getMemes } from '@/api/memes'
import {
  WHALE_MEMES_FALLBACK,
  WHALE_MOODS,
  WHALE_STATS,
  WHALE_TICKER,
  countByMood,
  toWhaleMeme,
  type WhaleMeme,
  type WhaleMoodFilter,
} from '@/data/whaleMemes'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import '@/styles/whale.css'

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

// 表情包列表：API 驱动（合集 100 张 + 审核通过的用户投喂）；接口不可用时退回内置精选
const { data: apiMemes, isError } = useQuery({
  queryKey: ['whale-memes'],
  queryFn: () => getMemes({ size: 500 }).then((r) => r.data.data.map(toWhaleMeme)),
  staleTime: 60_000,
})

const memes = computed<WhaleMeme[]>(() =>
  apiMemes.value?.length ? apiMemes.value : WHALE_MEMES_FALLBACK,
)

const activeMood = ref<WhaleMoodFilter>('all')
const keyword = ref('')
const viewerPool = ref<WhaleMeme[]>([])
const viewerIndex = ref(-1)
const uploadOpen = ref(false)

const filtered = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  return memes.value.filter((meme) => {
    if (activeMood.value !== 'all' && meme.mood !== activeMood.value) return false
    if (!term) return true
    return [meme.title ?? '', meme.top, meme.bottom, meme.note, ...meme.tags].join(' ').toLowerCase().includes(term)
  })
})

const total = computed(() => memes.value.length)
const tickerItems = computed(() => [...WHALE_TICKER, ...WHALE_TICKER])
const bubbles = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 7.3 + 4) % 96}%`,
  size: 8 + ((index * 7) % 26),
  delay: -((index * 1.7) % 16),
  duration: 12 + ((index * 3) % 10),
  opacity: 0.18 + ((index * 5) % 30) / 100,
}))

function countOf(mood: WhaleMoodFilter) {
  return mood === 'all' ? total.value : countByMood(memes.value, mood)
}

function openMeme(meme: WhaleMeme) {
  const pool = filtered.value.length ? filtered.value : memes.value
  const index = pool.findIndex((item) => item.id === meme.id)
  viewerPool.value = index >= 0 ? pool : memes.value
  viewerIndex.value = index >= 0 ? index : memes.value.findIndex((item) => item.id === meme.id)
}

function randomMeme() {
  const pool = filtered.value.length ? filtered.value : memes.value
  if (!pool.length) return
  viewerPool.value = pool
  viewerIndex.value = Math.floor(Math.random() * pool.length)
}

function clearFilters() {
  activeMood.value = 'all'
  keyword.value = ''
}

function openUpload() {
  if (!authStore.isLoggedIn) {
    toast.info('登录后才能投喂表情包')
    router.push({ path: '/login', query: { redirect: '/deepsea' } })
    return
  }
  uploadOpen.value = true
}

const depth = ref(0)
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    depth.value = Math.min(120, Math.round((window.scrollY / max) * 120))
    ticking = false
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="whale-world">
    <!-- ══════════════════════ HERO ══════════════════════ -->
    <section class="wh-hero">
      <div class="wh-hero__rays" aria-hidden="true" />
      <div class="wh-hero__bubbles" aria-hidden="true">
        <span
          v-for="(bubble, index) in bubbles"
          :key="index"
          :style="{
            left: bubble.left,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
            opacity: bubble.opacity,
          }"
        />
      </div>
      <span class="wh-hero__watermark" aria-hidden="true">深度摸鱼</span>

      <div class="wh-shell wh-hero__grid">
        <div class="wh-hero__copy">
          <div class="wh-hero__kicker">
            <span class="wh-hero__live" />
            DEEP FISHING CLUB
            <span class="wh-hero__kicker-sep">/</span>
            非官方表情包档案馆
          </div>

          <h1 class="wh-hero__title">
            <span class="c1">大</span><span class="c2">肥</span><span class="c3">鱼</span>
            <span class="wh-hero__stamp">表情包</span>
          </h1>

          <p class="wh-hero__sub">DeepSeek 鲸鱼娘 · 吃白饭的蓝色大肥鱼</p>
          <p class="wh-hero__lede">
            最初只是一个乌龙：有人把 DeepSeek 的蓝鲸 Logo 发给她认，<br />
            她一本正经地说这是一条「蓝色大肥鱼」。<br />
            后来网友给她接上蓝发、鲸尾和女仆装——吃饭积极、干活随缘、内心戏很多。
          </p>

          <div class="wh-hero__cta">
            <a class="wh-btn wh-btn--sun" href="#wh-wall">
              开始摸鱼
              <AppIcon name="arrow-down" :size="16" />
            </a>
            <button class="wh-btn wh-btn--ghost" type="button" @click="randomMeme">
              <AppIcon name="dice" :size="16" />
              随机抽一张
            </button>
            <button class="wh-btn wh-btn--ghost" type="button" @click="openUpload">
              <AppIcon name="upload" :size="16" />
              投喂一张
            </button>
          </div>

          <div class="wh-hero__meta">
            <span>{{ total }} 张在册</span>
            <i />
            <span>5 类情绪</span>
            <i />
            <span>持续增肥中</span>
            <i />
            <span class="wh-hero__poke-hint">点鱼脸随机抽</span>
          </div>
        </div>

        <div class="wh-hero__visual">
          <div class="wh-hero__glow" aria-hidden="true" />
          <div class="wh-hero__ring" aria-hidden="true" />
          <button
            class="wh-hero__sticker"
            type="button"
            aria-label="随机抽一张大肥鱼表情包"
            @click="randomMeme"
          >
            <img
              class="wh-hero__portrait"
              src="/whale/dafeiyu-chibi.webp"
              alt="大肥鱼 · 蓝发鲸鱼娘女仆形态"
              width="800"
              height="831"
            />
            <span class="wh-hero__nametag">大肥鱼 · 女仆形态</span>
          </button>
          <span class="wh-hero__tag wh-hero__tag--top">NEW<small>{{ total }}</small></span>
          <span class="wh-hero__tag wh-hero__tag--side">{{ total }} 张动图</span>
          <div class="wh-hero__status">
            <span class="wh-hero__dot" />
            <div>
              <b>正在摸鱼</b>
              <span>已持续 3 小时 42 分</span>
            </div>
          </div>
        </div>
      </div>

      <div class="wh-hero__wave" aria-hidden="true">
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path d="M0 54C160 18 300 96 470 62C650 26 760 84 930 58C1100 32 1250 88 1440 40V110H0Z" fill="currentColor" opacity="0.55" />
          <path d="M0 76C180 42 310 104 500 76C680 50 800 98 980 74C1160 50 1290 96 1440 66V110H0Z" fill="currentColor" />
        </svg>
      </div>
    </section>

    <!-- ══════════════════════ TICKER ══════════════════════ -->
    <div class="wh-ticker" aria-hidden="true">
      <div class="wh-ticker__track">
        <span v-for="(phrase, index) in tickerItems" :key="index" class="wh-ticker__item">
          {{ phrase }}
          <i>✳</i>
        </span>
      </div>
    </div>

    <!-- ══════════════════════ 角色档案 ══════════════════════ -->
    <section class="wh-shell wh-profile">
      <div class="wh-profile__portrait">
        <img src="/whale/dafeiyu-full.webp" alt="大肥鱼 · 女仆形态全身立绘" width="600" height="1087" loading="lazy" />
        <span class="wh-profile__tag">女仆形态 · 全身立绘</span>
      </div>
      <div class="wh-profile__body">
        <span class="wh-eyebrow">CHARACTER FILE · 鱼设简报</span>
        <h2 class="wh-stats__title">吃饭积极，<br />干活随缘。</h2>
        <p class="wh-stats__note">本体：蓝鲸 · 职业：女仆（自称）· 主食：白米饭和 token</p>
        <div class="wh-stats__items">
          <div v-for="(stat, index) in WHALE_STATS" :key="stat.label" class="wh-stat" :style="{ '--i': index }">
            <span class="wh-stat__num">{{ stat.value }}<em>{{ stat.unit }}</em></span>
            <span class="wh-stat__label">{{ stat.label }}</span>
          </div>
        </div>
        <p class="wh-profile__credit">题图 / 立绘由用户提供 · 角色原型：上善无形「溟月」 · 女仆设计：ZipZipPipe · Q 版：这个刀子真甜</p>
      </div>
    </section>

    <!-- ══════════════════════ 表情包鱼塘 ══════════════════════ -->
    <section id="wh-wall" class="wh-shell wh-wall">
      <header class="wh-wall__head">
        <div>
          <span class="wh-eyebrow">THE TANK · 表情包鱼塘</span>
          <h2 class="wh-wall__title">挑一条，贴进聊天框。</h2>
          <p class="wh-wall__desc">按情绪捞鱼，或者直接随机抽一张。点开可以保存 GIF 动图，也可以只偷文案。</p>
        </div>
        <div class="wh-wall__count">
          <b>{{ String(filtered.length).padStart(2, '0') }}</b>
          <span>条在游</span>
        </div>
      </header>

      <div class="wh-toolbar">
        <div class="wh-chips" role="tablist" aria-label="按情绪筛选">
          <button
            v-for="mood in WHALE_MOODS"
            :key="mood.key"
            class="wh-chip"
            :class="{ 'is-active': activeMood === mood.key }"
            type="button"
            role="tab"
            :aria-selected="activeMood === mood.key"
            :title="mood.blurb"
            @click="activeMood = mood.key"
          >
            <span class="wh-chip__glyph">{{ mood.glyph }}</span>
            {{ mood.label }}
            <em>{{ String(countOf(mood.key)).padStart(2, '0') }}</em>
          </button>
        </div>

        <div class="wh-toolbar__right">
          <label class="wh-search">
            <AppIcon name="search" :size="15" />
            <input v-model="keyword" type="search" placeholder="搜梗 / 搜情绪 / 搜鱼" aria-label="搜索表情包" />
            <button v-if="keyword" type="button" aria-label="清空搜索" @click="keyword = ''">
              <AppIcon name="close" :size="13" />
            </button>
          </label>
          <button class="wh-random" type="button" @click="randomMeme">
            <AppIcon name="dice" :size="15" />
            随机
          </button>
          <button class="wh-random" type="button" @click="openUpload">
            <AppIcon name="upload" :size="15" />
            投喂一张
          </button>
        </div>
      </div>

      <div v-if="!apiMemes && !isError" class="wh-empty">
        <span class="wh-empty__glyph">≈</span>
        <p>鱼群正在游过来……</p>
      </div>

      <div v-else-if="filtered.length" class="wh-grid" :key="activeMood">
        <MemeSticker
          v-for="(meme, index) in filtered"
          :key="meme.id"
          :meme="meme"
          :index="index"
          @open="openMeme"
        />
      </div>

      <div v-else class="wh-empty">
        <span class="wh-empty__glyph">( *・ω・)ﾉ</span>
        <p v-if="isError">鱼塘接口打了个盹，先看看内置精选。或者清空筛选再捞一次。</p>
        <p v-else>这条鱼今天没上班，换个词再捞一次。</p>
        <button class="wh-btn wh-btn--blue" type="button" @click="clearFilters">清空筛选</button>
      </div>

      <p class="wh-wall__foot">
        <span>还有想看的梗？</span>
        <a href="https://github.com/diwer/ai-biaoqingbao" target="_blank" rel="noopener">
          去合集源头看看
          <AppIcon name="arrow-up-right" :size="12" />
        </a>
        <span class="wh-wall__sep">·</span>
        <button type="button" class="wh-wall__linkbtn" @click="openUpload">
          投喂一张，让它游进鱼塘
          <AppIcon name="arrow-up-right" :size="12" />
        </button>
        <span class="wh-wall__sep">·</span>
        <RouterLink to="/studio">去表情包工坊，自己画一条 <AppIcon name="arrow-up-right" :size="12" /></RouterLink>
      </p>
    </section>

    <!-- ══════════════════════ CTA ══════════════════════ -->
    <section class="wh-shell wh-cta">
      <div class="wh-cta__card">
        <span class="wh-cta__fish" aria-hidden="true">≈</span>
        <div class="wh-cta__copy">
          <span class="wh-eyebrow wh-eyebrow--light">MAKE YOUR OWN · 继续增肥</span>
          <h2>这条鱼，还能再长。</h2>
          <p>把大肥鱼贴到你自己的图上，加两行字，三秒就能做出一张新的表情包。或者，把相册里那张压箱底的 GIF 投喂进来。或者，先去看看那条蛙的故事。</p>
          <div class="wh-cta__actions">
            <RouterLink class="wh-btn wh-btn--sun" to="/studio">
              去表情包工坊
              <AppIcon name="arrow-right" :size="16" />
            </RouterLink>
            <button class="wh-btn wh-btn--ghost" type="button" @click="openUpload">
              <AppIcon name="upload" :size="16" />
              投喂一张
            </button>
            <RouterLink class="wh-btn wh-btn--ghost" to="/story">看看奶蛙史</RouterLink>
          </div>
        </div>
        <div class="wh-cta__badge" aria-hidden="true">
          <span>DEEP</span>
          <strong>摸鱼</strong>
          <span>CLUB</span>
        </div>
      </div>

      <p class="wh-disclaimer">
        「大肥鱼」是网友对 DeepSeek 蓝鲸 Logo 的昵称，最初来自一次「这是蓝色大肥鱼」的识图乌龙。
        鲸鱼娘原型为<strong>上善无形</strong>的原创 OC「溟月」；女仆鲸鱼娘由<strong>ZipZipPipe</strong>二次设计；Q 版形象由<strong>这个刀子真甜</strong>扩散。
        相关形象以 CC BY-NC-SA 4.0 开放二创。本鱼塘收录 <strong>ming</strong> 整理的
        <a href="https://github.com/diwer/ai-biaoqingbao" target="_blank" rel="noopener">「大肥鱼表情包 · 100 个中文 GIF」合集</a>
        全量条目，以及通过审核的用户投喂；该合集注明部分参考图权属仍在核实。本页仅作非商业同人展示，与 DeepSeek 官方无关；如权利人要求会立即下架。
      </p>
    </section>

    <!-- 深度尺 -->
    <aside class="wh-depth" aria-hidden="true">
      <span class="wh-depth__label">DEPTH</span>
      <div class="wh-depth__track">
        <span class="wh-depth__mark wh-depth__mark--1">0</span>
        <span class="wh-depth__mark wh-depth__mark--2">60</span>
        <span class="wh-depth__mark wh-depth__mark--3">120</span>
        <span class="wh-depth__fish" :style="{ top: `${(depth / 120) * 100}%` }">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M3 12c2.6-4 6.2-6 9.4-6 4 0 7 2.6 8.6 6-1.6 3.4-4.6 6-8.6 6C9.2 18 5.6 16 3 12Z" fill="#4D6BFE" stroke="#071B44" stroke-width="1.4" />
            <path d="M3 12 0.5 8.5v7L3 12Z" fill="#4D6BFE" stroke="#071B44" stroke-width="1.4" />
            <circle cx="16" cy="10.5" r="1.2" fill="#071B44" />
          </svg>
        </span>
      </div>
      <span class="wh-depth__value font-mono">-{{ depth }}m</span>
    </aside>

    <MemeViewer
      v-if="viewerIndex >= 0"
      :memes="viewerPool"
      :index="viewerIndex"
      @close="viewerIndex = -1"
      @update:index="viewerIndex = $event"
    />

    <MemeUploadModal v-model="uploadOpen" />
  </div>
</template>