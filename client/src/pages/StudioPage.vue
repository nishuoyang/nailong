<script setup lang="ts">
/**
 * 表情包工坊 · /studio
 *
 * 定位：把站内图库变成「能直接做梗图」的素材库。
 * 关键取舍：
 *  - 全部渲染在浏览器 canvas 完成，**不上传、不入库、不占服务端**（生产机只有 2vCPU/1.6GB）。
 *  - 底图优先用站内的 800px 缩略图，秒开且省流量；需要更清晰时可切「原图」。
 *  - 预览与导出共用同一套布局函数（utils/memeCanvas.ts），所见即所得。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getFeatured, getImageById, getImages, type ImageItem } from '@/api/images'
import {
  ASPECTS,
  FILTER_PRESETS,
  FONT_KEYS,
  FONT_STACKS,
  TEMPLATES,
  activeRoles,
  applyTemplate,
  clamp,
  computeCanvasSize,
  createDefaultSpec,
  drawMeme,
  hitTest,
  layoutMeme,
  renderToCanvas,
  uid,
  type HitTarget,
  type MemeAspect,
  type MemeLayout,
  type MemeSpec,
  type MemeTemplate,
  type TextRole,
} from '@/utils/memeCanvas'
import {
  HINTS,
  MEME_RECIPES,
  MOODS,
  STICKER_GROUPS,
  randomCopy,
  randomSticker,
  type MemeMood,
  type MemeRecipe,
} from '@/data/memeCopy'

// ────────────────────────────── 状态 ──────────────────────────────

const route = useRoute()

const spec = ref<MemeSpec>(createDefaultSpec())
const baseImg = shallowRef<HTMLImageElement | null>(null)
const baseMeta = ref<{ label: string; w: number; h: number; origin: 'site' | 'local' | 'none' }>({
  label: '还没有选底图',
  w: 0,
  h: 0,
  origin: 'none',
})
const selected = ref<HitTarget>(null)
const useOriginal = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const stageSize = ref({ w: 640, h: 720 })
const layoutRef = shallowRef<MemeLayout | null>(null)

const toast = ref('')
let toastTimer: number | undefined
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2200)
}

const hint = ref(HINTS[0])
function rollHint() {
  hint.value = HINTS[Math.floor(Math.random() * HINTS.length)]
}

// ────────────────────────────── 画布尺寸与渲染 ──────────────────────────────

const fit = computed(() => {
  const { W, H } = computeCanvasSize(spec.value.aspect, baseImg.value)
  const ratio = H / W
  let w = Math.max(160, stageSize.value.w)
  let h = w * ratio
  const maxH = Math.max(200, stageSize.value.h)
  if (h > maxH) {
    h = maxH
    w = h / ratio
  }
  return { W, H, w: Math.round(w), h: Math.round(h) }
})

let rafId = 0
function scheduleRender() {
  if (rafId) return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    render()
  })
}

function render() {
  const cvs = canvasRef.value
  if (!cvs) return
  const { W, H, w, h } = fit.value
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const scale = (w * dpr) / W
  const bw = Math.round(W * scale)
  const bh = Math.round(H * scale)
  if (cvs.width !== bw || cvs.height !== bh) {
    cvs.width = bw
    cvs.height = bh
  }
  if (cvs.style.width !== `${w}px`) cvs.style.width = `${w}px`
  if (cvs.style.height !== `${h}px`) cvs.style.height = `${h}px`
  const ctx = cvs.getContext('2d')
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const layout = layoutMeme(ctx, spec.value, W, H)
  layoutRef.value = layout
  drawMeme(ctx, layout, spec.value, baseImg.value, { selection: selected.value })
}

watch(spec, scheduleRender, { deep: true })
watch([fit, selected], scheduleRender)

// 草稿自动保存：改动停下 900ms 后落盘一次，避免拖动过程中疯狂写 localStorage
watch(
  spec,
  () => {
    if (draftTimer) window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(saveDraft, 900)
  },
  { deep: true },
)
watch(baseMeta, () => {
  if (draftTimer) window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(saveDraft, 900)
})

// ────────────────────────────── 尺寸自适应 ──────────────────────────────

let ro: ResizeObserver | null = null

onMounted(async () => {
  const el = stageRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      stageSize.value = { w: r.width - 24, h: r.height - 24 }
    })
    ro.observe(el)
  }
  loadWorks()
  await loadGallery()
  // 从详情页「做成表情包」进来：?image=<id> 直接把那张图铺成底图，
  // 比让用户在图库里再找一遍顺手得多。
  const fromDetail = typeof route.query.image === 'string' ? route.query.image : ''
  if (fromDetail) {
    try {
      const r = await getImageById(fromDetail)
      const item = r.data.data
      if (item) {
        lastPicked.value = item
        loadBase(picFrom(item), item.title || '站内图片', 'site')
        showToast('底图已就位，改两行字就能发')
      }
    } catch {
      showToast('那张图没能加载，先从图库挑一张吧')
    }
  } else {
    // 没有深链时，先把上次没做完的草稿接回来（刷新不丢）
    const draftState = loadDraft()
    if (draftState !== 'none') showToast('已接回上次没做完的草稿 —— 想清空点「重来」')
    // 首屏别给一块空画布：图库一到位就自动铺一张最新图，进来就是一个「已成图」的状态
    if (draftState !== 'base' && !baseImg.value && gallery.value.length) {
      const first = gallery.value[0]
      lastPicked.value = first
      loadBase(picFrom(first), first.title || '站内图片', 'site')
    }
  }
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  scheduleRender()
  void drawWall()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  if (rafId) window.cancelAnimationFrame(rafId)
  if (toastTimer) window.clearTimeout(toastTimer)
})

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing =
    !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)

  if (e.key === 'Escape') {
    selected.value = null
    return
  }
  if (typing) return

  const mod = e.ctrlKey || e.metaKey

  if (mod && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    void download()
    return
  }
  if (mod && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    randomize()
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
    e.preventDefault()
    if (selected.value.kind === 'sticker') removeSticker(selected.value.id)
    return
  }
  // 1~7 直接切版式（顺序与右侧版式列表一致）
  if (/^[1-9]$/.test(e.key)) {
    const tpl = TEMPLATES[Number(e.key) - 1]
    if (tpl) {
      e.preventDefault()
      selectTemplate(tpl.key)
    }
    return
  }
  // 方向键微调选中项，按住 Shift 走大步
  if (e.key.startsWith('Arrow') && selected.value) {
    e.preventDefault()
    nudge(e.key, e.shiftKey ? 0.03 : 0.006)
  }
}

/** 方向键微调：选中文字块或贴纸时按 0.6%（Shift 3%）步长挪动 */
function nudge(key: string, step: number) {
  const sel = selected.value
  if (!sel) return
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0
  if (sel.kind === 'text') {
    const t = spec.value.texts.find((x) => x.id === sel.id)
    if (!t) return
    const layout = layoutRef.value?.texts.find((x) => x.block.id === sel.id)
    t.x = clamp((t.x ?? (layout ? layout.cx / fit.value.W : 0.5)) + dx, 0, 1)
    t.y = clamp((t.y ?? (layout ? layout.cy / fit.value.H : 0.5)) + dy, 0, 1)
  } else {
    const s = spec.value.stickers.find((x) => x.id === sel.id)
    if (!s) return
    s.x = clamp(s.x + dx, 0, 1)
    s.y = clamp(s.y + dy, 0, 1)
  }
}

