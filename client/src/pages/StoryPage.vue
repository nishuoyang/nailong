<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import NaiwaFace from '@/components/story/NaiwaFace.vue'
import StoryFamily from '@/components/story/StoryFamily.vue'
import StoryLexicon from '@/components/story/StoryLexicon.vue'
import StoryMorph from '@/components/story/StoryMorph.vue'
import StoryRecipe from '@/components/story/StoryRecipe.vue'
import StorySectionHead from '@/components/story/StorySectionHead.vue'
import StoryTimeline from '@/components/story/StoryTimeline.vue'
import {
  chapters,
  heroStats,
  sourceKindLabel,
  sources,
  type SourceKind,
} from '@/data/naiwaStory'

/* ------------------------------------------------------------------
   阅读进度 & 章节高亮
------------------------------------------------------------------- */
const activeChapter = ref('s00')
const progress = ref(0)
let observer: IntersectionObserver | undefined

function onScroll() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  progress.value = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
}

/* ------------------------------------------------------------------
   图片灯箱
------------------------------------------------------------------- */
interface LightboxImage {
  src: string
  alt: string
  caption?: string
}
const lightbox = ref<LightboxImage | null>(null)

function openLightbox(image: LightboxImage) {
  lightbox.value = image
}

function closeLightbox() {
  lightbox.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeLightbox()
}

watch(lightbox, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
})

onMounted(() => {
  const sections = chapters
    .map((chapter) => document.getElementById(chapter.id))
    .filter((el): el is HTMLElement => el !== null)

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (!visible.length) return
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      activeChapter.value = visible[0]!.target.id
    },
    { rootMargin: '-18% 0px -72% 0px', threshold: 0 },
  )
  sections.forEach((section) => observer!.observe(section))

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
  onScroll()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

/* ------------------------------------------------------------------
   视频档案馆：一次只挂一个 iframe，省流量
------------------------------------------------------------------- */
const videoSources = sources.filter((source) => source.kind === 'video')
const activeVideo = ref('V1')
const activeVideoData = computed(
  () => videoSources.find((source) => source.id === activeVideo.value) ?? videoSources[0]!,
)
const activeBvid = computed(() => activeVideoData.value.url.match(/BV[0-9A-Za-z]+/)?.[0] ?? '')
const embedUrl = computed(
  () =>
    'https://player.bilibili.com/player.html?bvid=' +
    activeBvid.value +
    '&page=1&high_quality=1&danmaku=0&autoplay=0',
)

/* ------------------------------------------------------------------
   参考资料分组
------------------------------------------------------------------- */
const sourceGroups = computed(() => {
  const order: SourceKind[] = ['wiki', 'media', 'video', 'platform', 'community']
  return order
    .map((kind) => ({
      kind,
      label: sourceKindLabel[kind],
      items: sources.filter((source) => source.kind === kind),
    }))
    .filter((group) => group.items.length > 0)
})

const ticker = [
  '奶蛙不是奶龙',
  '先有事故，后有神',
  '奶蛙之母：纲手[百豪]',
  '2024.10.02 · 星野',
  '请勿打扰原作者',
  '旧龙已死，新蛙当立',
]
const marqueeItems = [...ticker, ...ticker]
</script>

