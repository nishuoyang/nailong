<script setup lang="ts">
/**
 * 表情包工坊 · /studio
 *
 * 定位：把站内图库变成「能直接做梗图」的素材库。
 * 关键取舍：
 *  - 全部渲染在浏览器 canvas 完成，不上传、不入库、不占服务端（生产机只有 2vCPU/1.6GB）。
 *  - 底图优先用站内的 800px 缩略图，秒开且省流量；需要更清晰时可切「原图」。
 *  - 预览与导出共用同一套布局函数（utils/memeCanvas.ts），所见即所得。
 *  - UI 完全走站点的纸感 token：浅色是暖米纸，深色是暖炭，不再是一块独立的暗色面板。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiModal from '@/components/ui/UiModal.vue'
import { useToast } from '@/composables/useToast'
import { getCategories, getFeatured, getImageById, getImages, type ImageItem } from '@/api/images'
import { uploadImage } from '@/api/upload'
import { useAuthStore } from '@/stores/auth'
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
  type MemeTextBlock,
  type TextRole,
} from '@/utils/memeCanvas'
import {
  ALL_STICKERS,
  HINTS,
  MEME_RECIPES,
  MOODS,
  STICKER_GROUPS,
  randomCopy,
  randomSticker,
  type MemeMood,
  type MemeRecipe,
} from '@/data/memeCopy'

// ────────────────────────────── 基础状态 ──────────────────────────────

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

type ToastKind = 'success' | 'error' | 'info' | 'warning'
function showToast(message: string, type: ToastKind = 'info') {
  toast[type](message)
}

const spec = ref<MemeSpec>(createDefaultSpec())
const baseImg = shallowRef<HTMLImageElement | null>(null)
const baseSrc = ref<string | null>(null)
const baseMeta = ref<{ label: string; w: number; h: number; origin: 'site' | 'local' | 'none' }>({
  label: '还没有选底图',
  w: 0,
  h: 0,
  origin: 'none',
})
const baseDataCache = ref<string | null>(null)
const activeBaseId = ref<string | null>(null)
const lastPicked = ref<ImageItem | null>(null)
const useOriginal = ref(false)
const selected = ref<HitTarget>(null)
const panelTab = ref<'layout' | 'copy' | 'sticker' | 'filter'>('layout')
const pickerOpen = ref(false)
const showHelp = ref(false)
const dragOver = ref(false)
const drawerMode = ref(typeof window !== 'undefined' ? window.innerWidth < 1280 : false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const stageSize = ref({ w: 640, h: 720 })
const layoutRef = shallowRef<MemeLayout | null>(null)

const hint = ref(HINTS[0])
function rollHint() {
  hint.value = HINTS[Math.floor(Math.random() * HINTS.length)]
}

const PANEL_TABS: Array<{ key: 'layout' | 'copy' | 'sticker' | 'filter'; label: string; icon: string }> = [
  { key: 'layout', label: '版式', icon: 'layout' },
  { key: 'copy', label: '文案', icon: 'quote' },
  { key: 'sticker', label: '贴纸', icon: 'smile' },
  { key: 'filter', label: '滤镜', icon: 'filter' },
]

const GALLERY_SORTS: Array<{ key: 'latest' | 'popular' | 'featured'; label: string }> = [
  { key: 'latest', label: '最新' },
  { key: 'popular', label: '最热' },
  { key: 'featured', label: '精选' },
]

const ALIGNS: Array<{ key: MemeTextBlock['align']; label: string }> = [
  { key: 'left', label: '左' },
  { key: 'center', label: '中' },
  { key: 'right', label: '右' },
]

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
  const widthPx = w + 'px'
  const heightPx = h + 'px'
  if (cvs.style.width !== widthPx) cvs.style.width = widthPx
  if (cvs.style.height !== heightPx) cvs.style.height = heightPx
  const ctx = cvs.getContext('2d')
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const layout = layoutMeme(ctx, spec.value, W, H)
  layoutRef.value = layout
  drawMeme(ctx, layout, spec.value, baseImg.value, { selection: selected.value })
}

watch(spec, () => {
  scheduleRender()
  scheduleCommit()
  scheduleDraftSave()
}, { deep: true })
watch([fit, selected], scheduleRender)

/** 画布文字用到了站点的自托管得意黑；等字体就绪再画，避免先量出一套窄字宽 */
let fontsReady = false
async function ensureFonts() {
  if (fontsReady || typeof document === 'undefined' || !('fonts' in document)) return
  try {
    await document.fonts.load('16px "Smiley Sans"')
    await document.fonts.ready
  } catch {
    /* 字体加载失败就退回系统字体，不影响出图 */
  }
  fontsReady = true
  scheduleRender()
  void nextTick().then(drawWall)
}

// ────────────────────────────── 尺寸自适应 ──────────────────────────────

let ro: ResizeObserver | null = null
let initializing = true

function onResize() {
  if (typeof window === 'undefined') return
  drawerMode.value = window.innerWidth < 1280
  if (!drawerMode.value) {
    if (pickerOpen.value) pickerOpen.value = false
    document.body.style.overflow = ''
  }
}

watch(pickerOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open && drawerMode.value ? 'hidden' : ''
})

onMounted(async () => {
  const el = stageRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      stageSize.value = {
        w: Math.max(160, r.width - 10),
        h: Math.max(220, r.height - 10),
      }
    })
    ro.observe(el)
  }

  loadWorks()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)

  void ensureFonts()
  await loadGallery(true)

  // 从详情页「做成表情包」进来：?image=<id> 直接把那张图铺成底图，
  // 比让用户在图库里再找一遍顺手得多。
  const fromDetail = typeof route.query.image === 'string' ? route.query.image : ''
  if (fromDetail) {
    try {
      const r = await getImageById(fromDetail)
      const item = r.data.data
      if (item) {
        lastPicked.value = item
        activeBaseId.value = item.id
        loadBase(picFrom(item), item.title || '站内图片', 'site', { commit: false })
        showToast('底图已就位，改两行字就能发', 'success')
      }
    } catch {
      showToast('那张图没能加载，先从图库挑一张吧', 'error')
    }
  } else {
    // 没有深链时，先把上次没做完的草稿接回来（刷新不丢）
    const draftState = loadDraft()
    if (draftState !== 'none') showToast('已接回上次没做完的草稿，想清空点「重来」')
    // 首屏别给一块空画布：图库一到位就自动铺一张最新图，进来就是一个「已成图」的状态
    if (draftState !== 'base' && !baseImg.value && gallery.value.length) {
      const first = gallery.value[0]
      lastPicked.value = first
      activeBaseId.value = first.id
      loadBase(picFrom(first), first.title || '站内图片', 'site', { commit: false })
    }
  }

  initializing = false
  resetHistory()
  await nextTick()
  scheduleRender()
  void drawWall()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (rafId) window.cancelAnimationFrame(rafId)
  if (draftTimer) window.clearTimeout(draftTimer)
  if (historyTimer) window.clearTimeout(historyTimer)
  if (searchTimer) window.clearTimeout(searchTimer)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  if (!initializing) saveDraft()
})