// ────────────────────────────── 底图 ──────────────────────────────

function loadBase(src: string, label: string, origin: 'site' | 'local') {
  const el = new Image()
  el.decoding = 'async'
  el.onload = () => {
    baseImg.value = el
    baseMeta.value = { label, w: el.naturalWidth, h: el.naturalHeight, origin }
    selected.value = null
    scheduleRender()
  }
  el.onerror = () => showToast('这张图加载失败了，换一张试试')
  el.src = src
}

function picFrom(item: ImageItem): string {
  if (useOriginal.value) return item.url
  return item.thumbnailUrl || item.thumbnailSmUrl || item.url
}

/** 记住最后一次点选的站内图，切换「用原图」时可以原地重载 */
const lastPicked = ref<ImageItem | null>(null)

function pickFromGallery(item: ImageItem) {
  lastPicked.value = item
  loadBase(picFrom(item), item.title || '站内图片', 'site')
  pickerOpen.value = false
  showToast('已设为底图，拖文字试试')
}

watch(useOriginal, () => {
  if (baseMeta.value.origin === 'site' && lastPicked.value) {
    loadBase(picFrom(lastPicked.value), lastPicked.value.title || '站内图片', 'site')
  }
})

const fileInput = ref<HTMLInputElement | null>(null)

// ────────────────────────────── 一键出片（配方） ──────────────────────────────

/**
 * 配方 = 版式 + 比例 + 滤镜 + 文案 + 贴纸位置，一次全给你。
 * 对没耐心排版的人（大多数人）来说，这一排按钮才是这个工具的入口。
 */
function specFromRecipe(current: MemeSpec, r: MemeRecipe): MemeSpec {
  const base = applyTemplate(current, r.template)
  return {
    ...base,
    aspect: r.aspect,
    filter: { preset: r.filter, brightness: 1, contrast: 1, saturate: 1 },
    texts: base.texts.map((t) => ({ ...t, content: r.texts[t.role] ?? '' })),
    stickers: (r.stickers ?? []).map((s) => ({
      id: uid('s'),
      emoji: s.emoji,
      x: s.x,
      y: s.y,
      size: s.size,
      rotation: 0,
    })),
  }
}

function applyRecipe(r: MemeRecipe) {
  spec.value = specFromRecipe(spec.value, r)
  selected.value = null
  rollHint()
  showToast(`配方已套用：${r.name} —— 直接下载，或者接着改`)
}

// ────────────────────────────── 灵感墙（实时渲染的成品预览） ──────────────────────────────



// ────────────────────────────── 草稿自动保存 ──────────────────────────────

/**
 * 刷新不丢正在做的图。
 * 底图分两种存法：站内图存 URL（重新加载像素完全一致），本地图片才存缩略版 data URL
 * （原文件在浏览器里拿不到第二次）。
 */
const DRAFT_KEY = 'nailong.studio.draft.v1'
let draftTimer: number | undefined

interface StudioDraft {
  spec: MemeSpec
  baseUrl?: string
  baseData?: string
  label?: string
  origin?: 'site' | 'local'
  savedAt: number
}