<template>
  <div class="relative">
    <!-- ============================== HERO ============================== -->
    <section class="relative overflow-hidden border-b border-line">
      <div class="pointer-events-none absolute inset-0 dot-field opacity-[0.32]" />
      <div class="pointer-events-none absolute -right-40 -top-44 h-[560px] w-[560px] rounded-full bg-butter/25 blur-3xl" />
      <div class="pointer-events-none absolute -left-44 bottom-0 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
      <span class="pointer-events-none absolute -right-[6%] top-[6%] select-none font-display text-[46vw] leading-none text-ink/[0.035] sm:text-[34vw] lg:text-[26rem]" aria-hidden="true">蛙</span>

      <div class="n-container relative grid gap-10 pb-12 pt-10 sm:pt-14 lg:grid-cols-[1.16fr_0.84fr] lg:items-end lg:gap-12 lg:pb-16 lg:pt-16">
        <div class="animate-fade-up">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-butter px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#181510]">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Naiwa Archive · 非官方考据
            </span>
            <span class="n-tag !py-1.5">更新于 2026-10-31</span>
            <span class="n-tag !py-1.5">28 条时间线</span>
          </div>

          <h1 class="mt-5 display text-[66px] leading-[0.84] text-ink sm:text-[92px] lg:text-[106px]">
            奶蛙<span class="relative text-accent">史<span class="absolute -right-7 top-0 rotate-12 text-[18px] text-butter">✳</span></span>
          </h1>
          <p class="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="font-display text-[20px] text-ink-2">又名「奶娃史」</span>
            <span class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">A brief history of an AI accident</span>
          </p>

          <p class="mt-5 max-w-[38rem] text-[15px] leading-[1.9] text-ink-2">
            2024 年 10 月 2 日，一位网名<strong class="text-ink">「纲手[百豪]」</strong>的用户在 AI 社交 App「星野」里，
            给一只叫奶龙的黄色小龙建了个智能体。TA 给这个智能体配了一张背景图，用平台内置的模型生成。
            模型把龙画成了蛙。两年后，这只蛙被近百所高校的大学生搬来搬去，
            被做成表情包、名画、鬼畜视频和微信小游戏——
            <strong class="font-semibold text-ink">而它的作者，至今没有公开认领它。</strong>
          </p>

          <div class="mt-5 flex flex-wrap items-center gap-2.5">
            <a href="#s00" class="n-btn n-btn-primary n-btn-lg no-underline">
              30 秒速通 <AppIcon name="arrow-down" :size="16" />
            </a>
            <a href="#s05" class="n-btn n-btn-outline n-btn-lg no-underline">
              <AppIcon name="clock" :size="16" /> 看完整时间线
            </a>
            <a href="#refs" class="inline-flex items-center gap-1.5 px-2 text-[12px] font-semibold text-ink-2 no-underline transition hover:text-accent">
              直达参考资料 <AppIcon name="arrow-up-right" :size="13" />
            </a>
          </div>

          <div class="mt-4 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl border border-accent/30 bg-accent/[0.06] px-3.5 py-2 text-[11px] leading-relaxed">
            <span class="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">Origin · 起源父母</span>
            <span class="text-muted">母</span><strong class="text-ink">纲手[百豪]</strong>
            <span class="text-muted/50">×</span>
            <span class="text-muted">母本</span><strong class="text-ink">奶龙</strong>
            <span class="text-muted/50">×</span>
            <span class="text-muted">助产士</span><strong class="text-ink">星野 AI</strong>
            <span class="text-muted/60">— 没有父亲</span>
          </div>

          <div class="mt-5 flex flex-wrap gap-2 text-[11px]">
            <span class="rounded-full border border-line bg-surface px-3 py-1.5">起源 <b class="font-mono">2024-10-02</b></span>
            <span class="rounded-full border border-line bg-surface px-3 py-1.5">类型 <b>AI 亚种 / 无官方版权</b></span>
            <span class="rounded-full border border-line bg-surface px-3 py-1.5">核心动作 <b>捧腹大笑</b></span>
            <span class="rounded-full border border-line bg-surface px-3 py-1.5">状态 <b class="text-accent">仍在更新</b></span>
          </div>

          <dl class="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
            <div v-for="stat in heroStats" :key="stat.label">
              <dt class="font-display text-[22px] leading-none tabular text-ink">{{ stat.value }}</dt>
              <dd class="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">{{ stat.label }} · {{ stat.note }}</dd>
            </div>
          </dl>
        </div>

        <!-- 标本卡 -->
        <div class="relative mx-auto w-full max-w-[420px]">
          <div class="absolute inset-x-7 top-7 h-full rotate-[4deg] rounded-[30px] border border-ink/15 bg-jade/15" />
          <div class="absolute inset-x-4 top-3 h-full rotate-[-3deg] rounded-[30px] border border-ink/15 bg-accent/10" />

          <div class="tape relative rotate-[-1deg] rounded-[26px] border border-ink/25 bg-surface p-3 pb-4 shadow-[8px_10px_0_0_rgba(24,21,16,.12)]">
            <div class="flex items-center justify-between px-1 pb-2">
              <span class="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">Specimen No. 001</span>
              <span class="font-mono text-[8px] text-muted">2024.10.02</span>
            </div>
            <div class="rounded-[20px] border border-line/70 bg-butter/20 p-2">
              <NaiwaFace />
            </div>
            <p class="mt-2 px-1 text-[10px] leading-relaxed text-muted">
              它不是官方角色，没有版权方，也没有一句台词。
              <span class="text-ink-2">它唯一会做的事，是在你盯久了之后，突然笑起来。</span>
            </p>
          </div>

          <div class="absolute -left-5 top-28 rotate-[-8deg] rounded-md border-2 border-accent bg-paper px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-accent shadow-sm">
            来源已确认 · 2026.08
          </div>
        </div>
      </div>

      <!-- ticker -->
      <div class="overflow-hidden border-t border-ink bg-ink py-2 text-paper">
        <div class="flex w-max animate-marquee items-center gap-7 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em]">
          <span v-for="(item, index) in marqueeItems" :key="index" class="flex items-center gap-7">
            {{ item }} <span class="text-butter">✳</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ============================== CHAPTER NAV ============================== -->
    <nav class="sticky top-[76px] z-30 border-b border-line bg-paper/90 backdrop-blur-xl" aria-label="章节导航">
      <div class="n-container flex gap-1 overflow-x-auto py-2 no-scrollbar">
        <a
          v-for="chapter in chapters"
          :key="chapter.id"
          :href="'#' + chapter.id"
          class="shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.04em] no-underline transition"
          :class="activeChapter === chapter.id ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'"
        >
          <span class="mr-1 opacity-55">{{ chapter.no }}</span>{{ chapter.short }}
        </a>
      </div>
      <div class="h-0.5 bg-line/60" aria-hidden="true">
        <div class="h-full origin-left bg-accent" :style="{ transform: 'scaleX(' + progress + ')' }" />
      </div>
    </nav>

    <main>
      <!-- ============================== 00 速通 ============================== -->
      <section id="s00" class="n-container scroll-mt-36 py-12 sm:py-16">
        <StorySectionHead
          no="00"
          title="30 秒速通"
          kicker="Before the rabbit hole"
          lede="如果你只在群聊里见过这个黄色胖子，先记住三件事。剩下的，下面慢慢考古。"
        />

        <div class="grid gap-3 md:grid-cols-3">
          <article class="relative overflow-hidden rounded-[22px] border border-line bg-surface p-5">
            <span class="absolute -right-2 -top-4 font-display text-[86px] leading-none text-ink/[0.05]">01</span>
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-jade">The original</p>
            <h3 class="mt-2 font-display text-[26px] leading-none text-ink">奶龙是正主</h3>
            <p class="mt-3 text-[13px] leading-relaxed text-ink-2">
              2020 年 1 月 22 日在抖音出道，黄色圆头、绿色大眼、短手短脚的子供向幼龙。
              官方还在营业，也还在维护自己的形象。
            </p>
            <p class="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">来源 S1 / S2</p>
          </article>

          <article class="relative overflow-hidden rounded-[22px] border border-ink/25 bg-butter/20 p-5">
            <span class="absolute -right-2 -top-4 font-display text-[86px] leading-none text-ink/[0.06]">02</span>
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">The accident</p>
            <h3 class="mt-2 font-display text-[26px] leading-none text-ink">奶蛙是 AI 亚种</h3>
            <p class="mt-3 text-[13px] leading-relaxed text-ink-2">
              2024 年 10 月 2 日，星野用户「纲手[百豪]」给奶龙智能体生成背景图，模型把龙画成了蛙。
              没有官方设定，没有版权方。
            </p>
            <p class="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">来源 S3 / S4 / S5</p>
          </article>

          <article class="relative overflow-hidden rounded-[22px] border border-line bg-surface p-5">
            <span class="absolute -right-2 -top-4 font-display text-[86px] leading-none text-ink/[0.05]">03</span>
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-rose">The laugh</p>
            <h3 class="mt-2 font-display text-[26px] leading-none text-ink">它靠“笑”传播</h3>
            <p class="mt-3 text-[13px] leading-relaxed text-ink-2">
              黄色梨形身体 + 捧腹大笑 + 八级哥的卡痰笑声。任何严肃场景，只要结尾一起笑，就完成了降维。
            </p>
            <p class="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">来源 S5 / S6 / S12</p>
          </article>
        </div>

        <!-- 形变装置 -->
        <div class="mt-8">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p class="eyebrow mb-1">Interactive · 01</p>
              <h3 class="font-display text-[24px] leading-none text-ink">拖动，重演一次 AI 事故</h3>
            </div>
            <p class="max-w-xs text-[11px] leading-relaxed text-muted">左边是官方奶龙，右边是野生奶蛙。分界线由你控制。</p>
          </div>
          <StoryMorph />
        </div>

        <!-- 一眼分辨 -->
        <div class="mt-10">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <p class="eyebrow mb-1">Field guide</p>
              <h3 class="font-display text-[24px] leading-none text-ink">一眼分辨：龙还是蛙</h3>
            </div>
            <p class="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:block">Look at the eyes first</p>
          </div>

          <div class="overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table class="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr class="border-b border-line bg-paper-deep/50">
                  <th class="w-[18%] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">对比项</th>
                  <th class="w-[41%] px-4 py-3">
                    <span class="flex items-center gap-2">
                      <img src="/story/nailong-ip.jpg" alt="" class="h-7 w-7 rounded-full object-cover" />
                      <span class="font-display text-[18px] text-ink">奶龙</span>
                      <span class="font-mono text-[8px] text-jade">官方</span>
                    </span>
                  </th>
                  <th class="w-[41%] px-4 py-3">
                    <span class="flex items-center gap-2">
                      <img src="/story/naiwa.jpg" alt="" class="h-7 w-7 rounded-full object-cover" />
                      <span class="font-display text-[18px] text-ink">奶蛙</span>
                      <span class="font-mono text-[8px] text-accent">野生</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody class="text-[12px] leading-relaxed text-ink-2">
                <tr class="border-b border-line/70">
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">出身</td>
                  <td class="px-4 py-2.5">第七印象 2020 年原创 IP</td>
                  <td class="px-4 py-2.5">星野 AI 生成图，2024-10-02</td>
                </tr>
                <tr class="border-b border-line/70">
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">眼睛</td>
                  <td class="px-4 py-2.5">绿色大眼，黑瞳大而圆</td>
                  <td class="px-4 py-2.5">浅绿环状眼白，小黑瞳，外凸</td>
                </tr>
                <tr class="border-b border-line/70">
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">身体</td>
                  <td class="px-4 py-2.5">圆头胖身，短手短脚</td>
                  <td class="px-4 py-2.5">梨形，无颈，大肚皮，深色长手脚</td>
                </tr>
                <tr class="border-b border-line/70">
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">气质</td>
                  <td class="px-4 py-2.5">可爱、设定完整、面向低龄</td>
                  <td class="px-4 py-2.5">荒诞、失控、随时要笑</td>
                </tr>
                <tr class="border-b border-line/70">
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">版权</td>
                  <td class="px-4 py-2.5">有明确版权方</td>
                  <td class="px-4 py-2.5 text-accent">无官方版权，网友共有</td>
                </tr>
                <tr>
                  <td class="px-4 py-2.5 font-mono text-[9px] text-muted">一句话</td>
                  <td class="px-4 py-2.5">“我是奶龙”</td>
                  <td class="px-4 py-2.5">“先有事故，后有神”</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-muted">
            <span class="font-semibold text-ink-2">顺带一提：</span>
            奶蛙和真实存在的“牛奶蛙”（亚马逊牛奶蛙）没有关系。搜“饲养、价格、寿命”找的是它；搜“表情包、大笑、立牌”找的是奶蛙。
          </p>
        </div>
      </section>

      <!-- ============================== 01 前史 ============================== -->
      <section id="s01" class="border-y border-line bg-paper-deep/40">
        <div class="n-container scroll-mt-36 py-12 sm:py-16">
          <StorySectionHead
            no="01"
            title="前史：一只黄色幼龙"
            kicker="2020 — 2024 · The original"
            lede="要理解奶蛙，先理解它借用了谁的身体。奶龙不是一只普通的卡通龙，它是一个被算法、联名和小学生共同推上神坛的“黄色基础设施”。"
          />

          <div class="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div class="space-y-4 text-[14px] leading-[1.9] text-ink-2">
              <p>
                奶龙由<strong class="text-ink">第七印象文化传媒（深圳）有限公司</strong>运营，最早于
                <strong class="text-ink">2020 年 1 月 22 日</strong>在抖音发布作品。单集多在 1 分钟以内，
                是单元剧，定位 10 岁以下的子供向动画；为了适配短视频的节奏，里面塞满了网络流行梗。
              </p>
              <p>
                它先在小学生群体里爆火：孩子觉得好笑，可选内容又少，粘性极强。随后爆款按季度出现——
                2020 年 12 月的《好大一只变色龙！》获赞约 237 万，2021 年 1 月的《好大一条眼镜蛇！》获赞约 379.7 万。
                2021 年 10 月，第一套官方微信表情包上线，奶龙从视频走进了聊天框。
              </p>
              <p>
                2023 年和 2024 年，番剧第一、第二季相继推出，奶龙开始拥有“完整故事”。但互联网对它的使用方式，
                早就和官方设定分道扬镳：大家要的不是剧情，是一个可以无限复用的黄色表情。
              </p>
              <p>
                到 2025 年，奶龙已经是全网粉丝超 3600 万、短视频播放量破百亿的 IP；深圳前海竖起过 20 米高的气膜奶龙，
                贵阳云顶暮曙公园又立起 22 米的“全国最大奶龙”。<span class="text-muted">（S2）</span>
              </p>

              <div class="rounded-2xl border border-line bg-surface p-4">
                <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Why it got deconstructed</p>
                <h4 class="mt-1 font-display text-[22px] leading-tight text-ink">为什么一个子供向 IP 会被解构？</h4>
                <ol class="mt-3 space-y-2 text-[12px] leading-relaxed">
                  <li class="flex gap-2"><span class="font-mono text-accent">01</span><span><strong class="text-ink">它无处不在。</strong>联名、表情包、短视频、线下气膜，成年人躲不开。</span></li>
                  <li class="flex gap-2"><span class="font-mono text-accent">02</span><span><strong class="text-ink">它足够浅。</strong>很多视频连完整故事都没有，只是一个段子。</span></li>
                  <li class="flex gap-2"><span class="font-mono text-accent">03</span><span><strong class="text-ink">它接住了嘲讽。</strong>官方索性玩梗自嘲，“黑红也是红”。</span></li>
                </ol>
              </div>
            </div>

            <div class="space-y-4">
              <figure class="overflow-hidden rounded-[22px] border border-line bg-surface">
                <button type="button" class="group relative block w-full" @click="openLightbox({ src: '/story/nailong-anime.jpg', alt: '奶龙动画剧照', caption: '奶龙动画剧照（图源：澎湃新闻 · 骨朵网络影视，S2）' })">
                  <img src="/story/nailong-anime.jpg" alt="奶龙动画剧照：黄色幼龙与伙伴" class="w-full object-cover transition duration-700 group-hover:scale-[1.02]" loading="lazy" decoding="async" />
                  <span class="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-black/35 text-[12px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">⤢</span>
                </button>
                <figcaption class="px-3 py-2 text-[10px] leading-relaxed text-muted">奶龙动画剧照（图源：澎湃新闻 · 骨朵网络影视，S2）</figcaption>
              </figure>

              <figure class="overflow-hidden rounded-[22px] border border-line bg-surface">
                <button type="button" class="group relative block w-full" @click="openLightbox({ src: '/story/nailong-ip.jpg', alt: '奶龙 IP 形象', caption: '奶龙 IP 形象与经典动画联动（图源：澎湃新闻 · 骨朵网络影视，S2）' })">
                  <img src="/story/nailong-ip.jpg" alt="奶龙 IP 形象与经典动画联动" class="w-full object-cover transition duration-700 group-hover:scale-[1.02]" loading="lazy" decoding="async" />
                  <span class="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-black/35 text-[12px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">⤢</span>
                </button>
                <figcaption class="px-3 py-2 text-[10px] leading-relaxed text-muted">奶龙 IP 形象与经典动画联动（图源：澎湃新闻 · 骨朵网络影视，S2）</figcaption>
              </figure>

              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-2xl border border-line bg-surface p-3 text-center">
                  <p class="font-display text-[23px] leading-none tabular text-ink">3600 万+</p>
                  <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">全网粉丝</p>
                </div>
                <div class="rounded-2xl border border-line bg-surface p-3 text-center">
                  <p class="font-display text-[23px] leading-none tabular text-ink">百亿</p>
                  <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">短视频播放</p>
                </div>
                <div class="rounded-2xl border border-line bg-surface p-3 text-center">
                  <p class="font-display text-[23px] leading-none tabular text-ink">22m</p>
                  <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">最高气膜</p>
                </div>
              </div>
            </div>
          </div>

          <blockquote class="mt-8 max-w-3xl border-l-4 border-accent bg-surface p-5 text-[14px] leading-relaxed text-ink-2">
            “奶龙很多视频连个完整的故事都没有，只是一个段子。这样的内容让很多家长比较担心，也有很多年轻人很反感奶龙无所不在地入侵。”
            <span class="mt-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted">—— 澎湃新闻 · 骨朵网络影视，2025-04-30（S2）</span>
          </blockquote>

          <p class="mt-6 max-w-3xl text-[14px] leading-[1.9] text-ink-2">
            奶蛙不是奶龙的反面，它是奶龙的影子。当一只角色的脸可以被随意替换、身体可以被随意重绘，
            它就只剩下一组最顽固的视觉特征：<strong class="text-ink">黄、圆、大眼、无害。</strong>
            这组特征，正好够 AI 把它认错成一只蛙。
          </p>
        </div>
      </section>

      <!-- ============================== 02 起源 ============================== -->
      <section id="s02" class="n-container scroll-mt-36 py-12 sm:py-16">
        <StorySectionHead
          no="02"
          title="起源：一次 AI 事故"
          kicker="2024-10-02 · The mother"
          lede="现在，回答那个最关键的问题：奶蛙的“父母”是谁？答案不是季洪行，也不是奶龙官方，而是一位网名来自《火影忍者》的普通用户。"
        />

        <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <div class="space-y-4 text-[14px] leading-[1.9] text-ink-2">
            <p>
              2024 年 10 月 2 日，星野 App 用户
              <strong class="text-ink">「纲手[百豪]」</strong>
              创建了一个名为“奶龙”的 AI 智能体（ID：
              <code class="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[11px] text-ink">zNCvQDKfXy</code>）。
              TA 用平台内置的图像模型，为这个智能体生成了一张奶龙的背景图。
            </p>
            <p>
              模型没有画出一只龙。它把奶龙圆润的身体、绿色的大眼睛和奶油色的肚皮重新排列，
              生成了一只<strong class="text-ink">梨形、无颈、凸眼、四肢细长</strong>的黄色生物。
              因为它太像青蛙，网友给它取名“奶蛙”。
            </p>
            <p class="rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed">
              <strong class="text-ink">需要保留的余地：</strong>
              智能体已经无法访问，因此无法百分百确认这张图是星野直接生成，还是其他 AI 生成后上传。
              “星野智能体背景图”是目前证据最强的解释，但不是唯一可能的解释。
            </p>
            <p>
              目前能确认的是：TA 是星野用户，不是奶龙官方，也没有以作者身份公开出现过。TA 的网名看起来取自《火影忍者》里的纲手与“百豪之印”，
              这也是网友判断 TA 是火影爱好者的线索。据手谈姬报道，2025 年 TA 还在评论区为“自己的奶龙被更多人看到”而高兴；
              2026 年，当全网找到 TA 时，智能体已经无法搜索/分享、评论区关闭；维基编者提醒，TA 可能对该作品不感兴趣，请避免打扰。
            </p>
            <p>
              网友把 TA 叫作<strong class="text-ink">“奶蛙之母”</strong>，后来简称“蛙母”。这个称呼把一次生成事故写成了“生育”：
              创作者是母亲，奶龙是胞兄，奶蛙是被遗弃的孩子。它很适合做二创，但也把一位普通人推到了聚光灯下。
            </p>
          </div>

          <figure class="overflow-hidden rounded-[24px] border border-line bg-surface">
            <button type="button" class="group relative block w-full" @click="openLightbox({ src: '/story/naiwa.jpg', alt: '奶蛙经典形象', caption: '奶蛙经典形象：黄色梨形身体、浅绿环状眼白、奶油色肚皮。' })">
              <img src="/story/naiwa.jpg" alt="奶蛙经典形象：黄色梨形身体、绿色环状眼睛、奶油色肚皮" class="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.02]" loading="lazy" decoding="async" />
              <span class="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-black/35 text-[12px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">⤢</span>
            </button>
            <figcaption class="px-4 py-3 text-[10px] leading-relaxed text-muted">
              奶蛙的原图已难以直接获取；这是公开传播中最常见的版本。它的“正确打开方式”不是设计稿，而是一次误读。
            </figcaption>
          </figure>
        </div>

        <!-- 一句话版本 -->
        <div class="mt-8 overflow-hidden rounded-[22px] border border-ink/20 bg-butter/15">
          <div class="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-2">The one-paragraph version</p>
            <span class="rotate-[-3deg] rounded border border-accent/50 px-2 py-0.5 font-mono text-[8px] tracking-[0.1em] text-accent">没有父亲</span>
          </div>
          <div class="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <div>
              <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">母 / 生成者</p>
              <p class="mt-1 font-display text-[22px] leading-none text-ink">纲手[百豪]</p>
              <p class="mt-1 text-[11px] leading-relaxed text-ink-2">按下生成键的人。星野用户，不是官方。</p>
            </div>
            <div>
              <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">母本 / 胞兄</p>
              <p class="mt-1 font-display text-[22px] leading-none text-ink">奶龙</p>
              <p class="mt-1 text-[11px] leading-relaxed text-ink-2">被误读的原图。官方 IP，还在营业。</p>
            </div>
            <div>
              <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">助产士 / 误差</p>
              <p class="mt-1 font-display text-[22px] leading-none text-ink">星野 AI</p>
              <p class="mt-1 text-[11px] leading-relaxed text-ink-2">低精度模型。把“龙”读成“蛙”的那一下。</p>
            </div>
          </div>
          <p class="border-t border-ink/10 px-5 py-3 text-[11px] leading-relaxed text-ink-2">
            <strong class="text-ink">父：没有。</strong>
            季洪行是“大笑奶龙”的中之人，和奶蛙的生成链无关；2025-03-07 的 AI 融合造成了长期误认，2026-08 已被证伪。
          </p>
        </div>

        <!-- 血统证明 -->
        <div class="mt-8">
          <StoryFamily />
        </div>

        <!-- 三个误会 -->
        <div class="mt-10">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <p class="eyebrow mb-1">Fact check</p>
              <h3 class="font-display text-[24px] leading-none text-ink">三个最常见的误会</h3>
            </div>
            <span class="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:block">Read before arguing</span>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <div class="rounded-[20px] border border-rose/25 bg-rose/5 p-4">
              <p class="font-mono text-[9px] text-rose">误会 01</p>
              <p class="mt-1.5 text-[13px] font-semibold text-ink">“奶蛙是奶龙官方的新角色。”</p>
              <p class="mt-2 text-[11px] leading-relaxed text-muted">不是。奶龙官方从未发布过奶蛙；它是一个用户生成的 AI 图，后来被全网二创。</p>
            </div>
            <div class="rounded-[20px] border border-rose/25 bg-rose/5 p-4">
              <p class="font-mono text-[9px] text-rose">误会 02</p>
              <p class="mt-1.5 text-[13px] font-semibold text-ink">“奶蛙是季洪行变的。”</p>
              <p class="mt-2 text-[11px] leading-relaxed text-muted">不是。季洪行对应的是“大笑奶龙”。2025-03-07 的融合造成了误认，2026-08-04 已被星野智能体证据纠正。</p>
            </div>
            <div class="rounded-[20px] border border-rose/25 bg-rose/5 p-4">
              <p class="font-mono text-[9px] text-rose">误会 03</p>
              <p class="mt-1.5 text-[13px] font-semibold text-ink">“奶蛙是某个画师画的。”</p>
              <p class="mt-2 text-[11px] leading-relaxed text-muted">不是。它是低精度模型的生成结果。没有原画师，没有设计稿，也没有一张“官方设定图”。</p>
            </div>
          </div>
        </div>

        <!-- 命名 -->
        <div class="mt-8 rounded-[22px] border border-line bg-surface p-5 sm:p-6">
          <div class="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Naming</p>
              <h3 class="mt-1 font-display text-[30px] leading-none text-ink">为什么是“蛙”，不是“娃”</h3>
            </div>
            <div class="space-y-2 text-[12px] leading-relaxed text-ink-2">
              <p>
                因为它像青蛙，所以叫“奶蛙”。但输入法里“奶蛙”经常被联想成“奶娃”，于是两个写法一起流传。
                机核的作者甚至写道：“奶蛙却总是只能联想打字奶娃，这就是神的不可目视吗。”
              </p>
              <p>
                本页把<strong class="text-ink">“奶蛙”</strong>作为正式称呼，把<strong class="text-ink">“奶娃”</strong>作为别名；
                你看到“大奶蛙”“蛙母”“奶蛙之母”，说的都是同一件事。
              </p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2">奶蛙 <span class="font-mono text-[9px] text-muted">正式</span></span>
            <span class="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2">奶娃 <span class="font-mono text-[9px] text-muted">别名 / 输入法</span></span>
            <span class="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2">大奶蛙 <span class="font-mono text-[9px] text-muted">媒体用法</span></span>
            <span class="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2">蛙母 / 奶蛙之母 <span class="font-mono text-[9px] text-muted">指创作者</span></span>
          </div>
        </div>
      </section>

      <!-- ============================== 03 潜伏 ============================== -->
      <section id="s03" class="border-y border-line bg-paper-deep/40">
        <div class="n-container scroll-mt-36 py-12 sm:py-16">
          <StorySectionHead
            no="03"
            title="潜伏：角落里的两年"
            kicker="2024 — 2025 · The quiet years"
            lede="从 2024 年底到 2025 年底，奶蛙一直在，但不在 C 位。它更像一张被反复转存、却没人说得清出处的“野生图”。"
          />

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-[22px] border border-jade/30 bg-surface p-5">
              <div class="flex items-center justify-between">
                <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-jade">Track A · 奶蛙线</p>
                <span class="rounded-full bg-jade/10 px-2 py-0.5 font-mono text-[8px] text-jade">形</span>
              </div>
              <ol class="mt-4 space-y-3">
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-jade" />
                  <div><p class="font-mono text-[10px] text-jade">2024-10-02</p><p class="text-[12px] text-ink-2">星野智能体背景图生成，奶蛙诞生。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-jade" />
                  <div><p class="font-mono text-[10px] text-jade">2024-12</p><p class="text-[12px] text-ink-2">抖音出现带“星野”水印的奶蛙视频，小范围传播。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-jade" />
                  <div><p class="font-mono text-[10px] text-jade">2025-03-07</p><p class="text-[12px] text-ink-2">与季洪行视频 AI 融合，误认开始。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-jade" />
                  <div><p class="font-mono text-[10px] text-jade">2025 年内</p><p class="text-[12px] text-ink-2">纲手[百豪] 为形象被看见而高兴；奶蛙仍未出圈。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div><p class="font-mono text-[10px] text-accent">2026-08-04</p><p class="text-[12px] text-ink-2">星野智能体被找到，来源确认。</p></div>
                </li>
              </ol>
            </div>

            <div class="rounded-[22px] border border-rose/30 bg-surface p-5">
              <div class="flex items-center justify-between">
                <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-rose">Track B · 大笑奶龙线</p>
                <span class="rounded-full bg-rose/10 px-2 py-0.5 font-mono text-[8px] text-rose">声</span>
              </div>
              <ol class="mt-4 space-y-3">
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose" />
                  <div><p class="font-mono text-[10px] text-rose">2025 年内</p><p class="text-[12px] text-ink-2">季洪行的武打视频被 AI 换成奶龙，配上八级哥笑声。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose" />
                  <div><p class="font-mono text-[10px] text-rose">2026-01-15</p><p class="text-[12px] text-ink-2">官方回复“请勿恶搞”，反而坐实“这是奶龙”，热度膨胀。</p></div>
                </li>
                <li class="flex gap-3">
                  <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose" />
                  <div><p class="font-mono text-[10px] text-rose">2026-03-05</p><p class="text-[12px] text-ink-2">《奶龙大笑出处完整版》359 万播放，笑声成为公共素材。</p></div>
                </li>
              </ol>
              <p class="mt-4 rounded-xl border border-rose/20 bg-rose/5 p-3 text-[11px] leading-relaxed text-ink-2">
                <strong class="text-ink">不要混线：</strong>
                大笑奶龙是“人变龙”，奶蛙是“龙变蛙”。它们在 2026 年初互相借势，但不是同一个东西。
              </p>
            </div>
          </div>

          <div class="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div class="space-y-4 text-[14px] leading-[1.9] text-ink-2">
              <p>
                为什么奶蛙在 2024-2025 没有立刻爆？原因很具体：星野的智能体后来被下架整改，原图无法访问；
                传播到抖音的版本又被裁掉了水印、翻转了颜色，来源线索一次次断掉；再加上当时更出圈的是
                <strong class="text-ink">“我是奶龙”</strong>，奶蛙只在小圈子里被当作猎奇素材。
              </p>
              <p>
                但它一直在积累两样东西：<strong class="text-ink">一张足够简单的脸</strong>，和
                <strong class="text-ink">一个足够魔性的笑声</strong>。前者让它容易被复制，后者让它容易被记住。
                到 2026 年，这两样东西终于合流。
              </p>
              <p>
                还有一个反例必须保留：考据群曾发现一条 <strong class="text-ink">2024-08-23</strong> 的 B 站视频里出现过奶蛙，
                水印与星野不同、发布时间更早。主流解释是“后期换源”，但这个反例没有被完全排除。
                所以严格说，奶蛙的“第一张图”仍有 1% 的悬念。
              </p>
            </div>

            <aside class="relative rounded-[22px] border border-dashed border-line-strong bg-surface p-5">
              <span class="absolute -top-2.5 left-4 bg-surface px-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Evidence file</span>
              <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">2024-08-23 · unresolved</p>
              <h4 class="mt-1 font-display text-[24px] leading-tight text-ink">那个更早的视频，是怎么回事？</h4>
              <p class="mt-2 text-[12px] leading-relaxed text-ink-2">
                视频里出现了奶蛙，但 AI 水印不是星野，发布时间也更早。主流理论认为它是后期换源：
                先发了一条普通视频，后来把画面替换成了奶蛙。因为没有原始文件，这个解释无法被百分百证实。
              </p>
              <dl class="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[10px]">
                <div><dt class="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">状态</dt><dd class="mt-0.5 text-ink-2">仍有争议</dd></div>
                <div><dt class="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">主流解释</dt><dd class="mt-0.5 text-ink-2">后期换源</dd></div>
              </dl>
              <a href="#src-S4" class="mt-3 inline-flex items-center gap-1 font-mono text-[9px] text-accent no-underline hover:underline">S4 · 失传媒体中文维基 <AppIcon name="arrow-up-right" :size="10" /></a>
            </aside>
          </div>
        </div>
      </section>

      <!-- ============================== 04 爆发 ============================== -->
      <section id="s04" class="n-container scroll-mt-36 py-12 sm:py-16">
        <StorySectionHead
          no="04"
          title="爆发：笑声接管互联网"
          kicker="2026 · The ritual"
          lede="2026 年，奶蛙不再是一个形象，而是一种句式：先铺垫，再荒诞，最后所有人一起捧腹大笑。"
        />

        <div class="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div class="space-y-4 text-[14px] leading-[1.9] text-ink-2">
            <p>
              奶蛙二创有一个几乎固定的三段式：<strong class="text-ink">铺垫 → 摩擦前额叶 → 全员捧腹</strong>。
              不管前面是名画、历史、游戏、职场还是家庭伦理，结尾都会收束到同一个动作：
              黄色梨形身体弯下腰，双手捧腹，嘴巴张到最大，笑声响起。
            </p>
            <p>
              声音通常来自《无畏契约》博主<strong class="text-ink">八级哥</strong>：他用“老水牛变声器”处理过的笑声，
              被人单独截出来，成了新一代“私人笑声”。另一个常见素材是<strong class="text-ink">变调的不知火舞语音</strong>。
              两者一前一后，构成“先荒诞、后爆笑”的听觉钩子。
            </p>
            <p>
              AI 工具把生产成本压到接近零：一张图、一段语音、一个模板，就能批量生产。
              于是奶蛙开始“入侵”人类文明史——它可以在《创造亚当》里与上帝碰手指，
              可以在《梅杜萨之筏》上等待海难，也可以化身“拿破蛙”翻越阿尔卑斯山。
            </p>
            <p>
              机核的作者用一句话总结这场“文艺复兴”：
              <strong class="text-ink">“旧龙已死，而新蛙当立。”</strong>
              这句话是二创的修辞，不是事实判断；但它准确描述了 2026 年中文互联网的权力交接感。
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 self-start">
            <figure class="overflow-hidden rounded-[20px] border border-line bg-surface">
              <button type="button" class="group relative block w-full" @click="openLightbox({ src: '/story/naiwa-laugh-hd.jpg', alt: '奶蛙捧腹大笑', caption: '奶蛙捧腹大笑：二创视频最常见的收尾动作。' })">
                <img src="/story/naiwa-laugh-hd.jpg" alt="奶蛙捧腹大笑" class="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
                <span class="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-white/30 bg-black/35 text-[10px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">⤢</span>
              </button>
              <figcaption class="px-3 py-2 text-[10px] leading-relaxed text-muted">捧腹大笑：所有二创共享的“收束动作”。</figcaption>
            </figure>
            <figure class="overflow-hidden rounded-[20px] border border-line bg-surface">
              <button type="button" class="group relative block w-full" @click="openLightbox({ src: '/story/naiwa-hospital.jpg', alt: '奶蛙住院 meme', caption: '奶蛙住院 meme：病房、护士、汗珠，把一只抽象蛙拍成了病历照。' })">
                <img src="/story/naiwa-hospital.jpg" alt="奶蛙躺在病床上、护士在旁的住院梗图" class="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
                <span class="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-white/30 bg-black/35 text-[10px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">⤢</span>
              </button>
              <figcaption class="px-3 py-2 text-[10px] leading-relaxed text-muted">住院梗：把奶蛙当成病人，是另一种“医学化”。</figcaption>
            </figure>
            <div class="col-span-2 rounded-[20px] border border-line bg-surface-2 p-4">
              <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">B 站数据 · 2026-10-31 核验</p>
              <div class="mt-2 grid grid-cols-3 gap-3">
                <div><p class="font-display text-[24px] leading-none tabular text-ink">359 万</p><p class="mt-1 text-[9px] text-muted">《奶龙大笑出处完整版》</p></div>
                <div><p class="font-display text-[24px] leading-none tabular text-ink">138 万</p><p class="mt-1 text-[9px] text-muted">《植龙大战僵奶》</p></div>
                <div><p class="font-display text-[24px] leading-none tabular text-ink">31.9 万</p><p class="mt-1 text-[9px] text-muted">《最后的奶龙……》</p></div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8">
          <StoryRecipe />
        </div>

        <div class="mt-10">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <p class="eyebrow mb-1">The expanded universe</p>
              <h3 class="font-display text-[24px] leading-none text-ink">奶蛙宇宙：它后来长出了什么</h3>
            </div>
            <span class="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:block">Three branches</span>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <article class="group overflow-hidden rounded-[22px] border border-line bg-surface">
              <div class="relative aspect-[16/10] overflow-hidden">
                <img src="/story/naiwa.jpg" alt="奶蛙名画二创的基底形象" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                <span class="absolute left-2 top-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[8px] tracking-[0.1em] text-white/80 backdrop-blur">二创基底</span>
              </div>
              <div class="p-4">
                <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-sky">Branch 01</p>
                <h4 class="mt-1 font-display text-[21px] leading-tight text-ink">名画与历史</h4>
                <p class="mt-1.5 text-[11px] leading-relaxed text-muted">《创造亚当》《梅杜萨之筏》《拿破蛙》，以及“被缚的奶蛙”。用 AI 把蛙嵌进艺术史，反差最大。</p>
              </div>
            </article>
            <article class="group overflow-hidden rounded-[22px] border border-line bg-surface">
              <div class="aspect-[16/10] overflow-hidden">
                <img src="/story/naiwa-hospital.jpg" alt="奶蛙住院梗图" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
              </div>
              <div class="p-4">
                <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-jade">Branch 02</p>
                <h4 class="mt-1 font-display text-[21px] leading-tight text-ink">表情包与鬼畜</h4>
                <p class="mt-1.5 text-[11px] leading-relaxed text-muted">从“捧腹大笑”到“斜视”“吃面”“你胆子肥嘟嘟”，奶蛙的脸被切成无数个可复用表情。</p>
              </div>
            </article>
            <article class="group overflow-hidden rounded-[22px] border border-line bg-surface">
              <div class="aspect-[16/10] overflow-hidden">
                <img src="/story/niulai.jpg" alt="牛来：黄色三幻神之一" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
              </div>
              <div class="p-4">
                <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-rose">Branch 03</p>
                <h4 class="mt-1 font-display text-[21px] leading-tight text-ink">黄色三幻神</h4>
                <p class="mt-1.5 text-[11px] leading-relaxed text-muted">奶蛙、牛来、美团袋鼠被并列成“三幻神”。它们不是同一作品，却共享同一套黄色抽象语法。</p>
              </div>
            </article>
          </div>
        </div>

        <blockquote class="mt-8 border-l-4 border-accent bg-surface p-5 text-[15px] leading-relaxed text-ink-2">
          “奶蛙们神情坚毅，活跃于各个历史舞台，但永远不会变的是视频末尾的卡痰音大笑和动感的 BABY DON’T CRY。”
          <span class="mt-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted">—— 机核用户投稿，2026-07-13（S12，文首标注含 AI 生成内容）</span>
        </blockquote>
      </section>

      <!-- ============================== 05 时间线 ============================== -->
      <section id="s05" class="border-y border-line bg-paper-deep/40">
        <div class="n-container scroll-mt-36 py-12 sm:py-16">
          <StorySectionHead
            no="05"
            title="完整时间线"
            kicker="2020 — 2026 · 28 entries"
            lede="从奶龙的第一条抖音，到奶蛙立牌进校园。可以按年筛选，也可以让页面自己放映一遍。"
          />
          <StoryTimeline />
        </div>
      </section>

      <!-- ============================== 06 线下 ============================== -->
      <section id="s06" class="n-container scroll-mt-36 py-12 sm:py-16">
        <StorySectionHead
          no="06"
          title="线下：流动奶蛙"
          kicker="2026 秋 · Campus"
          lede="2026 年秋天，奶蛙从手机里爬了出来。它没有腿，却出现在近百所高校的阳台、操场和绿化带里。"
        />

        <div class="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-10">
          <!-- 立牌 -->
          <div class="relative mx-auto w-full max-w-[340px] rotate-[-2deg]">
            <div class="rounded-[18px] border-2 border-ink bg-surface p-2.5 shadow-[8px_10px_0_0_rgba(24,21,16,.14)]">
              <img src="/story/naiwa-laugh-hd.jpg" alt="奶蛙立牌示意：捧腹大笑的奶蛙" class="aspect-[3/4] w-full rounded-[10px] object-cover" loading="lazy" />
              <div class="flex items-center justify-between px-1 pt-2">
                <p class="font-display text-[18px] leading-none text-ink">请把我搬到别处</p>
                <span class="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Flow #042</span>
              </div>
            </div>
            <div class="absolute -left-5 top-16 rotate-[-7deg] rounded-sm border border-ink/20 bg-butter px-2 py-1 font-mono text-[8px] tracking-[0.08em] text-[#181510] shadow-sm">
              流动奶龙 · 2026
            </div>
            <div class="absolute -right-4 bottom-16 rotate-[6deg] rounded-sm border border-ink/20 bg-surface px-2 py-1 font-mono text-[8px] tracking-[0.08em] text-ink-2 shadow-sm">
              请勿放消防通道
            </div>
            <p class="mt-3 text-center font-mono text-[8px] uppercase tracking-[0.14em] text-muted">立牌为示意拼贴，不是某所学校的实拍</p>
          </div>

          <div class="space-y-4 text-[14px] leading-[1.9] text-ink-2">
            <p>
              目前流传最广的起点说法，是<strong class="text-ink">中国矿业大学</strong>。据学生帖文，两个社团在招新时摆出了奶蛙立牌。
              有人在立牌背面手写了一行字，把它称作“流动奶龙”，并鼓励发现者把它搬到校园里的其他地方。
              这行字被下一个人看到，于是立牌开始移动。
            </p>
            <p>
              手写通知后来升级成打印版，又加上了安全提示：“请勿放置于教学区域、宿舍楼内部、消防通道等影响正常秩序或安全的位置。”
              规则越写越正式，参与的人却越来越多。据不完全统计，奶蛙立牌已经出现在国内<strong class="text-ink">近百所高校</strong>，
              并扩散到中国港台乃至北美校园。
            </p>
            <p>
              它出现的位置高度随机：宿舍阳台、军训操场、绿化带、图书馆外。有人给它戴迷彩帽，有人给它披透明雨衣，
              有人把它摆在保安亭旁边。每一次“目击”都会被拍照、发帖、再引来下一次搬运。
              线上梗变成线下接力，线下照片又反哺线上流量。
            </p>
            <p>
              3DM 把它和四川农业大学的“搬牛”传统作比较：川农学生搬雕塑牛搬了近 20 年，学校甚至复制了五头放到成都校区；
              而奶蛙立牌是<strong class="text-ink">全网共享的梗</strong>，不局限于一所学校，传播速度更快，也更依赖平台。
            </p>

            <div class="grid gap-2 sm:grid-cols-3">
              <div class="rounded-xl border border-line bg-surface p-3">
                <p class="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">起点</p>
                <p class="mt-1 text-[12px] font-semibold text-ink">中国矿业大学</p>
                <p class="mt-0.5 text-[10px] text-muted">社团招新</p>
              </div>
              <div class="rounded-xl border border-line bg-surface p-3">
                <p class="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">规模</p>
                <p class="mt-1 text-[12px] font-semibold text-ink">近 100 所高校</p>
                <p class="mt-0.5 text-[10px] text-muted">据不完全统计</p>
              </div>
              <div class="rounded-xl border border-line bg-surface p-3">
                <p class="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">机制</p>
                <p class="mt-1 text-[12px] font-semibold text-ink">背面留言</p>
                <p class="mt-0.5 text-[10px] text-muted">搬运 → 拍照 → 发帖</p>
              </div>
            </div>

            <div class="rounded-xl border border-butter/50 bg-butter/15 p-4 text-[12px] leading-relaxed">
              <strong class="text-ink">但别忽略风险：</strong>
              立牌大多是学生自制的，奶蛙本身没有版权方，不代表可以随意使用他人的照片、校徽或场地；
              摆放在消防通道、教学区也可能被学校清理。玩梗可以，别给别人添麻烦。
            </div>
          </div>
        </div>

        <blockquote class="mt-8 max-w-3xl border-l-4 border-jade bg-surface p-5 text-[14px] leading-relaxed text-ink-2">
          “正因为奶蛙没有官方设定，没有版权归属，所以它不属于任何人，也因此属于所有人。”
          <span class="mt-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted">—— 游民星空，2026-10-11（S8）</span>
        </blockquote>
      </section>

      <!-- ============================== 07 造物主 ============================== -->
      <section id="s07" class="border-y border-line bg-ink text-paper">
        <div class="n-container scroll-mt-36 py-12 sm:py-16">
          <div class="mb-7">
            <p class="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/50">07 · The creator · 反色档案</p>
            <h2 class="mt-2 font-display text-[34px] leading-[0.95] text-paper sm:text-[46px]">造物主：赛博两相隔</h2>
            <p class="mt-4 max-w-2xl text-[14px] leading-[1.85] text-paper/70">
              这是整个故事里最不好笑的部分。一个被上亿次观看的形象，和一个不能被看见的人。
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-[22px] border border-paper/15 bg-paper/[0.06] p-5">
              <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/50">The creation</p>
              <p class="mt-1 font-display text-[64px] leading-none tabular text-accent sm:text-[80px]">1 亿+</p>
              <p class="mt-2 text-[12px] leading-relaxed text-paper/70">据手谈姬报道，奶蛙相关内容的播放量已经过亿。它有自己的周边、手机壳、微信小游戏和校园立牌。</p>
            </div>
            <div class="rounded-[22px] border border-paper/15 bg-paper/[0.06] p-5">
              <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/50">The signature</p>
              <p class="mt-1 font-display text-[64px] leading-none tabular text-accent sm:text-[80px]">0</p>
              <p class="mt-2 text-[12px] leading-relaxed text-paper/70">没有署名，没有授权，没有公开认领。原作者没有公开现身，相关智能体已经无法访问。</p>
            </div>
          </div>

          <div class="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div class="space-y-4 text-[14px] leading-[1.9] text-paper/75">
              <p>
                奶蛙火了之后，网友开始找它的作者。2026 年 8 月，星野智能体被找到，源头指向「纲手[百豪]」。
                但这次“破案”没有带来团圆结局：奶龙官方对评论区里的奶蛙图片采取拉黑、删评，后来一度关闭评论区；版权与法律风险被反复讨论；
                原作者没有公开现身，智能体也已无法访问。
              </p>
              <p>
                手谈姬把这件事写成“2026 互联网最悲怆的赛博两相隔”：
                <strong class="text-paper">“奶蛙的形象全网传播，播放过亿，甚至还有自己的周边和专属手机壳。
                但他的创作者，却终生不得与自己的造物相认。”</strong>
              </p>
              <p>
                需要说明：“终生不得”是修辞，不是法律事实；我们也不知道双方是否真的有过法律接触。
                可确认的只有三件事：智能体已经不可访问；原作者没有公开现身；奶龙官方从未公开承认奶蛙。
              </p>
              <p>
                社区把这件事继续写成了梗：“生母弃我，胞兄厌我，世人笑我，似龙非龙，似蛙非蛙。”
                这段话很动人，也很残忍——它把一位真实的人，变成了一个神话里的“弃母”。
              </p>
            </div>

            <div class="rounded-[22px] border border-paper/15 bg-paper/[0.06] p-5">
              <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/50">What we know / don't</p>
              <dl class="mt-3 space-y-3 text-[12px] leading-relaxed">
                <div class="border-b border-paper/10 pb-3">
                  <dt class="flex items-center gap-2 font-semibold text-paper"><span class="text-jade">✓</span> 已知</dt>
                  <dd class="mt-1 text-paper/65">2024-10-02 创建智能体；ID zNCvQDKfXy；来源经失传媒体维基确认；维基提醒避免打扰作者。</dd>
                </div>
                <div class="border-b border-paper/10 pb-3">
                  <dt class="flex items-center gap-2 font-semibold text-paper"><span class="text-butter">?</span> 未知</dt>
                  <dd class="mt-1 text-paper/65">作者的真实身份、年龄、职业；是否收到过律师函；智能体不可访问的具体原因。</dd>
                </div>
                <div>
                  <dt class="flex items-center gap-2 font-semibold text-paper"><span class="text-rose">✕</span> 不要做</dt>
                  <dd class="mt-1 text-paper/65">人肉、围堵、冒充“认亲”、在评论区刷“你妈来了”。这些都不是考古。</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="mt-8 rounded-[22px] border border-accent/40 bg-accent/10 p-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-accent">Ethics note</p>
            <p class="mt-1 text-[13px] leading-relaxed text-paper/80">
              失传媒体中文维基在词条顶部专门写了一句话：“据悉纲手【百豪】本人可能对该作品不感兴趣，请尽量避免打扰其本人。”
              本页赞同这句话。<strong class="text-paper">考据的终点不是找到一个人，而是理解一件事。</strong>
            </p>
          </div>
        </div>
      </section>

      <!-- ============================== 08 争议 ============================== -->
      <section id="s08" class="n-container scroll-mt-36 py-12 sm:py-16">
        <StorySectionHead
          no="08"
          title="争议：版权与反噬"
          kicker="Who owns it?"
          lede="一个没有版权的东西，为什么能活这么久？它又在反噬谁？这一章不站队，只把争论摆出来。"
        />

        <div class="grid gap-3 md:grid-cols-2">
          <article class="rounded-[22px] border border-line bg-surface p-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-sky">Debate 01</p>
            <h3 class="mt-1 font-display text-[24px] leading-tight text-ink">官方为什么不直接告？</h3>
            <p class="mt-2 text-[12px] leading-relaxed text-ink-2">
              一方认为：奶蛙明显源自奶龙，官方完全有理由维权。另一方认为：奶蛙是 AI 生成、二创层层转存、责任主体极其分散，
              起诉成本和舆论风险都太高。3DM 的分析是“法不责众”+“AI 内容难以定性”。
              截至目前，奶龙官方没有发布过针对奶蛙的公开声明。
            </p>
            <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-[8px] text-muted">
              <a href="#src-S6" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S6</a>
              <a href="#src-S5" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S5</a>
            </div>
          </article>

          <article class="rounded-[22px] border border-line bg-surface p-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-rose">Debate 02</p>
            <h3 class="mt-1 font-display text-[24px] leading-tight text-ink">AI 数据污染：奶龙会不会被奶蛙“吃掉”？</h3>
            <p class="mt-2 text-[12px] leading-relaxed text-ink-2">
              有网友转述：奶龙公司曾考虑用 AI 做视频，但因为生成结果里奶蛙出现得太多而放弃。
              这个说法没有官方证实，本页标为<strong class="text-ink">未证实</strong>。
              但它指向一个真实的问题：当二创的图片量超过原图，模型会先学会“蛙”，再学会“龙”。
            </p>
            <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-[8px] text-muted">
              <a href="#src-S11" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S11 · 网友转述</a>
              <a href="#src-S14" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S14 · 未证实</a>
            </div>
          </article>

          <article class="rounded-[22px] border border-line bg-surface p-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-jade">Debate 03</p>
            <h3 class="mt-1 font-display text-[24px] leading-tight text-ink">审丑，还是创作？</h3>
            <p class="mt-2 text-[12px] leading-relaxed text-ink-2">
              反对者说它丑、猎奇、低成本、污染信息流；支持者说名画二创有真正的构图与幽默，
              “点一下就会笑”是一种极简的交互设计。两种说法都成立——奶蛙的创作光谱很宽，
              从一键生成的垃圾到认真重绘的油画，都叫奶蛙。
            </p>
            <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-[8px] text-muted">
              <a href="#src-S8" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S8</a>
              <a href="#src-S12" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S12</a>
            </div>
          </article>

          <article class="rounded-[22px] border border-rose/30 bg-rose/5 p-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-rose">Debate 04</p>
            <h3 class="mt-1 font-display text-[24px] leading-tight text-ink">“找到作者”是不是一种暴力？</h3>
            <p class="mt-2 text-[12px] leading-relaxed text-ink-2">
              考据让真相浮出水面，但“认亲”也可能变成围观的借口。原作者已经隐身，
              继续寻找、推测身份、在评论区刷“奶蛙之母”，都不是在保护创作，而是在消费一个人。
              这一条没有“另一方”：本页明确反对骚扰。
            </p>
            <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-[8px] text-muted">
              <a href="#src-S4" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S4 · 词条警告</a>
              <a href="#src-S5" class="rounded-full border border-line px-2 py-0.5 no-underline transition hover:border-accent hover:text-accent">S5</a>
            </div>
          </article>
        </div>

        <div class="mt-8 overflow-hidden rounded-[22px] border border-line bg-surface">
          <div class="border-b border-line px-5 py-3">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Claim status</p>
            <h3 class="mt-1 font-display text-[22px] leading-none text-ink">哪些说法能信？</h3>
          </div>
          <div class="divide-y divide-line/70">
            <div class="flex items-start gap-3 px-5 py-3">
              <span class="mt-0.5 rounded-full border border-jade/30 bg-jade/10 px-2 py-0.5 font-mono text-[8px] text-jade">真</span>
              <p class="text-[12px] leading-relaxed text-ink-2">奶蛙来自星野用户「纲手[百豪]」2024-10-02 创建的奶龙智能体背景图。</p>
            </div>
            <div class="flex items-start gap-3 px-5 py-3">
              <span class="mt-0.5 rounded-full border border-jade/30 bg-jade/10 px-2 py-0.5 font-mono text-[8px] text-jade">真</span>
              <p class="text-[12px] leading-relaxed text-ink-2">奶蛙不是官方角色，没有官方版权；核心动作是捧腹大笑。</p>
            </div>
            <div class="flex items-start gap-3 px-5 py-3">
              <span class="mt-0.5 rounded-full border border-rose/30 bg-rose/10 px-2 py-0.5 font-mono text-[8px] text-rose">假</span>
              <p class="text-[12px] leading-relaxed text-ink-2">“奶蛙是季洪行变的。”——季洪行对应“大笑奶龙”，与奶蛙生成链无关。</p>
            </div>
            <div class="flex items-start gap-3 px-5 py-3">
              <span class="mt-0.5 rounded-full border border-butter/50 bg-butter/15 px-2 py-0.5 font-mono text-[8px] text-ink-2">存疑</span>
              <p class="text-[12px] leading-relaxed text-ink-2">“2024-08-23 的 B 站视频才是最早源头。”——主流解释为后期换源，未完全排除。</p>
            </div>
            <div class="flex items-start gap-3 px-5 py-3">
              <span class="mt-0.5 rounded-full border border-butter/50 bg-butter/15 px-2 py-0.5 font-mono text-[8px] text-ink-2">未证实</span>
              <p class="text-[12px] leading-relaxed text-ink-2">“作者因律师函删号”“奶蛙导致奶龙无法用 AI 续作”——均为网友转述，没有官方或当事人确认。</p>
            </div>
          </div>
        </div>

        <p class="mt-4 text-[11px] leading-relaxed text-muted">
          说明：本页不对任何一方作法律判断。奶龙、奶蛙相关形象与商标的权利归原权利人所有；本页仅作文化考据与介绍。
          严格说，“没有版权”是网友口语，指没有官方版权方与授权体系，不等于任何人都可以不受限制地商用。
        </p>
      </section>

      <!-- ============================== 09 档案馆 ============================== -->
      <section id="s09" class="border-t border-line bg-paper-deep/40">
        <div class="n-container scroll-mt-36 py-12 sm:py-16">
          <StorySectionHead
            no="09"
            title="档案馆"
            kicker="Videos · Lexicon · Sources"
            lede="原始视频可能被下架或换源。如果播放器无法加载，请点“在 B 站打开”。所有 B 站数据于 2026-10-31 通过公开 API 核验。"
          />

          <!-- 视频 -->
          <div class="overflow-hidden rounded-[26px] border border-line bg-surface">
            <div class="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div class="relative aspect-video overflow-hidden bg-black">
                <div class="pointer-events-none absolute inset-0">
                  <img src="/story/naiwa-laugh-hd.jpg" alt="" class="h-full w-full object-cover opacity-45" loading="lazy" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <p class="absolute bottom-3 left-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/60">
                    Bilibili player · 若无法加载请点右侧「在 B 站打开」
                  </p>
                </div>
                <iframe
                  v-if="activeBvid"
                  :src="embedUrl"
                  class="relative z-10 h-full w-full"
                  scrolling="no"
                  frameborder="no"
                  allowfullscreen="true"
                  loading="lazy"
                  :title="activeVideoData.title"
                />
              </div>

              <div class="flex min-w-0 flex-col p-5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full border border-jade/30 bg-jade/10 px-2 py-0.5 font-mono text-[8px] text-jade">{{ activeVideoData.id }}</span>
                  <span class="font-mono text-[9px] text-muted">{{ activeVideoData.date }}</span>
                </div>
                <h3 class="mt-2 font-display text-[24px] leading-tight text-ink">{{ activeVideoData.title }}</h3>
                <p class="mt-1 text-[11px] text-muted">{{ activeVideoData.publisher }}</p>
                <p class="mt-3 flex-1 text-[12px] leading-relaxed text-ink-2">{{ activeVideoData.note }}</p>
                <p class="mt-2 font-mono text-[9px] text-muted">{{ activeVideoData.reliability }}</p>
                <a :href="activeVideoData.url" target="_blank" rel="noopener" class="n-btn n-btn-primary n-btn-sm mt-4 self-start no-underline">
                  在 B 站打开 <AppIcon name="external" :size="13" />
                </a>
              </div>
            </div>

            <div class="border-t border-line">
              <button
                v-for="video in videoSources"
                :key="video.id"
                type="button"
                class="flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition last:border-b-0"
                :class="activeVideo === video.id ? 'bg-butter/15' : 'hover:bg-surface-2'"
                :aria-pressed="activeVideo === video.id"
                @click="activeVideo = video.id"
              >
                <span class="w-6 shrink-0 font-mono text-[9px] text-muted">{{ video.id }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[12px] font-medium text-ink">{{ video.title }}</span>
                  <span class="mt-0.5 block truncate font-mono text-[9px] text-muted">{{ video.publisher }} · {{ video.date }}</span>
                </span>
                <span class="hidden shrink-0 font-mono text-[8px] text-muted sm:block">{{ video.reliability }}</span>
                <span class="font-mono text-[11px] text-accent">{{ activeVideo === video.id ? '播放中' : '▶' }}</span>
              </button>
            </div>
          </div>

          <!-- 词典 -->
          <div class="mt-10">
            <div class="mb-3 flex items-end justify-between gap-3">
              <div>
                <p class="eyebrow mb-1">Lexicon</p>
                <h3 class="font-display text-[24px] leading-none text-ink">奶蛙词典</h3>
              </div>
              <span class="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:block">Search the lore</span>
            </div>
            <StoryLexicon />
          </div>

          <!-- 参考资料 -->
          <div id="refs" class="mt-12 scroll-mt-36">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="eyebrow mb-1">References</p>
                <h3 class="font-display text-[24px] leading-none text-ink">参考资料</h3>
              </div>
              <p class="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{{ sources.length }} 条 · 按类型分组</p>
            </div>

            <div class="space-y-6">
              <section v-for="group in sourceGroups" :key="group.kind">
                <h4 class="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  <span class="h-1.5 w-1.5 bg-accent" />{{ group.label }}
                  <span class="text-muted/60">({{ group.items.length }})</span>
                </h4>
                <ol class="space-y-2">
                  <li
                    v-for="source in group.items"
                    :id="'src-' + source.id"
                    :key="source.id"
                    class="scroll-mt-40 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-line hover:bg-surface"
                  >
                    <div class="flex items-start gap-3">
                      <span class="mt-0.5 w-8 shrink-0 font-mono text-[10px] text-accent">{{ source.id }}</span>
                      <div class="min-w-0">
                        <a :href="source.url" target="_blank" rel="noopener" class="text-[12px] font-medium text-ink no-underline hover:text-accent hover:underline">
                          {{ source.title }}
                        </a>
                        <p class="mt-0.5 text-[10px] text-muted">{{ source.publisher }} · {{ source.date }}</p>
                        <p class="mt-1 text-[10px] leading-relaxed text-ink-2">{{ source.reliability }}</p>
                        <p v-if="source.note" class="mt-0.5 text-[10px] leading-relaxed text-muted">{{ source.note }}</p>
                      </div>
                    </div>
                  </li>
                </ol>
              </section>
            </div>

            <div class="mt-6 rounded-[20px] border border-line bg-surface p-5">
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Methodology</p>
              <h4 class="mt-1 font-display text-[20px] leading-tight text-ink">本页怎么判断真假</h4>
              <div class="mt-3 grid gap-3 text-[11px] leading-relaxed text-ink-2 sm:grid-cols-2">
                <p><strong class="text-ink">已确证：</strong>有直接物证或多个独立来源交叉印证。例如 2024-10-02 的智能体 ID、B 站播放量。</p>
                <p><strong class="text-ink">媒体报道：</strong>来自可信媒体或当事人的公开叙述，但仍是单一线索。例如“播放过亿”“蛙母退圈”。</p>
                <p><strong class="text-ink">仍有争议：</strong>存在反例或互相矛盾的说法。例如 2024-08-23 的视频是否换源。</p>
                <p><strong class="text-ink">已辟谣：</strong>流传很广，但现有证据不支持。例如“奶蛙是季洪行变的”。</p>
              </div>
              <p class="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-muted">
                页面中的图片来自公开报道、B 站视频封面与公开传播版本，版权归原作者所有，仅作介绍与考据。
                若涉及侵权，请联系站长删除。B 站播放量会随时间变化，本页只记录核验时的数值。
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ============================== 尾声 ============================== -->
    <footer class="border-t border-line bg-paper">
      <div class="n-container py-12 sm:py-16">
        <div class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p class="eyebrow mb-3">Afterword</p>
            <h2 class="display max-w-xl text-[34px] leading-[1.02] text-ink sm:text-[46px]">
              它会不会过气？<br />
              大概会。<span class="text-accent">但它已经留下了语法。</span>
            </h2>
            <p class="mt-4 max-w-xl text-[14px] leading-[1.9] text-ink-2">
              奶蛙会像所有梗一样退潮。但“黄色 + 捧腹 + 无主”的配方已经写进了中文互联网的素材库：
              下一只野生生物出现时，大家会更快地认出它、复制它、然后忘掉它。
              这也是为什么，值得在它还热的时候，把来路记清楚。
            </p>
          </div>
          <div class="flex flex-wrap gap-2 lg:justify-end">
            <RouterLink to="/" class="n-btn n-btn-primary no-underline">🖼️ 去图片主页</RouterLink>
            <RouterLink to="/studio" class="n-btn n-btn-outline no-underline">🎭 做张表情包</RouterLink>
            <a href="#s05" class="n-btn n-btn-ghost no-underline">回到时间线 ↑</a>
          </div>
        </div>

        <div class="mt-10 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Naiwa Archive · 非官方 · 非商用 · 2026</span>
          <span>Written with sources, not with vibes.</span>
        </div>
      </div>
    </footer>

    <!-- ============================== 灯箱 ============================== -->
    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="lightbox"
          class="fixed inset-0 z-[120] flex items-center justify-center bg-[#14110d]/85 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          :aria-label="lightbox.alt"
          @click.self="closeLightbox"
        >
          <button
            type="button"
            class="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-paper/25 bg-paper/10 text-paper transition hover:bg-paper/20"
            aria-label="关闭大图"
            @click="closeLightbox"
          >
            ✕
          </button>
          <figure class="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-surface p-2 shadow-2xl">
            <img :src="lightbox.src" :alt="lightbox.alt" class="max-h-[76vh] w-full rounded-xl object-contain" />
            <figcaption class="px-2 py-2 text-[11px] leading-relaxed text-muted">{{ lightbox.caption || lightbox.alt }}</figcaption>
          </figure>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.22s ease;
}
.lightbox-enter-active figure,
.lightbox-leave-active figure {
  transition: transform 0.26s var(--ease-out-expo);
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
.lightbox-enter-from figure,
.lightbox-leave-to figure {
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .lightbox-enter-active,
  .lightbox-leave-active,
  .lightbox-enter-active figure,
  .lightbox-leave-active figure {
    transition: none;
  }
}
</style>