// ────────────────────────────── 快捷键 ──────────────────────────────

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (showSubmit.value || showHelp.value) return

  if (e.key === 'Escape') {
    if (pickerOpen.value) {
      pickerOpen.value = false
      return
    }
    selected.value = null
    return
  }

  const typing = isTypingTarget(e.target)
  const mod = e.ctrlKey || e.metaKey

  // 下载放在 typing 判断之前：在文本框里按 Ctrl+S 也应该保存图片，而不是弹浏览器保存网页。
  if (mod && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    void download()
    return
  }

  if (mod && (e.key === 'z' || e.key === 'Z')) {
    if (typing) return
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    return
  }
  if (mod && (e.key === 'y' || e.key === 'Y')) {
    if (typing) return
    e.preventDefault()
    redo()
    return
  }
  if (typing) return

  if (mod && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    randomize()
    return
  }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    e.preventDefault()
    showHelp.value = true
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
    e.preventDefault()
    if (selected.value.kind === 'sticker') removeSticker(selected.value.id)
    return
  }
  if ((e.key === '[' || e.key === ']') && selected.value) {
    e.preventDefault()
    bumpSize(e.key === ']' ? 6 : -6)
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

// ────────────────────────────── 撤销 / 重做 ──────────────────────────────

interface HistorySnapshot {
  spec: string
  baseSrc: string | null
  baseLabel: string
  baseOrigin: 'site' | 'local' | 'none'
  useOriginal: boolean
  activeBaseId: string | null
}

const history = ref<HistorySnapshot[]>([])
const historyIndex = ref(-1)
let historyTimer: number | undefined
let restoringHistory = false
const specJson = computed(() => JSON.stringify(spec.value))

const pendingChanged = computed(() => {
  const cur = history.value[historyIndex.value]
  if (!cur) return true
  return (
    cur.spec !== specJson.value ||
    cur.baseSrc !== baseSrc.value ||
    cur.baseLabel !== baseMeta.value.label ||
    cur.baseOrigin !== baseMeta.value.origin ||
    cur.useOriginal !== useOriginal.value ||
    cur.activeBaseId !== activeBaseId.value
  )
})
const canUndo = computed(() => historyIndex.value > 0 || (historyIndex.value === 0 && pendingChanged.value))
const canRedo = computed(
  () => !pendingChanged.value && historyIndex.value >= 0 && historyIndex.value < history.value.length - 1,
)

function makeSnapshot(): HistorySnapshot {
  return {
    spec: specJson.value,
    baseSrc: baseSrc.value,
    baseLabel: baseMeta.value.label,
    baseOrigin: baseMeta.value.origin,
    useOriginal: useOriginal.value,
    activeBaseId: activeBaseId.value,
  }
}

function sameSnapshot(a: HistorySnapshot, b: HistorySnapshot) {
  return (
    a.spec === b.spec &&
    a.baseSrc === b.baseSrc &&
    a.baseLabel === b.baseLabel &&
    a.baseOrigin === b.baseOrigin &&
    a.useOriginal === b.useOriginal &&
    a.activeBaseId === b.activeBaseId
  )
}

function commitHistory() {
  if (restoringHistory || initializing) return
  const snap = makeSnapshot()
  const cur = history.value[historyIndex.value]
  if (cur && sameSnapshot(cur, snap)) return
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(snap)
  if (history.value.length > 24) history.value.shift()
  historyIndex.value = history.value.length - 1
}

function scheduleCommit() {
  if (restoringHistory || initializing) return
  if (historyTimer) window.clearTimeout(historyTimer)
  historyTimer = window.setTimeout(commitHistory, 650)
}

function resetHistory() {
  history.value = []
  historyIndex.value = -1
  commitHistory()
}

function applySnapshot(snap: HistorySnapshot) {
  restoringHistory = true
  spec.value = JSON.parse(snap.spec) as MemeSpec
  selected.value = null
  useOriginal.value = snap.useOriginal
  activeBaseId.value = snap.activeBaseId
  if (snap.baseSrc && snap.baseSrc !== baseSrc.value) {
    const picked = snap.activeBaseId
      ? gallery.value.find((item) => item.id === snap.activeBaseId) ?? null
      : null
    lastPicked.value = picked
    loadBase(snap.baseSrc, snap.baseLabel, snap.baseOrigin === 'local' ? 'local' : 'site', {
      commit: false,
      cache: snap.baseOrigin === 'local' ? snap.baseSrc : null,
    })
  } else if (!snap.baseSrc && baseSrc.value) {
    clearBase()
  }
  nextTick(() => {
    restoringHistory = false
    scheduleRender()
  })
}

function undo() {
  if (historyTimer) {
    window.clearTimeout(historyTimer)
    historyTimer = undefined
  }
  commitHistory()
  if (historyIndex.value <= 0) return
  historyIndex.value -= 1
  const snap = history.value[historyIndex.value]
  if (snap) {
    applySnapshot(snap)
    showToast('已撤销')
  }
}

function redo() {
  if (historyIndex.value < 0 || historyIndex.value >= history.value.length - 1) return
  historyIndex.value += 1
  const snap = history.value[historyIndex.value]
  if (snap) {
    applySnapshot(snap)
    showToast('已重做')
  }
}

// ────────────────────────────── 底图 ──────────────────────────────

function picFrom(item: ImageItem): string {
  if (useOriginal.value) return item.url
  return item.thumbnailUrl || item.thumbnailSmUrl || item.url
}

function loadBase(
  src: string,
  label: string,
  origin: 'site' | 'local',
  opts: { commit?: boolean; cache?: string | null } = {},
) {
  const commit = opts.commit !== false
  const el = new Image()
  el.decoding = 'async'
  baseSrc.value = src
  baseMeta.value = { ...baseMeta.value, label, origin }
  baseDataCache.value = opts.cache ?? (origin === 'local' ? src : null)
  el.onload = () => {
    if (baseSrc.value !== src) return
    baseImg.value = el
    baseMeta.value = { label, w: el.naturalWidth, h: el.naturalHeight, origin }
    if (origin === 'local' && !opts.cache) {
      // 本地原图可能很大，草稿/作品只留 1000px 的缩略版，别把 localStorage 撑爆
      window.setTimeout(() => {
        if (baseSrc.value === src) baseDataCache.value = downscale(el, 1000)
      }, 0)
    }
    scheduleRender()
  }
  el.onerror = () => showToast('这张图加载失败了，换一张试试', 'error')
  el.src = src
  if (commit) {
    scheduleCommit()
    scheduleDraftSave()
  }
  scheduleRender()
}

function clearBase() {
  baseImg.value = null
  baseSrc.value = null
  baseDataCache.value = null
  baseMeta.value = { label: '还没有选底图', w: 0, h: 0, origin: 'none' }
  activeBaseId.value = null
  selected.value = null
  scheduleRender()
}

function pickFromGallery(item: ImageItem, opts: { quiet?: boolean } = {}) {
  lastPicked.value = item
  activeBaseId.value = item.id
  selected.value = null
  loadBase(picFrom(item), item.title || '站内图片', 'site')
  pickerOpen.value = false
  if (!opts.quiet) showToast('已设为底图，拖一下文字试试')
}

const basePreview = computed(() => {
  if (baseMeta.value.origin === 'site' && lastPicked.value) return thumbOf(lastPicked.value)
  return baseDataCache.value || baseSrc.value
})

const fileInput = ref<HTMLInputElement | null>(null)

function handleLocalFile(file: File) {
  if (!file.type.startsWith('image/')) {
    showToast('只能选图片文件', 'warning')
    return
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('图片太大了（上限 12MB）', 'warning')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    lastPicked.value = null
    activeBaseId.value = null
    selected.value = null
    normaliseLocalImage(reader.result, file.name, file.size)
    pickerOpen.value = false
    showToast('本地图片已就位（不会上传到服务器）', 'success')
  }
  reader.readAsDataURL(file)
}

/** 本地大图先缩到 2000px 以内：canvas 更快，撤销历史也不会囤一堆 12MB 的 data URL */
function normaliseLocalImage(src: string, name: string, bytes: number) {
  const el = new Image()
  el.onload = () => {
    const maxEdge = Math.max(el.naturalWidth, el.naturalHeight)
    if (maxEdge <= 2000 && bytes <= 3.5 * 1024 * 1024) {
      loadBase(src, name, 'local')
      return
    }
    const scale = Math.min(1, 2000 / maxEdge)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(el.naturalWidth * scale))
    c.height = Math.max(1, Math.round(el.naturalHeight * scale))
    const ctx = c.getContext('2d')
    if (!ctx) {
      loadBase(src, name, 'local')
      return
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(el, 0, 0, c.width, c.height)
    loadBase(c.toDataURL('image/jpeg', 0.9), name, 'local')
  }
  el.onerror = () => showToast('这张图读不出来，换一张试试', 'error')
  el.src = src
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleLocalFile(file)
  input.value = ''
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    e.preventDefault()
    dragOver.value = true
  }
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement | null
  if (el && e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return
  dragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleLocalFile(file)
}

watch(useOriginal, () => {
  if (restoringHistory) return
  if (baseMeta.value.origin === 'site' && lastPicked.value) {
    loadBase(picFrom(lastPicked.value), lastPicked.value.title || '站内图片', 'site')
  }
})

// ────────────────────────────── 草稿自动保存 ──────────────────────────────

/**
 * 刷新不丢正在做的图。
 * 底图分两种存法：站内图存 URL（重新加载像素完全一致），本地图片才存缩略版 data URL
 * （原文件在浏览器里拿不到第二次）。
 */
const DRAFT_KEY = 'nailong.studio.draft.v1'
let draftTimer: number | undefined
const draftSavedAt = ref(0)

interface StudioDraft {
  spec: MemeSpec
  baseUrl?: string
  baseData?: string
  label?: string
  origin?: 'site' | 'local'
  activeBaseId?: string | null
  useOriginal?: boolean
  savedAt: number
}

function isPristine() {
  const s = spec.value
  if (s.template !== 'classic' || s.aspect !== 'auto' || s.stickers.length) return false
  if (s.filter.preset !== 'none' || s.filter.brightness !== 1 || s.filter.contrast !== 1 || s.filter.saturate !== 1) {
    return false
  }
  if (s.texts.length !== 2) return false
  const top = s.texts.find((t) => t.role === 'top')
  const bottom = s.texts.find((t) => t.role === 'bottom')
  if (!top || !bottom) return false
  if (top.content.trim() !== '我很好' || bottom.content.trim() !== '只是精神状态进化成了奶蛙') return false
  return s.texts.every(
    (t) =>
      t.x === null &&
      t.y === null &&
      t.size === 96 &&
      t.rotation === 0 &&
      t.color === '#ffffff' &&
      t.stroke === true &&
      (t.font ?? 'bold') === 'bold' &&
      (t.strokeColor ?? '#000000') === '#000000',
  )
}

function scheduleDraftSave() {
  if (initializing) return
  if (draftTimer) window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(saveDraft, 900)
}

function saveDraft() {
  try {
    if (isPristine() && !baseSrc.value) {
      localStorage.removeItem(DRAFT_KEY)
      draftSavedAt.value = 0
      return
    }
    const draft: StudioDraft = {
      spec: JSON.parse(JSON.stringify(spec.value)) as MemeSpec,
      activeBaseId: activeBaseId.value,
      useOriginal: useOriginal.value,
      savedAt: Date.now(),
    }
    if (baseMeta.value.origin === 'site' && baseSrc.value) {
      draft.baseUrl = baseSrc.value
      draft.label = baseMeta.value.label
      draft.origin = 'site'
    } else if (baseMeta.value.origin === 'local' && (baseDataCache.value || baseSrc.value)) {
      draft.baseData = baseDataCache.value || baseSrc.value || ''
      draft.label = baseMeta.value.label
      draft.origin = 'local'
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    draftSavedAt.value = Date.now()
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
  draftSavedAt.value = 0
}

/** 返回值告诉调用方恢复到了什么程度（决定要不要再自动铺一张图库最新图） */
function loadDraft(): 'none' | 'spec' | 'base' {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return 'none'
    const d = JSON.parse(raw) as StudioDraft
    if (!d?.spec || !Array.isArray(d.spec.texts)) return 'none'
    spec.value = d.spec
    activeBaseId.value = d.activeBaseId ?? null
    lastPicked.value = d.activeBaseId
      ? gallery.value.find((item) => item.id === d.activeBaseId) ?? null
      : null
    useOriginal.value = !!d.useOriginal
    if (d.baseUrl) {
      loadBase(d.baseUrl, d.label || '草稿底图', 'site', { commit: false })
      return 'base'
    }
    if (d.baseData) {
      loadBase(d.baseData, d.label || '草稿底图', 'local', { commit: false, cache: d.baseData })
      return 'base'
    }
    return 'spec'
  } catch {
    return 'none'
  }
}

const draftStatus = computed(() => {
  if (!draftSavedAt.value) return '自动保存草稿'
  const d = new Date(draftSavedAt.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return '草稿已保存 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
})

// ────────────────────────────── 站内图库 ──────────────────────────────

const gallery = ref<ImageItem[]>([])
const gallerySort = ref<'latest' | 'popular' | 'featured'>('latest')
const gallerySearch = ref('')
const galleryLoading = ref(false)
const galleryMoreLoading = ref(false)
const galleryError = ref(false)
const galleryPage = ref(1)
const galleryTotalPages = ref(1)
const galleryTotal = ref(0)
let gallerySeq = 0
let searchTimer: number | undefined

const galleryHasMore = computed(
  () => !galleryLoading.value && !galleryError.value && galleryPage.value < galleryTotalPages.value,
)

async function loadGallery(reset = true) {
  const seq = ++gallerySeq
  if (reset) {
    galleryLoading.value = true
    galleryPage.value = 1
  } else {
    galleryMoreLoading.value = true
  }
  galleryError.value = false

  try {
    const search = gallerySearch.value.trim()
    const page = reset ? 1 : galleryPage.value + 1
    let items: ImageItem[] = []
    let totalPages = 1
    let total = 0

    if (gallerySort.value === 'featured' && !search) {
      const r = await getFeatured({ page, size: 24 })
      items = r.data.data ?? []
      totalPages = r.data.meta?.totalPages ?? 1
      total = r.data.meta?.total ?? items.length
    } else {
      const sort = gallerySort.value === 'popular' ? 'popular' : 'latest'
      const r = await getImages({
        page,
        size: 24,
        search: search || undefined,
        sort,
      })
      items = r.data.data ?? []
      totalPages = r.data.meta?.totalPages ?? 1
      total = r.data.meta?.total ?? items.length
    }

    if (seq !== gallerySeq) return
    gallery.value = reset ? items : [...gallery.value, ...items]
    galleryPage.value = page
    galleryTotalPages.value = totalPages
    galleryTotal.value = total
  } catch {
    if (seq !== gallerySeq) return
    if (reset) gallery.value = []
    galleryError.value = true
    showToast('图库没拉到，检查一下网络', 'error')
  } finally {
    if (seq === gallerySeq) {
      galleryLoading.value = false
      galleryMoreLoading.value = false
    }
  }
}

function loadNextGalleryPage() {
  if (!galleryHasMore.value || galleryMoreLoading.value) return
  void loadGallery(false)
}

watch(gallerySort, () => void loadGallery(true))
watch(gallerySearch, () => {
  if (gallerySearch.value.trim() && gallerySort.value === 'featured') {
    gallerySort.value = 'latest'
  }
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadGallery(true), 380)
})

function thumbOf(item: ImageItem): string {
  return item.thumbnailSmUrl || item.thumbnailUrl || item.url
}

function randomFromGallery(silent = false) {
  if (!gallery.value.length) {
    showToast('图库还在加载，稍等一下', 'warning')
    return
  }
  const item = gallery.value[Math.floor(Math.random() * gallery.value.length)]
  pickFromGallery(item, { quiet: silent })
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
  showToast('已切换版式：' + (TEMPLATES.find((t) => t.key === key)?.name ?? ''))
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

function duplicateSticker(id: string) {
  const s = spec.value.stickers.find((x) => x.id === id)
  if (!s) return
  const copy = {
    ...s,
    id: uid('s'),
    x: clamp(s.x + 0.045, 0, 1),
    y: clamp(s.y + 0.045, 0, 1),
    rotation: s.rotation + 4,
  }
  spec.value.stickers.push(copy)
  selected.value = { kind: 'sticker', id: copy.id }
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

function onCanvasWheel(e: WheelEvent) {
  const s = selectedSticker.value
  if (!s) return
  e.preventDefault()
  s.size = clamp(s.size + (e.deltaY < 0 ? 10 : -10), 40, 460)
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

const selectedLabel = computed(() => {
  if (!selected.value) return ''
  if (selected.value.kind === 'sticker') return '贴纸'
  const t = selectedText.value
  return t ? roleLabels.value[t.role] : '文字'
})

function resetPosition() {
  const t = selectedText.value
  if (!t) return
  t.x = null
  t.y = null
  showToast('已回到版式默认位置')
}

function bumpSize(delta: number) {
  const t = selectedText.value
  if (t) {
    t.size = clamp(t.size + delta, 30, 220)
    return
  }
  const s = selectedSticker.value
  if (s) s.size = clamp(s.size + delta, 40, 460)
}

function onTextColor(e: Event, block: MemeTextBlock) {
  const value = (e.target as HTMLInputElement).value
  if (value) block.color = value
}

function onStrokeColor(e: Event, block: MemeTextBlock) {
  const value = (e.target as HTMLInputElement).value
  if (value) block.strokeColor = value
}

const SWATCHES = ['#ffffff', '#efbe4d', '#181510', '#d9552b', '#2c6b57', '#6b91a8', '#cf8791', '#a78bfa']
/** 描边色：默认第一项就是经典黑边，顺序不要动 */
const STROKE_COLORS = ['#000000', '#ffffff', '#efbe4d', '#d9552b']

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
  const aspects: MemeAspect[] = ['auto', '1:1', '4:5']
  next.aspect = aspects[Math.floor(Math.random() * aspects.length)]
  next.filter = {
    preset: FILTER_PRESETS[Math.floor(Math.random() * FILTER_PRESETS.length)].key,
    brightness: 1,
    contrast: 1,
    saturate: 1,
  }
  next.stickers =
    Math.random() > 0.45
      ? [
          {
            id: uid('s'),
            emoji: randomSticker(),
            x: 0.78 + Math.random() * 0.08,
            y: 0.22 + Math.random() * 0.1,
            size: 170,
            rotation: Math.random() * 14 - 7,
          },
        ]
      : []
  spec.value = next
  selected.value = null
  rollHint()
  if (gallery.value.length) randomFromGallery(true)
  showToast('换了一套版式和文案')
}

// ────────────────────────────── 配方 ──────────────────────────────

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

function applyRecipe(r: MemeRecipe, quiet = false) {
  spec.value = specFromRecipe(spec.value, r)
  selected.value = null
  rollHint()
  if (!quiet) showToast('配方已套用：' + r.name + ' —— 直接下载，或者接着改')
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
  ctx.fillStyle = '#f3ede1'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return c.toDataURL(type, q)
}

function buildBlob(): Promise<Blob | null> {
  const { W, H } = fit.value
  const canvas = renderToCanvas(spec.value, baseImg.value, W, H, exportScale.value)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

function specSlug() {
  const first = spec.value.texts.map((t) => t.content.trim()).find(Boolean) ?? ''
  const clean = first
    .replace(/[\\/:*?"<>|#%&{}$!'@+=]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 18)
    .replace(/^-+|-+$/g, '')
  return clean || 'meme'
}

function fileName(ext = 'png') {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    String(d.getFullYear()) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  return 'nailong-' + specSlug() + '-' + stamp + '.' + ext
}

async function download() {
  if (busy.value) return
  busy.value = true
  try {
    const blob = await buildBlob()
    if (!blob) {
      showToast('导出失败了，换个浏览器试试', 'error')
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
    showToast('已导出 PNG · ' + exportScale.value + 'x，也收进「我的作品」了', 'success')
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
      saveWork()
      showToast('已复制到剪贴板，直接粘贴就能发', 'success')
    } else {
      showToast('这个浏览器不支持复制图片，用下载吧', 'warning')
    }
  } catch {
    showToast('复制被浏览器拦下了，用下载吧', 'error')
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
      showToast('这台设备不支持系统分享，先下载吧', 'warning')
    }
  } catch {
    /* 用户取消分享，静默 */
  }
}

// ────────────────────────────── 我的作品（本地留存） ──────────────────────────────

interface StudioWork {
  id: string
  thumb: string
  /** 站内图存 URL；本地图存缩略 data URL。旧版本的作品里这里只有 data URL。 */
  base: string | null
  baseOrigin?: 'site' | 'local'
  activeBaseId?: string | null
  useOriginal?: boolean
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
  const origin = baseMeta.value.origin
  let base: string | null = null
  let baseOrigin: 'site' | 'local' | undefined
  if (origin === 'site' && baseSrc.value) {
    base = baseSrc.value
    baseOrigin = 'site'
  } else if (origin === 'local') {
    base = baseDataCache.value || (baseImg.value ? downscale(baseImg.value, 900) : null)
    baseOrigin = 'local'
  }
  const work: StudioWork = {
    id: uid('w'),
    thumb,
    base,
    baseOrigin,
    activeBaseId: activeBaseId.value,
    useOriginal: useOriginal.value,
    spec: JSON.parse(JSON.stringify(spec.value)) as MemeSpec,
    createdAt: Date.now(),
  }
  works.value = [work, ...works.value].slice(0, MAX_WORKS)
  persistWorks()
}

function restoreWork(w: StudioWork) {
  spec.value = JSON.parse(JSON.stringify(w.spec)) as MemeSpec
  selected.value = null
  lastPicked.value = w.activeBaseId
    ? gallery.value.find((item) => item.id === w.activeBaseId) ?? null
    : null
  activeBaseId.value = w.activeBaseId ?? null
  useOriginal.value = !!w.useOriginal
  if (w.base) {
    const origin = w.baseOrigin ?? 'local'
    loadBase(w.base, '作品底图', origin, { cache: origin === 'local' ? w.base : null })
  } else {
    clearBase()
  }
  showToast('已载入这件作品，可以接着改')
}

function deleteWork(id: string) {
  works.value = works.value.filter((w) => w.id !== id)
  persistWorks()
}

function formatWorkDate(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resetAll() {
  spec.value = createDefaultSpec()
  selected.value = null
  lastPicked.value = null
  activeBaseId.value = null
  useOriginal.value = false
  clearBase()
  clearDraft()
  rollHint()
  showToast('已清空，撤销可以找回')
}

// ────────────────────────────── 灵感墙（实时渲染的成品预览） ──────────────────────────────

/**
 * 与其放一堆静态示意图，不如让引擎当场画：8 个配方 × 站内图库的缩略图，
 * 进页面就能看到「这个工具能做出什么」，点一下就换到主画布接着改。
 * 用 300px 缩略图渲染，整面墙的流量比一张原图还小。
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
      key: recipe.id + '-' + image.id,
      recipe,
      image,
      thumb: thumbOf(image),
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
  if (typeof document === 'undefined') return
  await Promise.all(
    wallItems.value.map(async (item) => {
      const cvs = wallCanvases.get(item.key)
      if (!cvs) return
      const img = await loadThumb(item.thumb)
      // 图片是异步加载的，回来时组件可能已经重渲染，必须重新取一次
      const cvs2 = wallCanvases.get(item.key)
      if (!img || !cvs2) return
      const preview = specFromRecipe(createDefaultSpec(), item.recipe)
      const { W, H } = computeCanvasSize(preview.aspect, img)
      const scale = 0.34 * Math.min(2, window.devicePixelRatio || 1)
      cvs2.width = Math.round(W * scale)
      cvs2.height = Math.round(H * scale)
      const ctx = cvs2.getContext('2d')
      if (!ctx) return
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      const layout = layoutMeme(ctx, preview, W, H)
      drawMeme(ctx, layout, preview, img)
    }),
  )
}

function applyWall(item: { recipe: MemeRecipe; image: ImageItem }) {
  lastPicked.value = item.image
  activeBaseId.value = item.image.id
  applyRecipe(item.recipe, true)
  loadBase(picFrom(item.image), item.image.title || '站内图片', 'site')
  showToast('已换到你的画布 —— 改两个字就是你的了')
}

watch(wallItems, () => {
  void nextTick().then(drawWall)
})

// ────────────────────────────── 投稿到站内 ──────────────────────────────

/**
 * 闭环：工坊做出来的图，走既有的上传接口进站内的审核流
 * （POST /api/upload，jpeg/png/webp ≤ 10MB，落库为 pending，管理员通过后才公开）。
 * 这里不新增任何后端能力，只把「做图」和「看图」接起来。
 */
const showSubmit = ref(false)
const submitting = ref(false)
const submitDone = ref(false)
const submitPreview = ref('')
const submitProgress = ref(0)
const categories = ref<Array<{ id: string; name: string; slug: string }>>([])
const submitForm = reactive({ title: '', description: '', categoryIds: [] as string[] })

function defaultTitle(): string {
  const first =
    spec.value.texts.find((t) => t.role === 'free' && t.content.trim())?.content ||
    spec.value.texts.find((t) => t.role === 'top' && t.content.trim())?.content ||
    spec.value.texts.find((t) => t.role === 'bottom' && t.content.trim())?.content ||
    ''
  const line = first.split('\n')[0].trim().slice(0, 18)
  return line ? line + ' · 表情包' : '我的奶龙表情包'
}

function defaultDescription(): string {
  const from =
    baseMeta.value.origin === 'site' && baseMeta.value.label
      ? '，底图取自站内《' + baseMeta.value.label + '》'
      : ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nailonghub.top'
  return '用奶龙表情包工坊做的' + from + '。工坊：' + origin + '/studio'
}

async function loadCategories() {
  if (categories.value.length) return
  try {
    const r = await getCategories()
    categories.value = r.data.data ?? []
  } catch {
    categories.value = []
  }
}

function openSubmit() {
  pickerOpen.value = false
  if (!authStore.isLoggedIn) {
    showToast('投稿需要先登录，正在带你过去…')
    window.setTimeout(() => router.push({ path: '/login', query: { redirect: '/studio' } }), 500)
    return
  }
  submitDone.value = false
  submitting.value = false
  submitProgress.value = 0
  submitForm.title = defaultTitle()
  submitForm.description = defaultDescription()
  submitForm.categoryIds = []
  const { W, H } = fit.value
  submitPreview.value = renderToCanvas(spec.value, baseImg.value, W, H, 260 / W).toDataURL('image/jpeg', 0.72)
  void loadCategories()
  showSubmit.value = true
}

function toggleCategory(id: string) {
  const i = submitForm.categoryIds.indexOf(id)
  if (i >= 0) submitForm.categoryIds.splice(i, 1)
  else submitForm.categoryIds.push(id)
}

/**
 * 逐步降级地造出上传文件：导出倍率 PNG → 1x PNG → 1x JPEG。
 * 站内接口上限 10MB，照片类底图在 2x PNG 下有可能顶到上限，所以必须有兜底。
 */
async function buildUploadFile(): Promise<File | null> {
  const { W, H } = fit.value
  const plan: Array<{ scale: number; type: string; quality?: number; ext: string }> = [
    { scale: Math.max(1, Math.min(3, exportScale.value)), type: 'image/png', ext: 'png' },
    { scale: 1, type: 'image/png', ext: 'png' },
    { scale: 1, type: 'image/jpeg', quality: 0.9, ext: 'jpg' },
  ]
  for (const p of plan) {
    const canvas = renderToCanvas(spec.value, baseImg.value, W, H, p.scale)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, p.type, p.quality))
    if (blob && blob.size <= 9.5 * 1024 * 1024) {
      return new File([blob], 'nailong-meme-' + Date.now() + '.' + p.ext, { type: p.type })
    }
  }
  return null
}

async function submitWork() {
  if (submitting.value) return
  const title = submitForm.title.trim()
  if (!title) {
    showToast('先给这张图起个标题', 'warning')
    return
  }
  submitting.value = true
  submitProgress.value = 0
  try {
    const file = await buildUploadFile()
    if (!file) {
      showToast('这张图太大了，把导出倍率调到 1x 再试', 'warning')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    const desc = submitForm.description.trim()
    if (desc) fd.append('description', desc)
    if (submitForm.categoryIds.length) fd.append('categoryIds', JSON.stringify(submitForm.categoryIds))
    await uploadImage(fd, (percent) => {
      submitProgress.value = percent
    })
    submitProgress.value = 100
    submitDone.value = true
    saveWork()
    showToast('投稿成功，等管理员审核通过就会出现在站内', 'success')
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    showToast(msg || '投稿失败，稍后再试', 'error')
  } finally {
    submitting.value = false
  }
}

// ────────────────────────────── 杂项 ──────────────────────────────

const filterState = computed(() => spec.value.filter)

function setAspect(a: MemeAspect) {
  spec.value.aspect = a
}

function resetFilter() {
  filterState.value.preset = 'none'
  filterState.value.brightness = 1
  filterState.value.contrast = 1
  filterState.value.saturate = 1
}
</script>

<template>
  <div class="studio">
    <div class="studio-bg" aria-hidden="true">
      <span class="blob blob-butter" />
      <span class="blob blob-accent" />
      <span class="dot-field" />
    </div>

    <div class="n-container studio-shell">
      <!-- 顶栏 -->
      <header class="studio-head">
        <div class="studio-intro">
          <div class="studio-kicker">
            <span class="eyebrow">04 / Meme Studio</span>
            <span class="kicker-line" />
            <span class="kicker-tag">BETA</span>
          </div>
          <div class="studio-title-row">
            <span class="studio-stamp" aria-hidden="true">表</span>
            <h1 class="studio-title display">表情包工坊<span class="period">。</span></h1>
          </div>
          <p class="studio-lede">
            挑一张站内图，写两行字，贴个纸片、换个滤镜。三秒出片，全程在浏览器里完成 ——
            底图和成品都不会上传。
          </p>
          <div class="studio-meta">
            <span><AppIcon name="lock" :size="11" /> 不上传</span>
            <span><AppIcon name="sparkles" :size="11" /> 免登录</span>
            <span><AppIcon name="upload" :size="11" /> 可投稿</span>
          </div>
        </div>

        <div class="studio-actions">
          <div class="undo-group">
            <button class="s-btn s-btn-icon" :disabled="!canUndo" title="撤销（Ctrl/⌘ Z）" aria-label="撤销" @click="undo">
              <AppIcon name="undo" :size="16" />
            </button>
            <button class="s-btn s-btn-icon" :disabled="!canRedo" title="重做（Ctrl/⌘ Shift Z）" aria-label="重做" @click="redo">
              <AppIcon name="redo" :size="16" />
            </button>
          </div>
          <button class="s-btn s-btn-outline" @click="randomize">
            <AppIcon name="dice" :size="15" /> 给我灵感
          </button>
          <button class="s-btn s-btn-ghost" @click="resetAll">
            <AppIcon name="refresh" :size="15" /> 重来
          </button>
          <button class="s-btn s-btn-ghost optional-md" @click="copyToClipboard">
            <AppIcon name="copy" :size="15" /> 复制
          </button>
          <button class="s-btn s-btn-ghost" @click="share">
            <AppIcon name="share" :size="15" /> 分享
          </button>
          <button class="s-btn s-btn-outline" @click="openSubmit">
            <AppIcon name="upload" :size="15" /> 投稿
          </button>
          <button class="s-btn s-btn-primary" :disabled="busy" @click="download">
            <AppIcon name="download" :size="15" /> 下载 PNG
          </button>
          <button class="s-btn s-btn-icon s-btn-help" title="快捷键与小抄" aria-label="打开快捷键与小抄" @click="showHelp = true">
            ?
          </button>
        </div>
      </header>

      <div class="workbench">
        <!-- 左栏：底图与作品；移动端打开时 Teleport 到 body，避免被工作台的 stacking context 压住 -->
        <Teleport to="body" :disabled="!pickerOpen || !drawerMode">
        <aside
          class="panel rail-left"
          :class="{ 'is-open': pickerOpen }"
          :role="pickerOpen ? 'dialog' : undefined"
          :aria-modal="pickerOpen ? 'true' : undefined"
          aria-label="素材台"
        >
          <div class="panel-head">
            <div>
              <span class="eyebrow">01 / Material</span>
              <h2 class="panel-title display">素材台</h2>
            </div>
            <button class="s-btn s-btn-icon rail-close-btn" aria-label="关闭素材台" @click="pickerOpen = false">
              <AppIcon name="close" :size="16" />
            </button>
          </div>

          <div class="panel-body">
            <section class="rail-block">
              <div class="block-head">
                <span class="block-label">底图</span>
                <span class="block-count">{{ baseMeta.w ? baseMeta.w + '×' + baseMeta.h : '' }}</span>
              </div>

              <div class="base-card">
                <div class="base-thumb">
                  <img v-if="basePreview" :src="basePreview" alt="" />
                  <AppIcon v-else name="image" :size="20" />
                </div>
                <div class="base-info">
                  <p class="base-name">{{ baseMeta.label }}</p>
                  <p class="base-dim">
                    {{ baseMeta.w ? baseMeta.w + ' × ' + baseMeta.h + ' px' : baseMeta.origin === 'none' ? '还没选底图' : '正在读图…' }}
                  </p>
                </div>
              </div>

              <div class="rail-btn-row">
                <button class="s-btn s-btn-outline s-btn-sm" @click="fileInput?.click()">
                  <AppIcon name="folder" :size="14" /> 本地图片
                </button>
                <button class="s-btn s-btn-outline s-btn-sm" @click="randomFromGallery()">
                  <AppIcon name="dice" :size="14" /> 随机一张
                </button>
              </div>
              <input ref="fileInput" class="sr-only" type="file" accept="image/*" @change="onFileChange" />

              <div
                class="check-row"
                :class="{ 'is-disabled': baseMeta.origin !== 'site' || !lastPicked }"
              >
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="useOriginal"
                  :disabled="baseMeta.origin !== 'site' || !lastPicked"
                  class="check-box"
                  :class="{ 'is-on': useOriginal }"
                  @click="useOriginal = !useOriginal"
                >
                  <AppIcon v-if="useOriginal" name="check" :size="10" :stroke-width="2.6" />
                </button>
                <span @click="baseMeta.origin === 'site' && lastPicked && (useOriginal = !useOriginal)">
                  站内图用原图 <span class="muted-text">（更清晰，费流量）</span>
                </span>
              </div>
            </section>

            <section class="rail-block grow">
              <div class="block-head">
                <span class="block-label">站内图库</span>
                <span class="block-count">{{ galleryTotal ? '共 ' + galleryTotal + ' 张' : '' }}</span>
              </div>

              <div class="gallery-search">
                <AppIcon name="search" :size="14" />
                <input v-model="gallerySearch" type="search" placeholder="搜标题或标签…" aria-label="搜索站内图库" />
                <button v-if="gallerySearch" class="search-clear" aria-label="清空搜索" @click="gallerySearch = ''">
                  <AppIcon name="close" :size="12" />
                </button>
              </div>

              <div class="seg seg-compact">
                <button
                  v-for="s in GALLERY_SORTS"
                  :key="s.key"
                  class="seg-btn"
                  :class="{ 'is-on': gallerySort === s.key }"
                  :aria-pressed="gallerySort === s.key"
                  :disabled="s.key === 'featured' && !!gallerySearch.trim()"
                  :title="s.key === 'featured' && gallerySearch.trim() ? '搜索时按最新排序' : ''"
                  @click="gallerySort = s.key"
                >
                  {{ s.label }}
                </button>
              </div>

              <div v-if="galleryLoading" class="gallery-scroll">
                <div class="gallery-grid" aria-label="图库加载中">
                  <span v-for="n in 9" :key="n" class="gallery-cell skeleton" />
                </div>
              </div>
              <div v-else-if="galleryError" class="empty-note">
                <p>图库没拉到，可能是网络打了个喷嚏。</p>
                <button class="s-btn s-btn-outline s-btn-sm" @click="loadGallery(true)">重试</button>
              </div>
              <div v-else-if="!gallery.length" class="empty-note">
                <p>{{ gallerySearch ? '没有搜到图，换个词试试。' : '图库还空着，试试上传本地图片。' }}</p>
                <button class="s-btn s-btn-outline s-btn-sm" @click="gallerySearch = ''; gallerySort = 'latest'">看全部</button>
              </div>
              <div v-else class="gallery-scroll">
                <div class="gallery-grid">
                  <button
                    v-for="item in gallery"
                    :key="item.id"
                    class="gallery-cell"
                    :class="{ 'is-active': activeBaseId === item.id }"
                    :title="item.title"
                    @click="pickFromGallery(item)"
                  >
                    <img :src="thumbOf(item)" :alt="item.title" loading="lazy" />
                    <span v-if="activeBaseId === item.id" class="cell-check">
                      <AppIcon name="check" :size="10" :stroke-width="3" />
                    </span>
                  </button>
                </div>
              </div>

              <button
                v-if="galleryHasMore"
                class="s-btn s-btn-ghost s-btn-sm gallery-more"
                :disabled="galleryMoreLoading"
                @click="loadNextGalleryPage"
              >
                <span>{{ galleryMoreLoading ? '加载中…' : '再看一些' }}</span>
                <AppIcon v-if="!galleryMoreLoading" name="arrow-down" :size="13" />
              </button>
            </section>

            <section class="rail-block">
              <div class="block-head">
                <span class="block-label">我的作品</span>
                <span class="block-count">{{ works.length }}/9</span>
              </div>
              <p v-if="!works.length" class="empty-note-sm">导出的图会自动收在这里，只存在这台设备。</p>
              <div v-else class="works-grid">
                <div v-for="w in works" :key="w.id" class="work-cell" :title="'载入 ' + formatWorkDate(w.createdAt) + ' 的作品'">
                  <img :src="w.thumb" alt="我的作品" @click="restoreWork(w)" />
                  <button class="work-del" title="删除" aria-label="删除作品" @click.stop="deleteWork(w.id)">
                    <AppIcon name="close" :size="10" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div class="rail-mobile-foot">
            <button class="s-btn s-btn-primary s-btn-block" @click="pickerOpen = false">回到画布</button>
          </div>
        </aside>

        <Transition name="fade">
          <div v-if="pickerOpen" class="drawer-backdrop" aria-hidden="true" @click="pickerOpen = false" />
        </Transition>
        </Teleport>

        <!-- 中间：舞台 -->
        <section class="stage-panel" aria-label="画布与出片">
          <div class="stage-toolbar">
            <div class="seg aspect-seg">
              <button
                v-for="a in ASPECTS"
                :key="a.key"
                class="seg-btn"
                :class="{ 'is-on': spec.aspect === a.key }"
                :title="a.hint"
                :aria-pressed="spec.aspect === a.key"
                @click="setAspect(a.key)"
              >
                {{ a.label }}
              </button>
            </div>
            <button class="s-btn s-btn-outline s-btn-sm rail-open-btn" @click="pickerOpen = true">
              <AppIcon name="image" :size="14" /> 素材
            </button>
            <span class="stage-hint">{{ hint }}</span>
          </div>

          <div
            ref="stageRef"
            class="stage-mat"
            :class="{ 'is-drop': dragOver }"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <span class="stage-tape stage-tape-l" aria-hidden="true" />
            <span class="stage-tape stage-tape-r" aria-hidden="true" />
            <canvas
              ref="canvasRef"
              class="stage-canvas"
              aria-label="表情包画布，点选文字或贴纸后可以拖动"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @wheel="onCanvasWheel"
            />
            <div v-if="dragOver" class="drop-overlay">
              <AppIcon name="image" :size="26" />
              <span>松手，就换成这张底图</span>
            </div>
          </div>

          <!-- 一键出片：配方是人工调好的成品，点一下就是一张可以直接发出去的图 -->
          <div class="recipe-strip">
            <div class="recipe-lead">
              <span class="eyebrow">一键出片</span>
              <span class="recipe-lead-note">调好的配方</span>
            </div>
            <div class="recipe-scroll">
              <button v-for="r in MEME_RECIPES" :key="r.id" class="recipe-btn" :title="r.desc" @click="applyRecipe(r)">
                <span>{{ r.emoji }}</span>
                <span>{{ r.name }}</span>
              </button>
            </div>
          </div>

          <div class="stage-foot">
            <div v-if="selected" class="quick-bar" role="toolbar" aria-label="选中项快捷操作">
              <span class="quick-label">{{ selectedLabel }}</span>
              <button class="q-btn" title="缩小（[）" @click="bumpSize(-6)">A−</button>
              <button class="q-btn" title="放大（]）" @click="bumpSize(6)">A＋</button>
              <button v-if="selected.kind === 'text'" class="q-btn" @click="resetPosition">复位</button>
              <button v-if="selected.kind === 'sticker'" class="q-btn" @click="duplicateSticker(selected.id)">复制</button>
              <button v-if="selected.kind === 'sticker'" class="q-btn q-danger" @click="removeSticker(selected.id)">删除</button>
              <button class="q-btn q-done" @click="selected = null">完成</button>
            </div>
            <div v-else class="stage-foot-left">
              <span class="status-dot" />
              <span>{{ fit.W }} × {{ fit.H }} · 导出 {{ exportScale }}x</span>
              <span class="foot-sep">/</span>
              <span class="draft-state"><AppIcon name="save" :size="11" /> {{ draftStatus }}</span>
            </div>
            <div class="stage-foot-right">
              <span class="foot-label">导出倍率</span>
              <div class="seg seg-tiny">
                <button
                  v-for="s in [1, 2, 3]"
                  :key="s"
                  class="seg-btn"
                  :class="{ 'is-on': exportScale === s }"
                  @click="exportScale = s"
                >
                  {{ s }}x
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 右栏：控制台 -->
        <aside class="panel rail-right">
          <div class="panel-head">
            <div>
              <span class="eyebrow">02 / Controls</span>
              <h2 class="panel-title display">控制台</h2>
            </div>
            <button class="s-btn s-btn-icon s-btn-help" title="快捷键与小抄" aria-label="打开快捷键与小抄" @click="showHelp = true">
              ?
            </button>
          </div>

          <div v-if="selected" class="selection-card rail-focus">
            <div class="selection-head">
              <div>
                <span class="eyebrow">Selected</span>
                <p class="selection-title">{{ selectedLabel }}</p>
              </div>
              <button class="icon-mini" aria-label="取消选中" @click="selected = null">
                <AppIcon name="close" :size="14" />
              </button>
            </div>

            <template v-for="t in focusedTexts" :key="t.id">
              <div class="field">
                <div class="field-head">
                  <span class="field-label">文案</span>
                  <span class="field-val">{{ t.content.length }}/60</span>
                </div>
                <textarea v-model="t.content" class="selection-input" rows="2" maxlength="60" placeholder="改这一句…" />
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">字号</span>
                  <span class="field-val">{{ t.size }}</span>
                </div>
                <input v-model.number="t.size" class="range" type="range" min="30" max="220" step="2" aria-label="文字字号" />
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">旋转</span>
                  <span class="field-val">{{ t.rotation }}°</span>
                </div>
                <input v-model.number="t.rotation" class="range" type="range" min="-30" max="30" step="1" aria-label="文字旋转" />
              </div>
              <div class="field">
                <div class="field-head"><span class="field-label">颜色</span></div>
                <div class="swatches">
                  <button
                    v-for="c in SWATCHES"
                    :key="c"
                    class="swatch"
                    :class="{ 'is-on': t.color.toLowerCase() === c.toLowerCase() }"
                    :style="{ background: c }"
                    :aria-label="'文字颜色 ' + c"
                    :aria-pressed="t.color.toLowerCase() === c.toLowerCase()"
                    @click="t.color = c"
                  />
                  <label class="color-pick" title="自定义颜色">
                    <input type="color" :value="t.color" aria-label="自定义文字颜色" @input="onTextColor($event, t)" />
                    <AppIcon name="palette" :size="13" />
                  </label>
                </div>
              </div>
              <div class="field">
                <div class="field-head"><span class="field-label">字体</span></div>
                <div class="font-grid">
                  <button
                    v-for="f in FONT_KEYS"
                    :key="f"
                    class="chip font-chip"
                    :class="{ 'is-on': (t.font ?? 'bold') === f }"
                    :style="{ fontFamily: FONT_STACKS[f].family, fontWeight: FONT_STACKS[f].weight }"
                    :aria-pressed="(t.font ?? 'bold') === f"
                    @click="t.font = f"
                  >
                    {{ FONT_STACKS[f].label }}
                  </button>
                </div>
              </div>
              <div class="field">
                <div class="field-head"><span class="field-label">对齐</span></div>
                <div class="seg seg-tiny align-seg">
                  <button
                    v-for="a in ALIGNS"
                    :key="a.key"
                    class="seg-btn"
                    :class="{ 'is-on': t.align === a.key }"
                    :aria-pressed="t.align === a.key"
                    @click="t.align = a.key"
                  >
                    {{ a.label }}
                  </button>
                </div>
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">描边</span>
                  <button class="toggle" :class="{ 'is-on': t.stroke }" :aria-pressed="t.stroke" @click="t.stroke = !t.stroke">
                    {{ t.stroke ? '经典黑边' : '无描边' }}
                  </button>
                </div>
                <div v-if="t.stroke" class="swatches">
                  <button
                    v-for="c in STROKE_COLORS"
                    :key="c"
                    class="swatch"
                    :class="{ 'is-on': (t.strokeColor || STROKE_COLORS[0]) === c }"
                    :style="{ background: c }"
                    :aria-label="'描边颜色 ' + c"
                    :aria-pressed="(t.strokeColor || STROKE_COLORS[0]) === c"
                    @click="t.strokeColor = c"
                  />
                  <label class="color-pick" title="自定义描边色">
                    <input type="color" :value="t.strokeColor || STROKE_COLORS[0]" aria-label="自定义描边颜色" @input="onStrokeColor($event, t)" />
                    <AppIcon name="palette" :size="13" />
                  </label>
                </div>
              </div>
              <div class="selection-actions">
                <button class="s-btn s-btn-outline s-btn-xs" @click="resetPosition">复位位置</button>
                <button class="s-btn s-btn-ghost s-btn-xs" @click="t.content = ''">清空文字</button>
              </div>
            </template>

            <template v-for="s in focusedStickers" :key="s.id">
              <div class="field">
                <div class="field-head">
                  <span class="field-label">大小</span>
                  <span class="field-val">{{ s.size }}</span>
                </div>
                <input v-model.number="s.size" class="range" type="range" min="40" max="420" step="4" aria-label="贴纸大小" />
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">旋转</span>
                  <span class="field-val">{{ s.rotation }}°</span>
                </div>
                <input v-model.number="s.rotation" class="range" type="range" min="-180" max="180" step="1" aria-label="贴纸旋转" />
              </div>
              <div class="selection-actions">
                <button class="s-btn s-btn-outline s-btn-xs" @click="duplicateSticker(s.id)">复制一个</button>
                <button class="s-btn s-btn-danger s-btn-xs" @click="removeSticker(s.id)">删掉</button>
              </div>
            </template>
          </div>

          <div class="tabs" role="tablist" aria-label="工坊控制">
            <button
              v-for="tab in PANEL_TABS"
              :key="tab.key"
              class="tab"
              :class="{ 'is-active': panelTab === tab.key }"
              role="tab"
              :aria-selected="panelTab === tab.key"
              @click="panelTab = tab.key"
            >
              <AppIcon :name="tab.icon" :size="15" />
              <span>{{ tab.label }}</span>
            </button>
          </div>

          <div class="panel-body tab-body">
            <section v-if="panelTab === 'layout'" class="tab-pane" role="tabpanel">
              <div class="block-head">
                <span class="block-label">版式</span>
                <span class="block-count">{{ TEMPLATES.length }} 套</span>
              </div>
              <div class="tpl-grid">
                <button
                  v-for="t in TEMPLATES"
                  :key="t.key"
                  class="tpl-btn"
                  :class="{ 'is-on': spec.template === t.key }"
                  :title="t.desc"
                  @click="selectTemplate(t.key)"
                >
                  <span class="tpl-emoji">{{ t.emoji }}</span>
                  <span class="tpl-name">{{ t.name }}</span>
                </button>
              </div>
              <div class="hint-card">换版式不会丢掉已经写好的字；按 <kbd>1</kbd>~<kbd>7</kbd> 也能直接切。</div>
            </section>

            <section v-else-if="panelTab === 'copy'" class="tab-pane" role="tabpanel">
              <div class="block-head">
                <span class="block-label">文案</span>
                <button class="s-btn s-btn-ghost s-btn-xs" @click="shuffleAllCopy">
                  <AppIcon name="dice" :size="13" /> 整段换一换
                </button>
              </div>
              <div class="mood-row">
                <button class="chip" :class="{ 'is-on': mood === 'all' }" @click="mood = 'all'">全部</button>
                <button
                  v-for="m in MOODS"
                  :key="m.key"
                  class="chip"
                  :class="{ 'is-on': mood === m.key }"
                  @click="mood = m.key"
                >
                  {{ m.emoji }} {{ m.label }}
                </button>
              </div>
              <div v-for="row in copyRows" :key="row.role" class="copy-row">
                <div class="copy-head">
                  <span class="copy-label">{{ row.label }}</span>
                  <button class="s-btn s-btn-ghost s-btn-xs" @click="fillCopy(row.role)">
                    <AppIcon name="dice" :size="12" /> 换一条
                  </button>
                </div>
                <textarea
                  v-model="row.block.content"
                  class="copy-input"
                  rows="2"
                  maxlength="60"
                  :placeholder="row.role === 'free' ? '想说什么？' : '一句话就好'"
                />
                <span class="counter">{{ row.block.content.length }}/60</span>
              </div>
              <div class="hint-card">上句抛梗，下句接住；字越少，越像真的。</div>
            </section>

            <section v-else-if="panelTab === 'sticker'" class="tab-pane" role="tabpanel">
              <div class="block-head">
                <span class="block-label">贴纸</span>
                <span class="block-count">{{ ALL_STICKERS.length }} 个</span>
              </div>
              <div v-for="g in STICKER_GROUPS" :key="g.label" class="sticker-group">
                <span class="sticker-label">{{ g.label }}</span>
                <div class="sticker-row">
                  <button
                    v-for="e in g.items"
                    :key="e"
                    class="sticker-btn"
                    :aria-label="'添加贴纸 ' + e"
                    @click="addSticker(e)"
                  >
                    {{ e }}
                  </button>
                </div>
              </div>
              <div class="hint-card">选中贴纸后，滚轮可以缩放；方向键微调，<kbd>Delete</kbd> 删掉。</div>
            </section>

            <section v-else class="tab-pane" role="tabpanel">
              <div class="block-head">
                <span class="block-label">滤镜</span>
                <button class="s-btn s-btn-ghost s-btn-xs" @click="resetFilter">重置</button>
              </div>
              <div class="mood-row">
                <button
                  v-for="p in FILTER_PRESETS"
                  :key="p.key"
                  class="chip"
                  :class="{ 'is-on': filterState.preset === p.key }"
                  @click="filterState.preset = p.key"
                >
                  {{ p.label }}
                </button>
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">亮度</span>
                  <span class="field-val">{{ filterState.brightness.toFixed(2) }}</span>
                </div>
                <input v-model.number="filterState.brightness" class="range" type="range" min="0.6" max="1.5" step="0.01" />
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">对比</span>
                  <span class="field-val">{{ filterState.contrast.toFixed(2) }}</span>
                </div>
                <input v-model.number="filterState.contrast" class="range" type="range" min="0.6" max="1.6" step="0.01" />
              </div>
              <div class="field">
                <div class="field-head">
                  <span class="field-label">饱和</span>
                  <span class="field-val">{{ filterState.saturate.toFixed(2) }}</span>
                </div>
                <input v-model.number="filterState.saturate" class="range" type="range" min="0" max="2" step="0.01" />
              </div>
              <div class="hint-card">「胶片」和「暖调」最配奶龙；黑白适合做金句卡。</div>
            </section>
          </div>
        </aside>
      </div>

      <!-- 灵感墙：8 个配方 × 站内图，由引擎当场画出来 -->
      <section class="wall" aria-labelledby="wall-title">
        <div class="wall-head">
          <div>
            <p class="eyebrow">03 / Recipes</p>
            <h2 id="wall-title" class="wall-title display">看看能做出什么<span class="period">。</span></h2>
          </div>
          <p class="wall-sub">
            下面每一张都是工坊<strong>实时</strong>画出来的：配方 × 站内图库。看中哪张就点一下 ——
            它会整个换到你的画布上，改两个字就是你的了。
          </p>
        </div>
        <div v-if="!wallItems.length" class="wall-empty">图库加载完就会出现（如果一直空着，检查一下网络）。</div>
        <div v-else class="wall-grid">
          <button
            v-for="(item, i) in wallItems"
            :key="item.key"
            class="wall-card"
            :title="item.recipe.name + '：' + item.recipe.desc"
            @click="applyWall(item)"
          >
            <span class="wall-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="wall-canvas-wrap">
              <canvas :ref="(el: unknown) => setWallCanvas(el, item.key)" class="wall-canvas" />
            </span>
            <span class="wall-meta">
              <span class="wall-name">{{ item.recipe.emoji }} {{ item.recipe.name }}</span>
              <span class="wall-from">底图 · {{ item.image.title }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <!-- 小抄 -->
    <UiModal v-model="showHelp" title="工坊小抄" width="780px">
      <template #subtitle>
        <p class="eyebrow">Keyboard & tips</p>
      </template>
      <div class="help-grid">
        <section>
          <h3 class="help-title">快捷键</h3>
          <ul class="help-list">
            <li><span>撤销 / 重做</span><span><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Shift</kbd>+<kbd>Ctrl</kbd>+<kbd>Z</kbd></span></li>
            <li><span>下载 PNG</span><span><kbd>Ctrl</kbd>+<kbd>S</kbd></span></li>
            <li><span>一键灵感</span><span><kbd>Ctrl</kbd>+<kbd>D</kbd></span></li>
            <li><span>切换版式</span><span><kbd>1</kbd> ~ <kbd>7</kbd></span></li>
            <li><span>微调选中项</span><span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>Shift</kbd> 大步</span></li>
            <li><span>字号 - / +</span><span><kbd>[</kbd> / <kbd>]</kbd></span></li>
            <li><span>取消选中</span><span><kbd>Esc</kbd></span></li>
            <li><span>删除贴纸</span><span><kbd>Delete</kbd></span></li>
            <li><span>打开小抄</span><span><kbd>?</kbd></span></li>
          </ul>
        </section>
        <section>
          <h3 class="help-title">小技巧</h3>
          <ul class="tip-list">
            <li>直接<b>拖</b>画布上的文字和贴纸；点一下就能选中。</li>
            <li>选中贴纸后，鼠标<b>滚轮</b>可以缩放。</li>
            <li>站内图库可以用标题或标签<b>搜索</b>，也能继续加载更多。</li>
            <li>本地图片可以直接<b>拖进画布</b>，不会上传到服务器。</li>
            <li>大图会自动缩到 2000px 以内再进画布，导出仍然清晰。</li>
            <li>版式换来换去，写好的字不会丢；刷新也能接着改。</li>
            <li>草稿存在这台设备上；导出、复制、分享都会收进「我的作品」。</li>
          </ul>
        </section>
      </div>
      <div class="help-foot">
        <button class="s-btn s-btn-primary" @click="showHelp = false">知道了</button>
      </div>
    </UiModal>

    <!-- 投稿弹窗 -->
    <UiModal v-model="showSubmit" title="投稿到站内图库" width="900px" :closable="!submitting">
      <template #subtitle>
        <p class="eyebrow">经审核后公开</p>
      </template>

      <template v-if="!submitDone">
        <div class="submit-grid">
          <div class="submit-preview-wrap">
            <img v-if="submitPreview" :src="submitPreview" class="submit-preview" alt="投稿预览" />
          </div>
          <div class="submit-fields">
            <label class="field-label" for="submit-title">标题</label>
            <input id="submit-title" v-model="submitForm.title" class="s-input" maxlength="255" placeholder="给这张图起个名字" />

            <label class="field-label" for="submit-desc">描述</label>
            <textarea
              id="submit-desc"
              v-model="submitForm.description"
              class="s-input s-textarea"
              rows="3"
              maxlength="500"
              placeholder="说明一下这张图（可留空）"
            />

            <div class="field-label">分类 <span class="muted-text">（可多选，也可以不选）</span></div>
            <div v-if="categories.length" class="mood-row">
              <button
                v-for="c in categories"
                :key="c.id"
                class="chip"
                :class="{ 'is-on': submitForm.categoryIds.includes(c.id) }"
                :aria-pressed="submitForm.categoryIds.includes(c.id)"
                @click="toggleCategory(c.id)"
              >
                {{ c.name }}
              </button>
            </div>
            <p v-else class="empty-note-sm">分类加载中…</p>

            <div class="submit-note">
              <AppIcon name="info" :size="14" />
              <p>
                投稿会进入站内<b>审核队列</b>，管理员通过后才对所有人可见。
                图片会按可用的最高清晰度提交，必要时自动压到 10MB 以内。
              </p>
            </div>

            <div v-if="submitting" class="progress" aria-hidden="true">
              <span :style="{ width: submitProgress + '%' }" />
            </div>
          </div>
        </div>
        <div class="modal-foot submit-foot">
          <button class="s-btn s-btn-ghost" :disabled="submitting" @click="showSubmit = false">先不投</button>
          <button class="s-btn s-btn-primary" :disabled="submitting" @click="submitWork">
            {{ submitting ? (submitProgress ? '上传中 ' + submitProgress + '%' : '准备中…') : '确认投稿' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="submit-done">
          <span class="done-stamp"><AppIcon name="check" :size="26" :stroke-width="2.4" /></span>
          <h3 class="display">已经进审核队列了</h3>
          <p>管理员通过后，它会出现在站内图库里。到时候可以到个人主页看状态。</p>
          <div class="modal-foot center">
            <button class="s-btn s-btn-outline" @click="showSubmit = false">继续做图</button>
            <button class="s-btn s-btn-primary" @click="router.push('/profile')">去个人主页</button>
          </div>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<style scoped>
/* ─────────────────────────────────────────────────────────────
   表情包工坊 · 站点纸感风格
   所有颜色都走 style.css 里的 token，浅色/深色自动跟随。
   ───────────────────────────────────────────────────────────── */

.studio {
  position: relative;
  isolation: isolate;
  overflow: clip;
  background: var(--paper);
  color: var(--ink);
  padding: clamp(18px, 3vw, 34px) 0 70px;
}

.studio-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.studio-bg .dot-field {
  position: absolute;
  inset: 0;
  opacity: 0.38;
}
.blob {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.55;
}
.blob-butter {
  top: -180px;
  right: -90px;
  width: 560px;
  height: 440px;
  background: color-mix(in srgb, var(--butter) 42%, transparent);
}
.blob-accent {
  bottom: -140px;
  left: -140px;
  width: 460px;
  height: 380px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.studio-shell {
  position: relative;
  z-index: 1;
}

/* ── 顶栏 ── */

.studio-head {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}
.studio-intro {
  max-width: 700px;
  min-width: 0;
}
.studio-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 11px;
}
.kicker-line {
  width: 34px;
  height: 1px;
  background: var(--line-strong);
}
.kicker-tag {
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  border-radius: 4px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.18em;
}
.studio-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.studio-stamp {
  display: grid;
  place-items: center;
  flex: none;
  width: 52px;
  height: 52px;
  border: 1.5px solid #181510;
  border-radius: 13px;
  background: var(--butter);
  box-shadow: 3px 3px 0 #181510;
  color: #181510;
  font-family: var(--font-display);
  font-size: 31px;
  line-height: 1;
  transform: rotate(-5deg);
}
.studio-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(38px, 5vw, 58px);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.period {
  color: var(--accent);
}
.studio-lede {
  max-width: 590px;
  margin: 14px 0 0;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.8;
  text-wrap: pretty;
}
.studio-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 13px;
}
.studio-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
}

.studio-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

/* ── 按钮 ── */

.s-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: 1.5px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.22s var(--ease-spring),
    background 0.2s var(--ease-out-expo),
    color 0.2s var(--ease-out-expo),
    border-color 0.2s var(--ease-out-expo),
    box-shadow 0.2s var(--ease-out-expo);
}
.s-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.s-btn:active:not(:disabled) {
  transform: scale(0.97) translateY(1px);
}
.s-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.s-btn-primary {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}
.s-btn-primary:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--accent) 72%, transparent);
}
.s-btn-outline {
  border-color: var(--line-strong);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  color: var(--ink);
}
.s-btn-outline:hover:not(:disabled) {
  border-color: var(--ink);
  background: var(--surface);
}
.s-btn-ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink);
}
.s-btn-icon {
  width: 38px;
  padding: 0;
}
.s-btn-sm {
  height: 32px;
  padding: 0 10px;
  font-size: 11.5px;
}
.s-btn-xs {
  height: 28px;
  padding: 0 9px;
  font-size: 11px;
}
.s-btn-danger {
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  color: var(--accent);
}
.s-btn-danger:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
}
.s-btn-help {
  border-color: var(--line);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 14px;
}
.s-btn-help:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}
.s-btn-block {
  width: 100%;
}
.undo-group {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
}
.undo-group .s-btn {
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
}
.undo-group .s-btn:hover:not(:disabled) {
  background: var(--surface-2);
}
.optional-md {
  display: none;
}