function saveDraft() {
  try {
    const draft: StudioDraft = {
      spec: JSON.parse(JSON.stringify(spec.value)) as MemeSpec,
      savedAt: Date.now(),
    }
    const last = lastPicked.value
    if (baseMeta.value.origin === 'site' && last) {
      draft.baseUrl = picFrom(last)
      draft.label = baseMeta.value.label
      draft.origin = 'site'
    } else if (baseImg.value) {
      draft.baseData = downscale(baseImg.value, 1000)
      draft.label = baseMeta.value.label
      draft.origin = 'local'
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* 空间不够就放弃草稿，绝不能影响正在做的事 */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

/** 返回值告诉调用方恢复到了什么程度（决定要不要再自动铺一张图库最新图） */
function loadDraft(): 'none' | 'spec' | 'base' {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return 'none'
    const d = JSON.parse(raw) as StudioDraft
    if (!d?.spec || !Array.isArray(d.spec.texts)) return 'none'
    spec.value = d.spec
    if (d.baseUrl) {
      loadBase(d.baseUrl, d.label || '草稿底图', 'site')
      return 'base'
    }
    if (d.baseData) {
      loadBase(d.baseData, d.label || '草稿底图', 'local')
      return 'base'
    }
    return 'spec'
  } catch {
    return 'none'
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showToast('只能选图片文件')
    return
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('图片太大了（上限 12MB）')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      loadBase(reader.result, file.name, 'local')
      pickerOpen.value = false
      showToast('本地图片已就位（不会上传到服务器）')
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// ────────────────────────────── 站内图库 ──────────────────────────────

const gallery = ref<ImageItem[]>([])
const gallerySort = ref<'latest' | 'popular' | 'featured'>('latest')
const galleryLoading = ref(false)
const pickerOpen = ref(false)

async function loadGallery() {
  galleryLoading.value = true
  try {
    if (gallerySort.value === 'featured') {
      const r = await getFeatured({ page: 1, size: 24 })
      gallery.value = r.data.data ?? []
    } else {
      const sort = gallerySort.value === 'popular' ? 'popular' : 'latest'
      const r = await getImages({ page: 1, size: 24, sort })
      gallery.value = r.data.data ?? []
    }
  } catch {
    gallery.value = []
    showToast('图库没拉到，检查一下网络')
  } finally {
    galleryLoading.value = false
  }
}

watch(gallerySort, loadGallery)

function thumbOf(item: ImageItem): string {
  return item.thumbnailSmUrl || item.thumbnailUrl || item.url
}

function randomFromGallery() {
  if (!gallery.value.length) {
    showToast('图库还在加载，稍等一下')
    return
  }
  const item = gallery.value[Math.floor(Math.random() * gallery.value.length)]
  pickFromGallery(item)
}

// ────────────────────────────── 模板 / 文案 ──────────────────────────────

const roleLabels = computed<Record<TextRole, string>>(() => {
  switch (spec.value.template) {
    case 'classic':
      return { top: '上句', bottom: '下句', free: '主文案' }
    case 'caption':
      return { top: '上句', bottom: '字幕', free: '主文案' }
    case 'tag':
      return { top: '标签', bottom: '大字', free: '主文案' }
    case 'poster':
      return { top: '上句', bottom: '小字', free: '大字' }
    case 'quote':
      return { top: '上句', bottom: '署名', free: '正文' }
    case 'polaroid':
      return { top: '上句', bottom: '落款', free: '主文案' }
    case 'chat':
      return { top: '对方说', bottom: '我说', free: '主文案' }
    default:
      return { top: '上句', bottom: '下句', free: '主文案' }
  }
})

const roles = computed(() => activeRoles(spec.value.template))

/** 供模板渲染的「角色 + 文案块」行；在这里就把空值滤掉，模板里不必写非空断言 */
const copyRows = computed(() => {
  const labels = roleLabels.value
  return roles.value.flatMap((role) => {
    const block = spec.value.texts.find((t) => t.role === role)
    return block ? [{ role, label: labels[role], block }] : []
  })
})

function selectTemplate(key: MemeTemplate) {
  const keepContent: Partial<Record<TextRole, string>> = {}
  for (const t of spec.value.texts) keepContent[t.role] = t.content
  let next: MemeSpec = { ...spec.value, texts: spec.value.texts.map((t) => ({ ...t })) }
  next = applyTemplate(next, key)
  // 模板切换保留用户已经写好的字，只换版式
  next.texts = next.texts.map((t) => ({
    ...t,
    content:
      key === 'poster' && t.role === 'free'
        ? keepContent.free ?? keepContent.top ?? t.content
        : keepContent[t.role] ?? t.content,
  }))
  spec.value = next
  selected.value = null
  showToast(`已切换版式：${TEMPLATES.find((t) => t.key === key)?.name}`)
}

const mood = ref<MemeMood | 'all'>('all')

function fillCopy(role: TextRole) {
  const copy = randomCopy(mood.value === 'all' ? undefined : mood.value)
  const blocks = spec.value.texts
  const hasTop = blocks.some((t) => t.role === 'top')
  const hasBottom = blocks.some((t) => t.role === 'bottom')
  if (role === 'free') {
    const free = blocks.find((t) => t.role === 'free')
    if (free) free.content = copy.bottom
  } else if (hasTop && hasBottom) {
    // 上下句成套给，避免「上句 A、下句 B」这种接不上的尴尬
    for (const t of blocks) {
      if (t.role === 'top') t.content = copy.top
      if (t.role === 'bottom') t.content = copy.bottom
    }
  } else {
    const b = blocks.find((t) => t.role === role)
    if (b) b.content = role === 'top' ? copy.top : copy.bottom
  }
  rollHint()
}

function shuffleAllCopy() {
  const copy = randomCopy(mood.value === 'all' ? undefined : mood.value)
  for (const t of spec.value.texts) {
    if (t.role === 'top') t.content = copy.top
    if (t.role === 'bottom') t.content = copy.bottom
    if (t.role === 'free') t.content = copy.bottom
  }
  rollHint()
}

// ────────────────────────────── 贴纸 ──────────────────────────────

function addSticker(emoji: string) {
  const item = {
    id: uid('s'),
    emoji,
    x: 0.5 + (Math.random() * 0.24 - 0.12),
    y: 0.5 + (Math.random() * 0.24 - 0.12),
    size: 160,
    rotation: Math.random() * 16 - 8,
  }
  spec.value.stickers.push(item)
  selected.value = { kind: 'sticker', id: item.id }
}

function removeSticker(id: string) {
  spec.value.stickers = spec.value.stickers.filter((s) => s.id !== id)
  if (selected.value?.kind === 'sticker' && selected.value.id === id) selected.value = null
}

// ────────────────────────────── 拖拽 ──────────────────────────────

interface DragState {
  kind: 'text' | 'sticker'
  id: string
  offsetX: number
  offsetY: number
}
let drag: DragState | null = null

function toLogical(e: PointerEvent): { px: number; py: number } | null {
  const cvs = canvasRef.value
  if (!cvs) return null
  const rect = cvs.getBoundingClientRect()
  const { W, H } = fit.value
  return {
    px: ((e.clientX - rect.left) / rect.width) * W,
    py: ((e.clientY - rect.top) / rect.height) * H,
  }
}

function onPointerDown(e: PointerEvent) {
  const layout = layoutRef.value
  const pt = toLogical(e)
  if (!layout || !pt) return
  const hit = hitTest(layout, pt.px, pt.py)
  selected.value = hit
  if (!hit) return
  if (hit.kind === 'text') {
    const t = layout.texts.find((x) => x.block.id === hit.id)
    if (!t) return
    drag = { kind: 'text', id: hit.id, offsetX: pt.px - t.cx, offsetY: pt.py - t.cy }
  } else {
    const s = layout.stickers.find((x) => x.item.id === hit.id)
    if (!s) return
    drag = { kind: 'sticker', id: hit.id, offsetX: pt.px - s.cx, offsetY: pt.py - s.cy }
  }
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const pt = toLogical(e)
  if (!pt) return
  const { W, H } = fit.value
  const cx = pt.px - drag.offsetX
  const cy = pt.py - drag.offsetY
  if (drag.kind === 'text') {
    const block = spec.value.texts.find((t) => t.id === drag?.id)
    if (!block) return
    block.x = clamp(cx / W, 0, 1)
    block.y = clamp(cy / H, 0, 1)
  } else {
    const item = spec.value.stickers.find((s) => s.id === drag?.id)
    if (!item) return
    item.x = clamp(cx / W, 0, 1)
    item.y = clamp(cy / H, 0, 1)
  }
}

function onPointerUp(e: PointerEvent) {
  if (drag) {
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    drag = null
  }
}

// ────────────────────────────── 选中对象编辑 ──────────────────────────────

const selectedText = computed(() => {
  const sel = selected.value
  if (!sel || sel.kind !== 'text') return null
  return spec.value.texts.find((t) => t.id === sel.id) ?? null
})

const selectedSticker = computed(() => {
  const sel = selected.value
  if (!sel || sel.kind !== 'sticker') return null
  return spec.value.stickers.find((s) => s.id === sel.id) ?? null
})

/** 用数组包一层：模板里 v-for 出来的元素类型非空，v-model 直接绑它，不需要非空断言 */
const focusedTexts = computed(() => {
  const t = selectedText.value
  return t ? [t] : []
})

const focusedStickers = computed(() => {
  const s = selectedSticker.value
  return s ? [s] : []
})

function resetPosition() {
  const t = selectedText.value
  if (!t) return
  t.x = null
  t.y = null
  showToast('已回到版式默认位置')
}

const SWATCHES = ['#ffffff', '#facc15', '#0f172a', '#ef4444', '#22d3ee', '#f472b6', '#22c55e', '#a78bfa']
/** 描边色：默认第一项就是经典黑边，顺序不要动 */
const STROKE_COLORS = ['#000000', '#ffffff', '#facc15', '#2563eb']

// ────────────────────────────── 一键灵感 ──────────────────────────────

function randomize() {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)].key
  const copy = randomCopy(mood.value === 'all' ? undefined : mood.value)
  let next: MemeSpec = { ...spec.value, texts: spec.value.texts.map((t) => ({ ...t })) }
  next = applyTemplate(next, template)
  next.texts = next.texts.map((t) => ({
    ...t,
    content: t.role === 'top' ? copy.top : copy.bottom,
  }))
  const moods: MemeAspect[] = ['auto', '1:1', '4:5']
  next.aspect = moods[Math.floor(Math.random() * moods.length)]
  next.filter = {
    preset: FILTER_PRESETS[Math.floor(Math.random() * FILTER_PRESETS.length)].key,
    brightness: 1,
    contrast: 1,
    saturate: 1,
  }
  next.stickers = Math.random() > 0.45
    ? [{
        id: uid('s'),
        emoji: randomSticker(),
        x: 0.78 + Math.random() * 0.08,
        y: 0.22 + Math.random() * 0.1,
        size: 170,
        rotation: Math.random() * 14 - 7,
      }]
    : []
  spec.value = next
  selected.value = null
  rollHint()
  if (gallery.value.length) randomFromGallery()
  showToast('来，随机一发')
}

// ────────────────────────────── 导出 ──────────────────────────────

const exportScale = ref(2)
const busy = ref(false)

function downscale(img: HTMLImageElement, maxW: number, type = 'image/jpeg', q = 0.82): string {
  const ratio = img.naturalHeight / img.naturalWidth
  const w = Math.min(maxW, img.naturalWidth || maxW)
  const h = Math.round(w * ratio)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return c.toDataURL(type, q)
}

function buildBlob(): Promise<Blob | null> {
  const { W, H } = fit.value
  const canvas = renderToCanvas(spec.value, baseImg.value, W, H, exportScale.value)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

function fileName(ext = 'png') {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `nailong-meme-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`
}

async function download() {
  if (busy.value) return
  busy.value = true
  try {
    const blob = await buildBlob()
    if (!blob) {
      showToast('导出失败了，换个浏览器试试')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName()
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    saveWork()
    showToast(`已导出 PNG（${exportScale.value}x）`)
  } finally {
    busy.value = false
  }
}

async function copyToClipboard() {
  if (busy.value) return
  busy.value = true
  try {
    const blob = await buildBlob()
    if (!blob) return
    const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
    if (navigator.clipboard && ClipboardItemCtor) {
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
      showToast('已复制到剪贴板，直接粘贴就能发')
    } else {
      showToast('这个浏览器不支持复制图片，用下载吧')
    }
  } catch {
    showToast('复制被浏览器拦下了，用下载吧')
  } finally {
    busy.value = false
  }
}

async function share() {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    const blob = await buildBlob()
    if (!blob) return
    const file = new File([blob], fileName(), { type: 'image/png' })
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: '奶龙表情包', text: '我做的表情包，拿去用' })
      saveWork()
    } else {
      showToast('这台设备不支持系统分享，先下载吧')
    }
  } catch {
    /* 用户取消分享，静默 */
  }
}