/* ── 三栏骨架 ── */

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.panel {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--line);
}
.panel-title {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
  color: var(--ink);
}
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 16px 16px;
}
.rail-left {
  display: none;
}
.rail-right {
  display: flex;
  flex-direction: column;
}

/* ── 左栏内容 ── */

.rail-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.rail-block + .rail-block {
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}
.rail-block.grow {
  min-height: 0;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.block-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.block-count {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.muted-text {
  color: var(--muted);
  font-weight: 400;
}

.base-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
}
.base-thumb {
  display: grid;
  place-items: center;
  flex: none;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--muted);
}
.base-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.base-info {
  min-width: 0;
}
.base-name {
  margin: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.base-dim {
  margin: 2px 0 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.rail-btn-row {
  display: flex;
  gap: 6px;
}
.rail-btn-row .s-btn {
  flex: 1;
  min-width: 0;
  padding-inline: 6px;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}
.check-row:not(.is-disabled) {
  color: var(--ink-2);
}
.check-row.is-disabled {
  opacity: 0.5;
  cursor: default;
}
.check-row.is-disabled .check-box {
  cursor: not-allowed;
}
.check-box {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--paper);
  color: var(--paper);
  transition: background 0.18s ease, border-color 0.18s ease;
}
.check-box.is-on {
  border-color: var(--ink);
  background: var(--ink);
}

/* 图库搜索 / 排序 */

.gallery-search {
  position: relative;
}
.gallery-search > svg {
  position: absolute;
  top: 50%;
  left: 10px;
  color: var(--muted);
  transform: translateY(-50%);
  pointer-events: none;
}
.gallery-search input {
  width: 100%;
  height: 36px;
  padding: 0 30px 0 32px;
  border: 1px solid var(--line);
  border-radius: 999px;
  outline: none;
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.gallery-search input::placeholder {
  color: var(--muted);
}
.gallery-search input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}
.search-clear {
  position: absolute;
  top: 50%;
  right: 6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  color: var(--muted);
  transform: translateY(-50%);
}
.search-clear:hover {
  background: var(--surface-2);
  color: var(--ink);
}

/* 分段控件 */

.seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
}
.seg-btn {
  height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease;
}
.seg-btn:hover:not(:disabled) {
  color: var(--ink);
}
.seg-btn.is-on {
  background: var(--ink);
  color: var(--paper);
  font-weight: 600;
}
.seg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.seg-compact {
  width: 100%;
}
.seg-compact .seg-btn {
  flex: 1;
}
.seg-tiny {
  padding: 1px;
}
.seg-tiny .seg-btn {
  height: 24px;
  padding: 0 7px;
  font-size: 10.5px;
}