// ────────────────────────────── 我的作品（本地留存） ──────────────────────────────

interface StudioWork {
  id: string
  thumb: string
  base: string | null
  spec: MemeSpec
  createdAt: number
}

const WORKS_KEY = 'nailong.studio.works.v1'
const works = ref<StudioWork[]>([])
const MAX_WORKS = 9

function loadWorks() {
  try {
    const raw = localStorage.getItem(WORKS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as StudioWork[]
    if (Array.isArray(parsed)) works.value = parsed.slice(0, MAX_WORKS)
  } catch {
    works.value = []
  }
}

function persistWorks() {
  try {
    localStorage.setItem(WORKS_KEY, JSON.stringify(works.value))
  } catch {
    // 空间不够就丢掉最旧的，再试一次
    works.value = works.value.slice(0, 3)
    try {
      localStorage.setItem(WORKS_KEY, JSON.stringify(works.value))
    } catch {
      /* 放弃持久化，不影响当下使用 */
    }
  }
}

function saveWork() {
  const { W, H } = fit.value
  const thumbCanvas = renderToCanvas(spec.value, baseImg.value, W, H, 340 / W)
  const thumb = thumbCanvas.toDataURL('image/jpeg', 0.72)
  const base = baseImg.value ? downscale(baseImg.value, 900) : null
  const work: StudioWork = {
    id: uid('w'),
    thumb,
    base,
    spec: JSON.parse(JSON.stringify(spec.value)) as MemeSpec,
    createdAt: Date.now(),
  }
  works.value = [work, ...works.value].slice(0, MAX_WORKS)
  persistWorks()
}

function restoreWork(w: StudioWork) {
  spec.value = JSON.parse(JSON.stringify(w.spec)) as MemeSpec
  selected.value = null
  if (w.base) {
    loadBase(w.base, '作品底图', 'local')
  }
  showToast('已载入这件作品，可以接着改')
}

function deleteWork(id: string) {
  works.value = works.value.filter((w) => w.id !== id)
  persistWorks()
}

function resetAll() {
  spec.value = createDefaultSpec()
  selected.value = null
  baseImg.value = null
  baseMeta.value = { label: '还没有选底图', w: 0, h: 0, origin: 'none' }
  lastPicked.value = null
  clearDraft()
  showToast('已清空，重新来一张')
}

// ────────────────────────────── 灵感墙（实时渲染的成品预览） ──────────────────────────────

/**
 * 与其放一堆静态示意图，不如让引擎当场画：8 个配方 × 站内图库的缩略图，
 * 进页面就能看到「这个工具能做出什么」，点一下就换到主画布接着改。
 * 用 300px 缩略图渲染，整面墙的流量比一张原图还小。
 *
 * 注意：这段必须放在 gallery 声明之后 —— `watch(computed)` 会在初始化时就求值一次，
 * 放在前面会直接踩到 TDZ（Cannot access 'x' before initialization）。
 */
const wallCanvases = new Map<string, HTMLCanvasElement>()

function setWallCanvas(el: unknown, key: string) {
  if (el instanceof HTMLCanvasElement) wallCanvases.set(key, el)
}

const wallItems = computed(() => {
  const pool = gallery.value
  if (!pool.length) return []
  return MEME_RECIPES.map((recipe, i) => {
    const image = pool[(i * 3 + 1) % pool.length]
    return {
      key: `${recipe.id}-${image.id}`,
      recipe,
      image,
      thumb: image.thumbnailSmUrl || image.thumbnailUrl || image.url,
    }
  })
})

const imgCache = new Map<string, HTMLImageElement>()

function loadThumb(src: string): Promise<HTMLImageElement | null> {
  const hit = imgCache.get(src)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const el = new Image()
    el.decoding = 'async'
    el.onload = () => {
      imgCache.set(src, el)
      resolve(el)
    }
    el.onerror = () => resolve(null)
    el.src = src
  })
}