/* 图库 */

.gallery-scroll {
  max-height: 292px;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.gallery-cell {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
}
.gallery-cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s var(--ease-out-expo);
}
.gallery-cell:hover img {
  transform: scale(1.06);
}
.gallery-cell:hover {
  border-color: var(--line-strong);
}
.gallery-cell.is-active {
  border-color: transparent;
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.cell-check {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
}
.skeleton {
  border-color: transparent;
  background: linear-gradient(100deg, var(--surface-2) 20%, var(--paper) 50%, var(--surface-2) 80%);
  background-size: 200% 100%;
  animation: studio-shimmer 1.4s linear infinite;
}
@keyframes studio-shimmer {
  to {
    background-position: -200% 0;
  }
}
.empty-note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
  background: var(--paper);
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}
.empty-note p {
  margin: 0;
}
.empty-note-sm {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.65;
}
.gallery-more {
  width: 100%;
  border: 1px dashed var(--line-strong);
}

/* 我的作品 */

.works-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.work-cell {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
}
.work-cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s var(--ease-out-expo);
}
.work-cell:hover img {
  transform: scale(1.05);
}
.work-del {
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 74%, transparent);
  color: var(--paper);
  opacity: 0.62;
  transition: opacity 0.2s ease;
}
.work-cell:hover .work-del,
.work-del:focus-visible {
  opacity: 1;
}

/* ── 舞台 ── */

.stage-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-2);
}
.stage-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.stage-hint {
  margin-left: auto;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.05em;
}
.rail-open-btn {
  display: inline-flex;
}

.stage-mat {
  position: relative;
  display: grid;
  place-items: center;
  height: clamp(380px, calc(100dvh - 420px), 680px);
  min-height: 340px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background-color: var(--paper-deep);
  background-image: radial-gradient(color-mix(in srgb, var(--ink) 10%, transparent) 0.8px, transparent 0.8px);
  background-size: 14px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.stage-mat.is-drop {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}
.stage-tape {
  position: absolute;
  top: -8px;
  z-index: 2;
  width: 70px;
  height: 18px;
  border-left: 1px dashed color-mix(in srgb, var(--ink) 18%, transparent);
  border-right: 1px dashed color-mix(in srgb, var(--ink) 18%, transparent);
  background: color-mix(in srgb, var(--butter) 62%, transparent);
  opacity: 0.82;
  pointer-events: none;
}
.stage-tape-l {
  left: 10%;
  transform: rotate(-2deg);
}
.stage-tape-r {
  right: 10%;
  transform: rotate(2deg);
}
.stage-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  border-radius: 3px;
  box-shadow: var(--shadow-hard-sm), 0 20px 44px -28px rgba(20, 15, 8, 0.6);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.stage-canvas:active {
  cursor: grabbing;
}
.drop-overlay {
  position: absolute;
  inset: 10px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--accent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(2px);
}

/* 一键出片 */

.recipe-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 9px;
  border-top: 1px dashed var(--line);
}
.recipe-lead {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: none;
}
.recipe-lead .eyebrow {
  color: var(--accent);
}
.recipe-lead-note {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
}
.recipe-scroll {
  display: flex;
  gap: 5px;
  padding-bottom: 2px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.recipe-btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 11px;
  white-space: nowrap;
  transition:
    transform 0.18s var(--ease-spring),
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}
.recipe-btn:hover {
  transform: translateY(-2px);
  border-color: var(--ink);
  color: var(--ink);
  box-shadow: var(--shadow-hard-sm);
}
.recipe-btn:active {
  transform: translateY(0) scale(0.98);
}
.recipe-btn span:first-child {
  font-size: 13px;
}