async function drawWall() {
  for (const item of wallItems.value) {
    const cvs = wallCanvases.get(item.key)
    if (!cvs) continue
    const img = await loadThumb(item.thumb)
    // 图片是异步加载的，回来时组件可能已经重渲染，必须重新取一次
    const cvs2 = wallCanvases.get(item.key)
    if (!img || !cvs2) continue
    const preview = specFromRecipe(createDefaultSpec(), item.recipe)
    const { W, H } = computeCanvasSize(preview.aspect, img)
    const scale = 0.34 * Math.min(2, window.devicePixelRatio || 1)
    cvs2.width = Math.round(W * scale)
    cvs2.height = Math.round(H * scale)
    const ctx = cvs2.getContext('2d')
    if (!ctx) continue
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const layout = layoutMeme(ctx, preview, W, H)
    drawMeme(ctx, layout, preview, img)
  }
}

function applyWall(item: { recipe: MemeRecipe; image: ImageItem }) {
  lastPicked.value = item.image
  applyRecipe(item.recipe)
  loadBase(picFrom(item.image), item.image.title || '站内图片', 'site')
  showToast('已换到你的画布 —— 改两个字就是你的了')
}

watch(wallItems, () => {
  void nextTick().then(drawWall)
})

// ────────────────────────────── 杂项 ──────────────────────────────

const filterState = computed(() => spec.value.filter)

function setAspect(a: MemeAspect) {
  spec.value.aspect = a
}
</script>