/* 舞台底栏 */

.stage-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  padding: 0 2px;
}
.stage-foot-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--jade);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--jade) 18%, transparent);
}
.foot-sep {
  color: var(--line-strong);
}
.draft-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.stage-foot-right {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.foot-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
}
.quick-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
}
.quick-label {
  padding: 0 6px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
}
.q-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  color: var(--ink-2);
  font-size: 10.5px;
}
.q-btn:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.q-danger {
  color: var(--accent);
}
.q-done {
  background: var(--ink);
  color: var(--paper);
}
.q-done:hover {
  background: var(--accent);
  color: var(--accent-ink);
}

/* ── 右栏：标签页 / 控件 ── */

.tabs {
  display: flex;
  gap: 2px;
  padding: 8px 10px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  scrollbar-width: none;
}
.tab {
  display: inline-flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 62px;
  height: 44px;
  border-radius: 10px;
  color: var(--muted);
  font-size: 10.5px;
  transition: background 0.18s ease, color 0.18s ease;
}
.tab:hover {
  background: var(--paper);
  color: var(--ink);
}
.tab.is-active {
  background: var(--ink);
  color: var(--paper);
}
.tab-body {
  padding-top: 14px;
}
.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 选中项卡片 */

.selection-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 12px 0;
  padding: 12px;
  border: 1.5px solid var(--ink);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-hard-sm);
}
.selection-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.selection-title {
  margin: 3px 0 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
  line-height: 1;
}
.icon-mini {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: var(--muted);
}
.icon-mini:hover {
  background: var(--paper);
  color: var(--ink);
}
.selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.field-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.field-val {
  color: var(--ink-2);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.range {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  outline: none;
  background: var(--line);
  appearance: none;
}
.range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid var(--surface);
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  cursor: pointer;
  appearance: none;
}
.range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid var(--surface);
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  cursor: pointer;
}
.range:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 24px;
  height: 24px;
  border: 2px solid var(--surface);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--line-strong);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.swatch:hover {
  transform: scale(1.1);
}
.swatch.is-on {
  box-shadow: 0 0 0 2px var(--accent);
  transform: scale(1.06);
}
.color-pick {
  position: relative;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  overflow: hidden;
  border: 1px dashed var(--line-strong);
  border-radius: 999px;
  color: var(--muted);
  cursor: pointer;
}
.color-pick input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.color-pick:hover {
  border-color: var(--ink);
  color: var(--ink);
}
.font-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.font-chip {
  min-height: 28px;
  padding: 0 9px;
  font-size: 12px;
}
.align-seg {
  width: 100%;
}
.align-seg .seg-btn {
  flex: 1;
}
.toggle {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 10.5px;
}
.toggle.is-on {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}