<template>
  <div class="studio">
    <!-- 顶栏 -->
    <header class="studio-head">
      <div class="min-w-0">
        <h1 class="studio-title">
          <span class="studio-logo">🐉</span>
          表情包工坊
          <span class="studio-badge">BETA</span>
        </h1>
        <p class="studio-sub">
          拖拽成图 · 三秒出片 · 全程在你的浏览器里完成，底图和成品都不会上传
        </p>
      </div>
      <div class="studio-actions">
        <button class="btn btn-ghost" title="随机底图 + 随机版式 + 随机文案" @click="randomize">🎲 给我灵感</button>
        <button class="btn btn-ghost" @click="resetAll">↺ 重来</button>
        <button class="btn btn-ghost" :disabled="busy" @click="copyToClipboard">⧉ 复制</button>
        <button class="btn btn-ghost hidden sm:inline-flex" @click="share">↗ 分享</button>
        <button class="btn btn-primary" :disabled="busy" @click="download">⬇ 下载 PNG</button>
      </div>
    </header>

    <div class="studio-grid">
      <!-- 左栏：底图与作品 -->
      <aside
        class="studio-rail studio-rail-left"
        :class="pickerOpen ? 'rail-open' : ''"
      >
        <div class="rail-head lg:hidden">
          <span class="rail-title">选底图</span>
          <button class="btn btn-ghost btn-xs" @click="pickerOpen = false">✕ 关闭</button>
        </div>

        <div class="rail-section">
          <div class="rail-title">底图来源</div>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="fileInput?.click()">📁 本地图片</button>
            <button class="btn btn-ghost flex-1" @click="randomFromGallery">🎲 随机一张</button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
          <p class="rail-note">
            {{ baseMeta.label }}
            <span v-if="baseMeta.w">· {{ baseMeta.w }}×{{ baseMeta.h }}</span>
          </p>
          <label class="rail-check">
            <input v-model="useOriginal" type="checkbox" />
            <span>站内图用原图（更清晰，费流量）</span>
          </label>
        </div>

        <div class="rail-section rail-grow">
          <div class="rail-title-row">
            <span class="rail-title">站内图库</span>
            <div class="seg">
              <button :class="['seg-btn', gallerySort === 'latest' ? 'seg-on' : '']" @click="gallerySort = 'latest'">最新</button>
              <button :class="['seg-btn', gallerySort === 'popular' ? 'seg-on' : '']" @click="gallerySort = 'popular'">最热</button>
              <button :class="['seg-btn', gallerySort === 'featured' ? 'seg-on' : '']" @click="gallerySort = 'featured'">精选</button>
            </div>
          </div>
          <div v-if="galleryLoading" class="rail-note">加载中…</div>
          <div v-else-if="!gallery.length" class="rail-note">还没拉到图片，试试上传本地图片</div>
          <div v-else class="gallery-grid">
            <button
              v-for="item in gallery"
              :key="item.id"
              class="gallery-cell"
              :title="item.title"
              @click="pickFromGallery(item)"
            >
              <img :src="thumbOf(item)" :alt="item.title" loading="lazy" />
            </button>
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-title-row">
            <span class="rail-title">我的作品</span>
            <span class="rail-note">只存在这台设备</span>
          </div>
          <div v-if="!works.length" class="rail-note">导出的图会自动收在这里，最多 9 张</div>
          <div v-else class="gallery-grid">
            <div v-for="w in works" :key="w.id" class="work-cell">
              <img :src="w.thumb" alt="我的作品" @click="restoreWork(w)" />
              <button class="work-del" title="删除" @click.stop="deleteWork(w.id)">✕</button>
            </div>
          </div>
        </div>

        <div class="rail-section lg:hidden">
          <button class="btn btn-primary w-full" @click="pickerOpen = false">就用这张，回工坊</button>
        </div>
      </aside>

      <!-- 中间：舞台 -->
      <section class="studio-stage">
        <div class="stage-toolbar">
          <div class="seg">
            <button
              v-for="a in ASPECTS"
              :key="a.key"
              :class="['seg-btn', spec.aspect === a.key ? 'seg-on' : '']"
              :title="a.hint"
              @click="setAspect(a.key)"
            >
              {{ a.label }}
            </button>
          </div>
          <button class="btn btn-ghost btn-xs lg:hidden" @click="pickerOpen = true">🖼 换底图</button>
          <div class="stage-hint hidden sm:block">{{ hint }}</div>
        </div>

        <div ref="stageRef" class="stage-box">
          <canvas
            ref="canvasRef"
            class="stage-canvas"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />
        </div>

        <!-- 一键出片：配方是人工调好的成品，点一下就是一张可以直接发出去的图 -->
        <div class="recipe-strip">
          <span class="recipe-lead">一键出片</span>
          <div class="recipe-scroll">
            <button
              v-for="r in MEME_RECIPES"
              :key="r.id"
              class="recipe-btn"
              :title="r.desc"
              @click="applyRecipe(r)"
            >
              <span class="recipe-emoji">{{ r.emoji }}</span>
              <span class="recipe-name">{{ r.name }}</span>
            </button>
          </div>
        </div>

        <div class="stage-foot">
          <div class="stage-foot-left">
            <span class="dot" /> 画布 {{ fit.W }}×{{ fit.H }} · 导出 {{ exportScale }}x
            <span v-if="selected" class="sel-tag">
              已选中：{{ selected.kind === 'text' ? (selectedText ? roleLabels[selectedText.role] : '文字') : '贴纸' }}
            </span>
          </div>
          <div class="stage-foot-right">
            <span class="rail-note">导出倍率</span>
            <div class="seg">
              <button v-for="s in [1, 2, 3]" :key="s" :class="['seg-btn', exportScale === s ? 'seg-on' : '']" @click="exportScale = s">{{ s }}x</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 右栏：控制台 -->
      <aside class="studio-rail studio-rail-right">
        <div class="rail-section">
          <div class="rail-title">版式</div>
          <div class="tpl-grid">
            <button
              v-for="t in TEMPLATES"
              :key="t.key"
              :class="['tpl-btn', spec.template === t.key ? 'tpl-on' : '']"
              :title="t.desc"
              @click="selectTemplate(t.key)"
            >
              <span class="tpl-emoji">{{ t.emoji }}</span>
              <span class="tpl-name">{{ t.name }}</span>
            </button>
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-title-row">
            <span class="rail-title">文案</span>
            <button class="btn btn-ghost btn-xs" @click="shuffleAllCopy">🎲 整段换一换</button>
          </div>

          <div class="mood-row">
            <button :class="['chip', mood === 'all' ? 'chip-on' : '']" @click="mood = 'all'">全部</button>
            <button
              v-for="m in MOODS"
              :key="m.key"
              :class="['chip', mood === m.key ? 'chip-on' : '']"
              @click="mood = m.key"
            >
              {{ m.emoji }} {{ m.label }}
            </button>
          </div>

          <div v-for="row in copyRows" :key="row.role" class="copy-row">
            <div class="copy-head">
              <span class="copy-label">{{ row.label }}</span>
              <button class="btn btn-ghost btn-xs" @click="fillCopy(row.role)">🎲 换一条</button>
            </div>
            <textarea
              v-model="row.block.content"
              class="copy-input"
              rows="2"
              maxlength="60"
              :placeholder="row.role === 'free' ? '想说什么？' : '一句话就好'"
            />
          </div>
        </div>

        <div v-if="focusedTexts.length || focusedStickers.length" class="rail-section rail-focus">
          <div class="rail-title-row">
            <span class="rail-title">选中项</span>
            <button class="btn btn-ghost btn-xs" @click="selected = null">取消选中</button>
          </div>

          <template v-for="t in focusedTexts" :key="t.id">
            <div class="ctl-row">
              <span class="ctl-label">字号</span>
              <input v-model.number="t.size" class="range" type="range" min="30" max="220" step="2" />
              <span class="ctl-val">{{ t.size }}</span>
            </div>
            <div class="ctl-row">
              <span class="ctl-label">旋转</span>
              <input v-model.number="t.rotation" class="range" type="range" min="-30" max="30" step="1" />
              <span class="ctl-val">{{ t.rotation }}°</span>
            </div>
            <div class="ctl-row">
              <span class="ctl-label">颜色</span>
              <div class="swatches">
                <button
                  v-for="c in SWATCHES"
                  :key="c"
                  class="swatch"
                  :class="t.color === c ? 'swatch-on' : ''"
                  :style="{ background: c }"
                  @click="t.color = c"
                />
              </div>
            </div>
            <div class="ctl-row">
              <span class="ctl-label">字体</span>
              <div class="mood-row">
                <button
                  v-for="f in FONT_KEYS"
                  :key="f"
                  :class="['chip', (t.font ?? 'bold') === f ? 'chip-on' : '']"
                  :title="FONT_STACKS[f].label"
                  :style="{ fontFamily: FONT_STACKS[f].family }"
                  @click="t.font = f"
                >
                  {{ FONT_STACKS[f].label }}
                </button>
              </div>
            </div>
            <div class="ctl-row">
              <span class="ctl-label">描边</span>
              <button :class="['toggle', t.stroke ? 'toggle-on' : '']" @click="t.stroke = !t.stroke">
                {{ t.stroke ? '经典黑边' : '无描边' }}
              </button>
              <div v-if="t.stroke" class="swatches">
                <button
                  v-for="c in STROKE_COLORS"
                  :key="c"
                  class="swatch swatch-stroke"
                  :class="(t.strokeColor || STROKE_COLORS[0]) === c ? 'swatch-on' : ''"
                  :style="{ background: c }"
                  :title="c"
                  @click="t.strokeColor = c"
                />
              </div>
              <button class="btn btn-ghost btn-xs" @click="resetPosition">复位位置</button>
            </div>
          </template>

          <template v-for="s in focusedStickers" :key="s.id">
            <div class="ctl-row">
              <span class="ctl-label">大小</span>
              <input v-model.number="s.size" class="range" type="range" min="40" max="420" step="4" />
              <span class="ctl-val">{{ s.size }}</span>
            </div>
            <div class="ctl-row">
              <span class="ctl-label">旋转</span>
              <input v-model.number="s.rotation" class="range" type="range" min="-180" max="180" step="1" />
              <span class="ctl-val">{{ s.rotation }}°</span>
            </div>
            <div class="ctl-row">
              <button class="btn btn-danger btn-xs" @click="removeSticker(s.id)">🗑 删掉这个贴纸</button>
            </div>
          </template>
        </div>

        <div class="rail-section">
          <div class="rail-title">贴纸</div>
          <div v-for="g in STICKER_GROUPS" :key="g.label" class="sticker-group">
            <span class="sticker-label">{{ g.label }}</span>
            <div class="sticker-row">
              <button v-for="e in g.items" :key="e" class="sticker-btn" @click="addSticker(e)">{{ e }}</button>
            </div>
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-title-row">
            <span class="rail-title">滤镜</span>
            <button class="btn btn-ghost btn-xs" @click="filterState.preset = 'none'; filterState.brightness = 1; filterState.contrast = 1; filterState.saturate = 1">重置</button>
          </div>
          <div class="mood-row">
            <button
              v-for="p in FILTER_PRESETS"
              :key="p.key"
              :class="['chip', filterState.preset === p.key ? 'chip-on' : '']"
              @click="filterState.preset = p.key"
            >
              {{ p.label }}
            </button>
          </div>
          <div class="ctl-row">
            <span class="ctl-label">亮度</span>
            <input v-model.number="filterState.brightness" class="range" type="range" min="0.6" max="1.5" step="0.01" />
            <span class="ctl-val">{{ filterState.brightness.toFixed(2) }}</span>
          </div>
          <div class="ctl-row">
            <span class="ctl-label">对比</span>
            <input v-model.number="filterState.contrast" class="range" type="range" min="0.6" max="1.6" step="0.01" />
            <span class="ctl-val">{{ filterState.contrast.toFixed(2) }}</span>
          </div>
          <div class="ctl-row">
            <span class="ctl-label">饱和</span>
            <input v-model.number="filterState.saturate" class="range" type="range" min="0" max="2" step="0.01" />
            <span class="ctl-val">{{ filterState.saturate.toFixed(2) }}</span>
          </div>
        </div>

        <div class="rail-section rail-tips">
          <div class="rail-title">小抄</div>
          <ul class="tips">
            <li>直接<b>拖</b>画布上的文字和贴纸</li>
            <li>点一下就能选中，右侧出现细调面板</li>
            <li><kbd>1</kbd>~<kbd>7</kbd> 换版式，<kbd>Ctrl</kbd>+<kbd>S</kbd> 下载，<kbd>Ctrl</kbd>+<kbd>D</kbd> 灵感</li>
            <li>选中后<b>方向键</b>微调（按住 <kbd>Shift</kbd> 走大步）</li>
            <li><kbd>Esc</kbd> 取消选中，<kbd>Delete</kbd> 删贴纸</li>
            <li>版式换来换去，写好的字不会丢；刷新也能接着改</li>
          </ul>
        </div>
      </aside>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="studio-toast">{{ toast }}</div>
    </Transition>

    <!-- 灵感墙：8 个配方 × 站内图，由引擎当场画出来 -->
    <section class="wall">
      <div class="wall-head">
        <h2 class="wall-title">看看能做出什么</h2>
        <p class="wall-sub">
          下面每一张都是这个工坊<strong>实时</strong>画出来的（配方 × 站内图库的图）。
          看中哪张就点一下 —— 它会整个换到你的画布上，改两个字就是你的了。
        </p>
      </div>
      <div v-if="!wallItems.length" class="wall-empty">图库加载完就会出现（如果一直空着，检查一下网络）</div>
      <div v-else class="wall-grid">
        <button
          v-for="item in wallItems"
          :key="item.key"
          class="wall-card"
          :title="`${item.recipe.name}：${item.recipe.desc}`"
          @click="applyWall(item)"
        >
          <span class="wall-canvas-wrap">
            <canvas :ref="(el: unknown) => setWallCanvas(el, item.key)" class="wall-canvas" />
          </span>
          <span class="wall-meta">
            <span class="wall-name">{{ item.recipe.emoji }} {{ item.recipe.name }}</span>
            <span class="wall-from">底图：{{ item.image.title }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── 工坊整体：一块常暗的工作台，跟站点主题解耦 ── */
.studio {
  --ink: #0b1020;
  --ink-2: #121a2e;
  --line: rgba(148, 163, 184, 0.18);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #facc15;
  --accent-2: #fb923c;
  background:
    radial-gradient(1200px 600px at 12% -10%, rgba(250, 204, 21, 0.12), transparent 60%),
    radial-gradient(900px 500px at 92% 0%, rgba(59, 130, 246, 0.14), transparent 55%),
    var(--ink);
  color: var(--text);
  min-height: calc(100vh - 4rem);
  padding: 1rem 1rem 1.5rem;
}

@media (min-width: 1280px) {
  .studio {
    padding: 1rem 1.25rem;
  }
}

.studio-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.25rem 0.9rem;
}