/* 版式 */

.tpl-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}
.tpl-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink-2);
  font-size: 11.5px;
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}
.tpl-btn:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}
.tpl-btn.is-on {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}
.tpl-emoji {
  font-size: 14px;
}
.tpl-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文案 */

.mood-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 10.5px;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}
.chip:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}
.chip.is-on {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}
.copy-row {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.copy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.copy-label {
  color: var(--ink);
  font-size: 11.5px;
  font-weight: 600;
}
.copy-input {
  width: 100%;
  min-height: 58px;
  padding: 8px 10px 18px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  background: var(--paper);
  color: var(--ink);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.55;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.copy-input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}
.selection-input {
  width: 100%;
  min-height: 48px;
  padding: 8px 10px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  background: var(--paper);
  color: var(--ink);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.55;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.selection-input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}
.counter {
  position: absolute;
  right: 8px;
  bottom: 5px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* 贴纸 */

.sticker-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sticker-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.sticker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.sticker-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 16px;
  transition: transform 0.15s var(--ease-spring), background 0.15s ease, border-color 0.15s ease;
}
.sticker-btn:hover {
  transform: translateY(-2px) scale(1.08);
  border-color: var(--line);
  background: var(--paper);
}

/* 提示卡 / kbd */

.hint-card {
  padding: 9px 10px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: var(--paper);
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.65;
}
kbd {
  display: inline-grid;
  place-items: center;
  min-width: 19px;
  height: 19px;
  padding: 0 4px;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 8.5px;
  line-height: 1;
}

/* ── 灵感墙 ── */

.wall {
  margin-top: 34px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}
.wall-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}
.wall-title {
  margin: 6px 0 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(30px, 3.4vw, 42px);
  font-weight: 400;
  line-height: 1;
}
.wall-sub {
  max-width: 560px;
  margin: 0;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.75;
  text-wrap: pretty;
}
.wall-sub strong {
  color: var(--accent);
}
.wall-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 6px 2px 4px;
}
.wall-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 9px 11px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  text-align: left;
  transition:
    transform 0.35s var(--ease-out-expo),
    box-shadow 0.35s var(--ease-out-expo),
    border-color 0.2s ease;
}
.wall-card:nth-child(4n + 1) {
  transform: rotate(-0.7deg);
}
.wall-card:nth-child(4n + 3) {
  transform: rotate(0.6deg);
}
.wall-card:hover {
  transform: translateY(-4px) rotate(0deg);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-soft);
}
.wall-card:nth-child(3n + 2)::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  width: 56px;
  height: 16px;
  border-left: 1px dashed color-mix(in srgb, var(--ink) 16%, transparent);
  border-right: 1px dashed color-mix(in srgb, var(--ink) 16%, transparent);
  background: color-mix(in srgb, var(--butter) 72%, transparent);
  transform: translateX(-50%) rotate(-2deg);
  pointer-events: none;
}
.wall-num {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
}
.wall-canvas-wrap {
  display: block;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--paper-deep);
}
.wall-canvas {
  display: block;
  width: 100%;
  height: auto;
}
.wall-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 2px;
}
.wall-name {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 400;
  line-height: 1.1;
}
.wall-from {
  overflow: hidden;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wall-empty {
  padding: 24px;
  border: 1px dashed var(--line);
  border-radius: 14px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

/* ── 小抄 ── */

.help-grid {
  display: grid;
  gap: 18px;
}
.help-title {
  margin: 0 0 8px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
}
.help-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.help-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 7px;
  border-bottom: 1px dashed var(--line);
  color: var(--ink-2);
  font-size: 11.5px;
}
.help-list li:last-child {
  border-bottom: 0;
}
.help-list li > span:last-child {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tip-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding-left: 16px;
  color: var(--ink-2);
  font-size: 11.5px;
  line-height: 1.65;
}
.tip-list b {
  color: var(--ink);
}
.help-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

/* ── 投稿弹窗 ── */

.submit-grid {
  display: grid;
  gap: 18px;
}
.submit-preview-wrap {
  align-self: start;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
}
.submit-preview {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}
@media (max-width: 767px) {
  .submit-preview-wrap {
    display: flex;
    justify-content: center;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
  }
  .submit-preview {
    width: auto;
    max-width: 100%;
    max-height: 240px;
  }
  .submit-foot {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin-top: 10px;
    padding: 10px 0 2px;
    background: var(--surface);
    box-shadow: 0 -10px 18px -14px rgba(20, 15, 8, 0.35);
  }
}
.submit-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.s-input {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: none;
  background: var(--paper);
  color: var(--ink);
  font-size: 12.5px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.s-input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}
.s-textarea {
  height: auto;
  min-height: 80px;
  padding: 9px 10px;
  resize: vertical;
  line-height: 1.6;
}
.submit-fields .field-label {
  margin-top: 6px;
}
.submit-note {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.65;
}
.submit-note p {
  margin: 0;
}
.submit-note svg {
  flex: none;
  margin-top: 2px;
  color: var(--accent);
}
.submit-note b {
  color: var(--ink);
}
.progress {
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--line);
}
.progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.modal-foot.center {
  justify-content: center;
}
.submit-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 0 8px;
  text-align: center;
}
.done-stamp {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1.5px solid #181510;
  border-radius: 999px;
  background: var(--butter);
  box-shadow: 3px 3px 0 #181510;
  color: #181510;
  transform: rotate(-4deg);
}
.submit-done h3 {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 26px;
  font-weight: 400;
}
.submit-done p {
  max-width: 380px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
}