.studio-title {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin: 0;
}

.studio-logo {
  display: inline-grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.7rem;
  background: linear-gradient(140deg, var(--accent), var(--accent-2));
  font-size: 1.15rem;
  box-shadow: 0 8px 24px rgba(250, 204, 21, 0.28);
}

.studio-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 0.18rem 0.42rem;
  border-radius: 999px;
  border: 1px solid rgba(250, 204, 21, 0.45);
  color: var(--accent);
  transform: translateY(-1px);
}

.studio-sub {
  margin: 0.3rem 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.studio-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* ── 通用按钮 ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.08);
  color: var(--text);
  font-size: 0.82rem;
  padding: 0.44rem 0.72rem;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(148, 163, 184, 0.35);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-primary {
  background: linear-gradient(140deg, var(--accent), var(--accent-2));
  border-color: transparent;
  color: #1f1300;
  font-weight: 700;
  box-shadow: 0 10px 26px rgba(250, 204, 21, 0.22);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
}
.btn-danger {
  border-color: rgba(248, 113, 113, 0.5);
  color: #fca5a5;
}
.btn-xs {
  font-size: 0.72rem;
  padding: 0.28rem 0.5rem;
  border-radius: 0.5rem;
}
.btn-ghost {
  backdrop-filter: blur(6px);
}

/* ── 三栏骨架 ── */
.studio-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

@media (min-width: 1024px) {
  .studio-grid {
    grid-template-columns: 288px minmax(0, 1fr);
  }
}

@media (min-width: 1440px) {
  .studio-grid {
    grid-template-columns: 300px minmax(0, 1fr) 340px;
    align-items: start;
  }
  .studio-rail-right {
    position: sticky;
    top: 4.6rem;
    max-height: calc(100vh - 5.6rem);
    overflow-y: auto;
  }
  .studio-rail-left {
    position: sticky;
    top: 4.6rem;
    max-height: calc(100vh - 5.6rem);
  }
}

.studio-rail {
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(18, 26, 46, 0.92), rgba(11, 16, 32, 0.92));
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.studio-rail-left {
  display: none;
}
@media (min-width: 1024px) {
  .studio-rail-left {
    display: flex;
  }
  /* 中屏：右栏落到下方并排 */
}
@media (min-width: 1024px) and (max-width: 1439px) {
  .studio-rail-right {
    grid-column: 1 / -1;
  }
}

/* 移动端把左栏变成抽屉 */
.studio-rail-left.rail-open {
  display: flex;
  position: fixed;
  inset: 0.5rem;
  z-index: 60;
  overflow-y: auto;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}

.rail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rail-section + .rail-section {
  border-top: 1px dashed var(--line);
  padding-top: 0.85rem;
}

.rail-grow {
  min-height: 0;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.rail-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.rail-note {
  font-size: 0.72rem;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.rail-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: var(--muted);
  cursor: pointer;
}

/* ── 分段控件 ── */
.seg {
  display: inline-flex;
  padding: 0.15rem;
  border-radius: 0.6rem;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid var(--line);
}
.seg-btn {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 0.72rem;
  padding: 0.24rem 0.5rem;
  border-radius: 0.45rem;
  cursor: pointer;
  white-space: nowrap;
}
.seg-btn:hover {
  color: var(--text);
}
.seg-on {
  background: rgba(250, 204, 21, 0.16);
  color: var(--accent);
  font-weight: 700;
}

/* ── 图库网格 ── */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  overflow-y: auto;
  max-height: 34vh;
  padding-right: 0.15rem;
}
@media (min-width: 1440px) {
  .gallery-grid {
    max-height: 30vh;
  }
}
.gallery-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.6rem;
  overflow: hidden;
  border: 1px solid transparent;
  padding: 0;
  cursor: pointer;
  background: rgba(148, 163, 184, 0.08);
}
.gallery-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}
.gallery-cell:hover {
  border-color: var(--accent);
}
.gallery-cell:hover img {
  transform: scale(1.07);
}