/* ── 移动端抽屉 ── */

.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 89;
  background: rgba(21, 17, 11, 0.48);
  backdrop-filter: blur(3px);
}
.rail-close-btn {
  display: inline-flex;
}
.rail-mobile-foot {
  display: none;
}
.rail-open-btn {
  display: inline-flex;
}

/* ── 过渡 ── */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── 响应式 ── */

@media (min-width: 768px) {
  .optional-md {
    display: inline-flex;
  }
  .wall-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .help-grid {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .submit-grid {
    grid-template-columns: 230px minmax(0, 1fr);
  }
}

@media (min-width: 1024px) {
  .workbench {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .rail-right {
    grid-column: auto;
  }
  .wall-head {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    gap: 30px;
  }
}

@media (min-width: 1180px) {
  .studio-head {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    gap: 30px;
  }
  .studio-actions {
    max-width: 700px;
    justify-content: flex-end;
  }
}

@media (min-width: 1280px) {
  .rail-left {
    display: flex;
    flex-direction: column;
  }
  .rail-close-btn,
  .rail-mobile-foot,
  .rail-open-btn {
    display: none;
  }
  .drawer-backdrop {
    display: none;
  }
  .workbench {
    grid-template-columns: 280px minmax(0, 1fr) 324px;
  }
  .rail-right {
    grid-column: auto;
    position: sticky;
    top: calc(var(--header-h) + 12px);
    max-height: calc(100dvh - var(--header-h) - 26px);
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .rail-left {
    position: sticky;
    top: calc(var(--header-h) + 12px);
    max-height: calc(100dvh - var(--header-h) - 26px);
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .wall-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
}

@media (max-width: 1279px) {
  .rail-left.is-open {
    position: fixed;
    top: calc(var(--header-h) + 10px);
    right: 10px;
    bottom: 10px;
    left: 10px;
    z-index: 90;
    display: flex;
    flex-direction: column;
    max-height: none;
    overflow-y: auto;
    border-color: var(--line-strong);
    border-radius: 24px;
    background: var(--surface);
    box-shadow: 0 30px 80px -20px rgba(20, 15, 8, 0.7);
  }
  .rail-left.is-open .rail-mobile-foot {
    position: sticky;
    bottom: 0;
    display: flex;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(8px);
  }
  .rail-left.is-open .gallery-scroll {
    max-height: 44vh;
  }
  .rail-left.is-open .works-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 640px) {
  .rail-left.is-open .gallery-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .rail-left.is-open .gallery-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  /* 手机上选中文字/贴纸后，快捷条固定在底部浮动层，别让用户滚半天 */
  .quick-bar {
    position: fixed;
    right: 12px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    left: 12px;
    z-index: 45;
    flex-wrap: nowrap;
    justify-content: center;
    overflow-x: auto;
    background: var(--surface);
    box-shadow: var(--shadow-soft);
  }
}

@media (max-width: 767px) {
  .studio-title {
    font-size: 37px;
  }
  .studio-stamp {
    width: 44px;
    height: 44px;
    font-size: 26px;
    border-radius: 11px;
  }
  .studio-lede {
    font-size: 12.5px;
  }
  .studio-actions {
    gap: 6px;
  }
  .s-btn {
    height: 36px;
    padding: 0 11px;
    font-size: 11.5px;
  }
  .s-btn-icon {
    width: 36px;
  }
  .undo-group .s-btn {
    width: 30px;
    height: 30px;
  }
  .stage-mat {
    height: min(58dvh, 480px);
    min-height: 320px;
    padding: 12px;
  }
  .stage-hint {
    display: none;
  }
  .recipe-lead-note {
    display: none;
  }
  .wall-from {
    font-size: 7.5px;
  }
  .help-list li {
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .studio-title {
    font-size: 33px;
  }
  .studio-meta span:nth-child(2) {
    display: none;
  }
  .recipe-btn {
    height: 28px;
    padding: 0 8px;
    font-size: 10.5px;
  }
  .stage-foot-right {
    margin-left: 0;
  }
}

</style>