.work-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.6rem;
  overflow: hidden;
  border: 1px solid var(--line);
}
.work-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
}
.work-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 1.1rem;
  height: 1.1rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 0;
  font-size: 0.6rem;
  background: rgba(15, 23, 42, 0.75);
  color: #fca5a5;
  cursor: pointer;
}

/* ── 舞台 ── */
.studio-stage {
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(18, 26, 46, 0.9), rgba(9, 13, 26, 0.95));
  padding: 0.7rem 0.7rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 0;
}
@media (min-width: 1024px) {
  .studio-stage {
    height: calc(100vh - 9.2rem);
    min-height: 460px;
  }
}

.stage-toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.stage-hint {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--muted);
}

.stage-box {
  position: relative;
  flex: 1;
  min-height: 260px;
  display: grid;
  place-items: center;
  border-radius: 0.8rem;
  background-image:
    linear-gradient(45deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.07) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.07) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.07) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
  overflow: hidden;
}

.stage-canvas {
  display: block;
  border-radius: 0.5rem;
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.5);
  touch-action: none;
  cursor: grab;
}
.stage-canvas:active {
  cursor: grabbing;
}

.stage-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: var(--muted);
}
.stage-foot-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.stage-foot-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.15);
}
.sel-tag {
  color: #7dd3fc;
}

/* ── 版式按钮 ── */
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}
.tpl-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.6rem;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.07);
  color: var(--text);
  font-size: 0.78rem;
  cursor: pointer;
  text-align: left;
}
.tpl-btn:hover {
  border-color: rgba(250, 204, 21, 0.5);
}
.tpl-on {
  border-color: var(--accent);
  background: rgba(250, 204, 21, 0.14);
}
.tpl-emoji {
  font-size: 0.95rem;
}
.tpl-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 文案 ── */
.mood-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.chip {
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.08);
  color: var(--muted);
  font-size: 0.7rem;
  padding: 0.22rem 0.45rem;
  border-radius: 999px;
  cursor: pointer;
}
.chip:hover {
  color: var(--text);
}
.chip-on {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(250, 204, 21, 0.12);
  font-weight: 700;
}

.copy-row {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}
.copy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.copy-label {
  font-size: 0.74rem;
  color: var(--text);
  font-weight: 600;
}
.copy-input {
  width: 100%;
  resize: vertical;
  border-radius: 0.55rem;
  border: 1px solid var(--line);
  background: rgba(2, 6, 23, 0.55);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.42rem 0.55rem;
  line-height: 1.4;
  font-family: inherit;
}
.copy-input:focus {
  outline: none;
  border-color: rgba(250, 204, 21, 0.6);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.12);
}

/* ── 选中项控制 ── */
.rail-focus {
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 0.75rem;
  padding: 0.7rem;
  background: rgba(56, 189, 248, 0.06);
}
.ctl-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ctl-label {
  font-size: 0.72rem;
  color: var(--muted);
  width: 2.4rem;
  flex: none;
}
.ctl-val {
  font-size: 0.7rem;
  color: var(--muted);
  width: 2.6rem;
  text-align: right;
  flex: none;
  font-variant-numeric: tabular-nums;
}
.range {
  flex: 1;
  min-width: 0;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.3);
  outline: none;
}
.range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--accent);
  border: 2px solid #1f1300;
  cursor: pointer;
}
.range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--accent);
  border: 2px solid #1f1300;
  cursor: pointer;
}
.swatches {
  display: flex;
  gap: 0.28rem;
  flex-wrap: wrap;
}
.swatch {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  border: 2px solid rgba(148, 163, 184, 0.35);
  cursor: pointer;
}
.swatch-on {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25);
}
.toggle {
  flex: 1;
  border-radius: 0.5rem;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.08);
  color: var(--muted);
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
}
.toggle-on {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(250, 204, 21, 0.12);
}

/* ── 贴纸 ── */
.sticker-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.sticker-label {
  font-size: 0.68rem;
  color: var(--muted);
}
.sticker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem;
}
.sticker-btn {
  width: 1.85rem;
  height: 1.85rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.07);
  cursor: pointer;
  transition: transform 0.14s ease, border-color 0.14s ease;
}
.sticker-btn:hover {
  transform: translateY(-2px) scale(1.08);
  border-color: var(--accent);
}

/* ── 小抄 ── */
.tips {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.75;
}
.tips b {
  color: var(--text);
}
.tips kbd {
  border: 1px solid var(--line);
  border-radius: 0.3rem;
  padding: 0 0.25rem;
  font-size: 0.68rem;
  color: var(--text);
}

/* ── 一键出片配方条 ── */
.recipe-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.1rem;
}
.recipe-lead {
  flex: none;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  writing-mode: horizontal-tb;
}
.recipe-scroll {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: thin;
}
.recipe-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.08);
  color: var(--text);
  font-size: 0.74rem;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
}
.recipe-btn:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  background: rgba(250, 204, 21, 0.12);
}
.recipe-emoji {
  font-size: 0.9rem;
}
.recipe-name {
  font-weight: 600;
}

/* ── 灵感墙 ── */
.wall {
  margin-top: 1.1rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(18, 26, 46, 0.75), rgba(9, 13, 26, 0.85));
  padding: 1rem 0.9rem 1.1rem;
}
.wall-head {
  margin-bottom: 0.85rem;
}
.wall-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.wall-title::before {
  content: '✨';
  font-size: 0.95rem;
}
.wall-sub {
  margin: 0.3rem 0 0;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.6;
}
.wall-sub strong {
  color: var(--accent);
}
.wall-empty {
  font-size: 0.76rem;
  color: var(--muted);
}
.wall-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
@media (min-width: 768px) {
  .wall-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .wall-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.wall-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.4rem;
  border-radius: 0.75rem;
  border: 1px solid var(--line);
  background: rgba(148, 163, 184, 0.06);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
.wall-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.4);
}
.wall-canvas-wrap {
  display: block;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #0b1020;
}
.wall-canvas {
  display: block;
  width: 100%;
  height: auto;
}
.wall-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0 0.15rem 0.15rem;
}
.wall-name {
  font-size: 0.76rem;
  font-weight: 700;
}
.wall-from {
  font-size: 0.66rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 提示条 ── */
.studio-toast {
  position: fixed;
  left: 50%;
  bottom: 2.2rem;
  transform: translateX(-50%);
  z-index: 80;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  font-size: 0.82rem;
  color: #1f1300;
  background: linear-gradient(140deg, var(--accent), var(--accent-2));
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
