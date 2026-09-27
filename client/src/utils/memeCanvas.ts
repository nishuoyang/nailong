/**
 * 表情包渲染引擎（纯函数，不依赖 Vue）
 *
 * 设计要点：
 * 1. **单一坐标系**：所有尺寸都以「逻辑画布宽 = 1080」为基准，导出时整体乘以 scale，
 *    因此预览与导出像素级一致，不会出现「预览好看、导出跑版」。
 * 2. **布局与绘制分离**：`layoutMeme()` 算出每个文字块/贴纸的最终外框，`drawMeme()` 只负责画。
 *    拖拽命中检测复用同一份布局 —— 画在哪就能点到哪，不存在两套几何互相漂移。
 * 3. **零服务端成本**：全部计算在浏览器，生产机（2vCPU/1.6GB）不承担任何额外负载。
 */

// ────────────────────────────── 类型 ──────────────────────────────

export type MemeTemplate = 'classic' | 'caption' | 'tag' | 'poster' | 'quote' | 'polaroid' | 'chat'
export type MemeAspect = 'auto' | '1:1' | '4:5' | '3:4' | '16:9'
export type TextRole = 'top' | 'bottom' | 'free'

export interface MemeFilterState {
  preset: string
  brightness: number
  contrast: number
  saturate: number
}

export interface MemeTextBlock {
  id: string
  role: TextRole
  content: string
  /** 归一化中心点（0..1）。null = 跟随模板默认位置 */
  x: number | null
  y: number | null
  /** 逻辑像素字号 */
  size: number
  color: string
  stroke: boolean
  align: 'left' | 'center' | 'right'
  rotation: number
}

export interface MemeStickerItem {
  id: string
  emoji: string
  x: number
  y: number
  size: number
  rotation: number
}

export interface MemeSpec {
  template: MemeTemplate
  aspect: MemeAspect
  filter: MemeFilterState
  texts: MemeTextBlock[]
  stickers: MemeStickerItem[]
}

export interface MemePlate {
  x: number
  y: number
  w: number
  h: number
  radius: number
  fill: string
  /** 左侧竖条（quote 模板用） */
  bar?: { x: number; y: number; w: number; h: number; fill: string }
  /** 气泡小尾巴（chat 模板用）：从 (x,y) 这个角往外支出去 */
  tail?: { x: number; y: number; size: number; dir: 'left' | 'right'; fill: string }
}

export interface LaidOutText {
  block: MemeTextBlock
  lines: string[]
  fontSize: number
  lineHeight: number
  /** 文字块中心（逻辑像素） */
  cx: number
  cy: number
  w: number
  h: number
  rotation: number
  plate: MemePlate | null
  shadow: boolean
}

export interface LaidOutSticker {
  item: MemeStickerItem
  cx: number
  cy: number
  size: number
  rotation: number
}

export interface MemeLayout {
  W: number
  H: number
  texts: LaidOutText[]
  stickers: LaidOutSticker[]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ────────────────────────────── 常量 ──────────────────────────────

/** 逻辑画布宽度：所有尺寸以此为基准，导出时统一放大 */
export const LOGICAL_W = 1080

/** 无衬线粗体优先；拉丁字形吃 Impact 的经典梗图味，中文自动回落到 PingFang / 雅黑 */
const MEME_FONT =
  '"Impact","Haettenschweiler","Arial Narrow Bold","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Heiti SC",sans-serif'
const UI_FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Heiti SC",sans-serif'
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

const MIN_FONT = 26
const MAX_LINES = 4

export interface TemplateMeta {
  key: MemeTemplate
  name: string
  emoji: string
  desc: string
  accent: string
  /** 该模板下每个角色默认字号与配色 */
  roles: Partial<Record<TextRole, { size: number; color: string; stroke: boolean; align: 'left' | 'center' | 'right' }>>
}

export const TEMPLATES: TemplateMeta[] = [
  {
    key: 'classic',
    name: '经典两行',
    emoji: '🅰️',
    desc: '上句抛梗、下句接住，梗图的原教旨主义',
    accent: '#ffffff',
    roles: {
      top: { size: 96, color: '#ffffff', stroke: true, align: 'center' },
      bottom: { size: 96, color: '#ffffff', stroke: true, align: 'center' },
    },
  },
  {
    key: 'caption',
    name: '底部字幕',
    emoji: '💬',
    desc: '半透明字幕条压底，像一句突然被打上的旁白',
    accent: '#facc15',
    roles: {
      bottom: { size: 74, color: '#ffffff', stroke: false, align: 'center' },
    },
  },
  {
    key: 'tag',
    name: '标签 + 大字',
    emoji: '🏷️',
    desc: '左上角贴个标签，一眼说明立场',
    accent: '#2563eb',
    roles: {
      top: { size: 46, color: '#ffffff', stroke: false, align: 'left' },
      bottom: { size: 104, color: '#ffffff', stroke: true, align: 'center' },
    },
  },
  {
    key: 'poster',
    name: '大字报',
    emoji: '📢',
    desc: '一句话糊满整张图，音量拉满',
    accent: '#ef4444',
    roles: {
      free: { size: 150, color: '#ffffff', stroke: true, align: 'center' },
      bottom: { size: 54, color: '#ffffff', stroke: true, align: 'center' },
    },
  },
  {
    key: 'quote',
    name: '金句卡',
    emoji: '📜',
    desc: '左下竖条 + 细体大字，一本正经地胡说八道',
    accent: '#22d3ee',
    roles: {
      free: { size: 78, color: '#ffffff', stroke: false, align: 'left' },
      bottom: { size: 48, color: '#e5e7eb', stroke: false, align: 'left' },
    },
  },
  {
    key: 'polaroid',
    name: '拍立得',
    emoji: '📸',
    desc: '白色相纸 + 底部落款，适合做纪念卡',
    accent: '#f8fafc',
    roles: {
      bottom: { size: 58, color: '#1f2937', stroke: false, align: 'center' },
    },
  },
  {
    key: 'chat',
    name: '聊天气泡',
    emoji: '🗨️',
    desc: '左一句右一句，像一段真的聊天记录',
    accent: '#3b82f6',
    roles: {
      top: { size: 58, color: '#0f172a', stroke: false, align: 'left' },
      bottom: { size: 58, color: '#ffffff', stroke: false, align: 'left' },
    },
  },
]

/** 拍立得相纸的几何：四边留白 + 底部更宽的落款区（绘制与布局共用同一份参数） */
export function polaroidFrame(W: number, H: number): { side: number; top: number; band: number } {
  const side = W * 0.05
  const top = W * 0.05
  const band = Math.max(H * 0.13, 120)
  return { side, top, band }
}

const POLAROID_PAPER = '#f8fafc'

export interface FilterPreset {
  key: string
  label: string
  css: string
}

export const FILTER_PRESETS: FilterPreset[] = [
  { key: 'none', label: '原图', css: '' },
  { key: 'vivid', label: '鲜艳', css: 'saturate(1.28) contrast(1.08) brightness(1.03)' },
  { key: 'film', label: '胶片', css: 'sepia(0.14) saturate(1.12) contrast(1.1) brightness(1.02)' },
  { key: 'punch', label: '高反差', css: 'contrast(1.34) saturate(1.06)' },
  { key: 'mono', label: '黑白', css: 'grayscale(1) contrast(1.12)' },
  { key: 'cool', label: '冷调', css: 'hue-rotate(-14deg) saturate(1.12)' },
  { key: 'warm', label: '暖调', css: 'sepia(0.2) saturate(1.16) brightness(1.04)' },
]

export const ASPECTS: Array<{ key: MemeAspect; label: string; hint: string }> = [
  { key: 'auto', label: '原比例', hint: '跟随底图' },
  { key: '1:1', label: '1:1', hint: '正方形 · 聊天' },
  { key: '4:5', label: '4:5', hint: '竖版 · 朋友圈' },
  { key: '3:4', label: '3:4', hint: '竖版 · 海报' },
  { key: '16:9', label: '16:9', hint: '横版 · 封面' },
]

// ────────────────────────────── 工具 ──────────────────────────────

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function filterCss(f: MemeFilterState): string {
  const parts: string[] = []
  const preset = FILTER_PRESETS.find((p) => p.key === f.preset)
  if (preset && preset.css) parts.push(preset.css)
  if (f.brightness !== 1) parts.push(`brightness(${f.brightness})`)
  if (f.contrast !== 1) parts.push(`contrast(${f.contrast})`)
  if (f.saturate !== 1) parts.push(`saturate(${f.saturate})`)
  return parts.join(' ')
}

function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const rad = Math.min(radius, r.w / 2, r.h / 2)
  ctx.beginPath()
  ctx.moveTo(r.x + rad, r.y)
  ctx.lineTo(r.x + r.w - rad, r.y)
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + rad)
  ctx.lineTo(r.x + r.w, r.y + r.h - rad)
  ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - rad, r.y + r.h)
  ctx.lineTo(r.x + rad, r.y + r.h)
  ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - rad)
  ctx.lineTo(r.x, r.y + rad)
  ctx.quadraticCurveTo(r.x, r.y, r.x + rad, r.y)
  ctx.closePath()
}

function fontOf(size: number, family = MEME_FONT, weight = 900): string {
  return `${weight} ${Math.round(size)}px ${family}`
}

/** 把一段文字切成若干行：先尊重手动换行，再按可用宽度折行（中英混排按字符宽度累加） */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    if (raw === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const ch of raw) {
      const next = line + ch
      if (ctx.measureText(next).width > maxWidth && line !== '') {
        out.push(line)
        line = ch
      } else {
        line = next
      }
    }
    if (line !== '') out.push(line)
  }
  return out.length ? out : ['']
}

/** 自动适配：从期望字号开始逐档缩小，直到行数与高度都塞得进给定盒子 */
function autoFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  family = MEME_FONT,
  weight = 900,
): { lines: string[]; fontSize: number; lineHeight: number } {
  let size = Math.max(MIN_FONT, startSize)
  for (; size >= MIN_FONT; size -= 2) {
    ctx.font = fontOf(size, family, weight)
    const lines = wrapText(ctx, text, maxWidth)
    const lineHeight = size * 1.16
    if (lines.length <= MAX_LINES && lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize: size, lineHeight }
    }
  }
  ctx.font = fontOf(MIN_FONT, family, weight)
  const lines = wrapText(ctx, text, maxWidth).slice(0, MAX_LINES)
  return { lines, fontSize: MIN_FONT, lineHeight: MIN_FONT * 1.16 }
}

function defaultAnchor(template: MemeTemplate, role: TextRole, W: number, H: number): { cx: number; cy: number } {
  switch (template) {
    case 'classic':
      if (role === 'top') return { cx: W / 2, cy: H * 0.1 }
      if (role === 'bottom') return { cx: W / 2, cy: H * 0.9 }
      return { cx: W / 2, cy: H / 2 }
    case 'caption':
      return { cx: W / 2, cy: H * 0.86 }
    case 'tag':
      if (role === 'top') return { cx: W * 0.06 + 120, cy: H * 0.062 }
      return { cx: W / 2, cy: H * 0.9 }
    case 'poster':
      if (role === 'free') return { cx: W / 2, cy: H * 0.48 }
      return { cx: W / 2, cy: H * 0.9 }
    case 'quote':
      if (role === 'free') return { cx: W * 0.5, cy: H * 0.78 }
      return { cx: W * 0.5, cy: H * 0.9 }
    case 'polaroid': {
      const f = polaroidFrame(W, H)
      return { cx: W / 2, cy: H - f.band / 2 }
    }
    case 'chat':
      if (role === 'top') return { cx: W * 0.06, cy: H * 0.14 }
      return { cx: W * 0.94, cy: H * 0.86 }
    default:
      return { cx: W / 2, cy: H / 2 }
  }
}

/** 每个模板实际启用哪些角色（决定 UI 上显示几个输入框、以及画布上出现几段文字） */
export function activeRoles(template: MemeTemplate): TextRole[] {
  switch (template) {
    case 'classic':
      return ['top', 'bottom']
    case 'caption':
      return ['bottom']
    case 'tag':
      return ['top', 'bottom']
    case 'poster':
      return ['free', 'bottom']
    case 'quote':
      return ['free', 'bottom']
    case 'polaroid':
      return ['bottom']
    case 'chat':
      return ['top', 'bottom']
    default:
      return ['top', 'bottom']
  }
}

// ────────────────────────────── 画布尺寸 ──────────────────────────────

export function computeCanvasSize(aspect: MemeAspect, img: HTMLImageElement | null): { W: number; H: number } {
  const W = LOGICAL_W
  if (aspect === 'auto') {
    const natural = img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1
    // 极端长图/宽图不再无限拉伸，钳到 0.62~1.9 之间，超出的部分用 cover 裁掉
    const ratio = clamp(natural, 0.62, 1.9)
    return { W, H: Math.round(W * ratio) }
  }
  const map: Record<Exclude<MemeAspect, 'auto'>, number> = {
    '1:1': 1,
    '4:5': 1.25,
    '3:4': 1.3333,
    '16:9': 9 / 16,
  }
  return { W, H: Math.round(W * map[aspect]) }
}

/** cover 裁切：取底图里最能填满画布的那块 */
export function coverSource(img: HTMLImageElement, W: number, H: number): Rect {
  const iw = img.naturalWidth || W
  const ih = img.naturalHeight || H
  const target = W / H
  const natural = iw / ih
  let sw = iw
  let sh = ih
  if (natural > target) {
    sw = ih * target
  } else {
    sh = iw / target
  }
  return { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh }
}

// ────────────────────────────── 布局 ──────────────────────────────

export function createDefaultSpec(): MemeSpec {
  return {
    template: 'classic',
    aspect: 'auto',
    filter: { preset: 'none', brightness: 1, contrast: 1, saturate: 1 },
    texts: [
      { id: uid('t'), role: 'top', content: '我很好', x: null, y: null, size: 96, color: '#ffffff', stroke: true, align: 'center', rotation: 0 },
      { id: uid('t'), role: 'bottom', content: '只是精神状态进化成了奶蛙', x: null, y: null, size: 96, color: '#ffffff', stroke: true, align: 'center', rotation: 0 },
    ],
    stickers: [],
  }
}

/** 切换模板时把文字块的样式重置为该模板的默认观感，位置复位为模板默认 */
export function applyTemplate(spec: MemeSpec, template: MemeTemplate): MemeSpec {
  const meta = TEMPLATES.find((t) => t.key === template) ?? TEMPLATES[0]
  const roles = activeRoles(template)
  const next: MemeTextBlock[] = roles.map((role) => {
    const style = meta.roles[role] ?? { size: 80, color: '#ffffff', stroke: false, align: 'center' as const }
    const exist = spec.texts.find((t) => t.role === role)
    return {
      id: exist?.id ?? uid('t'),
      role,
      content: exist?.content ?? '',
      x: null,
      y: null,
      size: style.size,
      color: style.color,
      stroke: style.stroke,
      align: style.align,
      rotation: 0,
    }
  })
  return { ...spec, template, texts: next }
}

export function layoutMeme(ctx: CanvasRenderingContext2D, spec: MemeSpec, W: number, H: number): MemeLayout {
  const texts: LaidOutText[] = []
  const meta = TEMPLATES.find((t) => t.key === spec.template) ?? TEMPLATES[0]

  for (const block of spec.texts) {
    const content = block.content ?? ''
    if (content.trim() === '' && block.role !== 'free') continue

    // 不同模板给文字留出不同的可用盒子
    let maxW = W * 0.9
    let maxH = H * 0.3
    if (spec.template === 'poster') {
      maxW = W * 0.86
      maxH = H * 0.62
    } else if (spec.template === 'quote') {
      maxW = W * 0.8
      maxH = H * 0.34
    } else if (spec.template === 'caption') {
      maxW = W * 0.86
      maxH = H * 0.34
    } else if (spec.template === 'tag') {
      maxW = block.role === 'top' ? W * 0.66 : W * 0.9
      maxH = block.role === 'top' ? H * 0.1 : H * 0.28
    } else if (spec.template === 'classic') {
      maxW = W * 0.9
      maxH = H * 0.26
    } else if (spec.template === 'polaroid') {
      const f = polaroidFrame(W, H)
      maxW = W - f.side * 2 - W * 0.06
      maxH = f.band * 0.6
    } else if (spec.template === 'chat') {
      maxW = W * 0.68
      maxH = H * 0.2
    }

    const family = spec.template === 'quote' ? UI_FONT : MEME_FONT
    const weight = spec.template === 'quote' ? 700 : 900
    const fitted = autoFit(ctx, content.trim(), maxW, maxH, block.size, family, weight)

    // 文字实测宽度（用于外框与命中检测）
    ctx.font = fontOf(fitted.fontSize, family, weight)
    let textW = 0
    for (const line of fitted.lines) textW = Math.max(textW, ctx.measureText(line).width)

    const padX = fitted.fontSize * 0.34
    const padY = fitted.fontSize * 0.22
    const w = textW + padX * 2
    const h = fitted.lines.length * fitted.lineHeight + padY * 2

    const anchor = defaultAnchor(spec.template, block.role, W, H)
    let cx = (block.x ?? anchor.cx / W) * W
    const cy = (block.y ?? anchor.cy / H) * H
    // 左/右对齐的块按「边缘贴齐」定位，否则字数一变边距就跟着漂。
    // 拖过的块（x 非 null）不参与这条规则，用户的手动位置永远优先。
    if (block.x === null) {
      if (spec.template === 'tag' && block.role === 'top') {
        cx = W * 0.06 + w / 2
      } else if (spec.template === 'chat') {
        cx = block.role === 'top' ? W * 0.06 + w / 2 : W * 0.94 - w / 2
      }
    }

    const top = cy - h / 2
    const left = cx - w / 2

    let plate: MemePlate | null = null
    let shadow = false

    if (spec.template === 'caption') {
      plate = {
        x: left,
        y: top,
        w,
        h,
        radius: fitted.fontSize * 0.28,
        fill: 'rgba(0,0,0,0.62)',
      }
    } else if (spec.template === 'tag' && block.role === 'top') {
      plate = {
        x: left,
        y: top,
        w,
        h,
        radius: h / 2,
        fill: 'rgba(37,99,235,0.94)',
      }
      shadow = true
    } else if (spec.template === 'quote') {
      plate = {
        x: left,
        y: top,
        w,
        h,
        radius: fitted.fontSize * 0.2,
        fill: 'rgba(0,0,0,0.42)',
        bar: {
          x: left,
          y: top,
          w: Math.max(8, fitted.fontSize * 0.13),
          h,
          fill: meta.accent,
        },
      }
      shadow = true
    } else if (spec.template === 'poster' && block.role === 'free') {
      shadow = true
    } else if (spec.template === 'chat') {
      // 对方（左）：白底深字；自己（右）：蓝底白字 —— 一眼就是聊天记录的观感
      const isLeft = block.role === 'top'
      plate = {
        x: left,
        y: top,
        w,
        h,
        radius: Math.min(28, h * 0.36),
        fill: isLeft ? 'rgba(255,255,255,0.95)' : 'rgba(37,99,235,0.95)',
        tail: {
          x: isLeft ? left + h * 0.32 : left + w - h * 0.32,
          y: top + h - 2,
          size: h * 0.26,
          dir: isLeft ? 'left' : 'right',
          fill: isLeft ? 'rgba(255,255,255,0.95)' : 'rgba(37,99,235,0.95)',
        },
      }
      shadow = true
    }

    texts.push({
      block,
      lines: fitted.lines,
      fontSize: fitted.fontSize,
      lineHeight: fitted.lineHeight,
      cx,
      cy,
      w,
      h,
      rotation: block.rotation,
      plate,
      shadow,
    })
  }

  const stickers: LaidOutSticker[] = spec.stickers.map((item) => ({
    item,
    cx: item.x * W,
    cy: item.y * H,
    size: item.size,
    rotation: item.rotation,
  }))

  return { W, H, texts, stickers }
}

// ────────────────────────────── 绘制 ──────────────────────────────

export interface DrawOptions {
  /** 是否绘制选中框（导出时关闭） */
  selection?: { kind: 'text' | 'sticker'; id: string } | null
}

export function drawMeme(
  ctx: CanvasRenderingContext2D,
  layout: MemeLayout,
  spec: MemeSpec,
  img: HTMLImageElement | null,
  options: DrawOptions = {},
) {
  const { W, H } = layout
  ctx.save()
  ctx.clearRect(0, 0, W, H)

  // 1) 底图 + 滤镜
  ctx.save()
  const css = filterCss(spec.filter)
  if (css) ctx.filter = css
  if (img && img.naturalWidth > 0) {
    const src = coverSource(img, W, H)
    ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, W, H)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#111827')
    g.addColorStop(0.5, '#1f2937')
    g.addColorStop(1, '#0f172a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.filter = 'none'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = fontOf(46, UI_FONT, 500)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('从左边挑一张图，或上传本地图片', W / 2, H / 2 - 22)
    ctx.font = fontOf(34, UI_FONT, 400)
    ctx.fillStyle = 'rgba(255,255,255,0.32)'
    ctx.fillText('底图只在你自己的浏览器里处理，不会上传', W / 2, H / 2 + 44)
  }
  ctx.restore()

  // 2a) 模板纸面（拍立得）：底图先满铺，再用相纸四周盖回去，露出来的就是「照片」区
  if (spec.template === 'polaroid') {
    const f = polaroidFrame(W, H)
    ctx.save()
    ctx.fillStyle = POLAROID_PAPER
    ctx.fillRect(0, 0, W, f.top)
    ctx.fillRect(0, f.top, f.side, H - f.top)
    ctx.fillRect(W - f.side, f.top, f.side, H - f.top)
    ctx.fillRect(0, H - f.band, W, f.band)
    // 照片边缘一道极淡的内影，让相纸有厚度
    ctx.strokeStyle = 'rgba(15,23,42,0.14)'
    ctx.lineWidth = 3
    ctx.strokeRect(f.side, f.top, W - f.side * 2, H - f.top - f.band)
    ctx.restore()
  }

  // 2) 模板装饰（底板）
  for (const t of layout.texts) {
    if (!t.plate) continue
    ctx.save()
    if (t.rotation) {
      ctx.translate(t.cx, t.cy)
      ctx.rotate((t.rotation * Math.PI) / 180)
      ctx.translate(-t.cx, -t.cy)
    }
    if (t.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = t.fontSize * 0.3
      ctx.shadowOffsetY = t.fontSize * 0.06
    }
    ctx.fillStyle = t.plate.fill
    roundRectPath(ctx, t.plate, t.plate.radius)
    ctx.fill()

    // 气泡尾巴：贴着圆角矩形底边画一个小三角，方向由 dir 决定
    if (t.plate.tail) {
      const tl = t.plate.tail
      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y - 2)
      ctx.lineTo(tl.x + (tl.dir === 'left' ? -tl.size : tl.size), tl.y + tl.size * 0.85)
      ctx.lineTo(tl.x + (tl.dir === 'left' ? tl.size * 0.5 : -tl.size * 0.5), tl.y - 2)
      ctx.closePath()
      ctx.fillStyle = tl.fill
      ctx.fill()
    }
    ctx.restore()

    if (t.plate.bar) {
      ctx.save()
      if (t.rotation) {
        ctx.translate(t.cx, t.cy)
        ctx.rotate((t.rotation * Math.PI) / 180)
        ctx.translate(-t.cx, -t.cy)
      }
      ctx.fillStyle = t.plate.bar.fill
      roundRectPath(ctx, t.plate.bar, t.plate.bar.w / 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // 3) 文字
  for (const t of layout.texts) {
    const block = t.block
    ctx.save()
    if (t.rotation) {
      ctx.translate(t.cx, t.cy)
      ctx.rotate((t.rotation * Math.PI) / 180)
      ctx.translate(-t.cx, -t.cy)
    }
    const family = spec.template === 'quote' ? UI_FONT : MEME_FONT
    const weight = spec.template === 'quote' ? 700 : 900
    ctx.font = fontOf(t.fontSize, family, weight)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    let anchorX = t.cx
    if (block.align === 'left') {
      anchorX = t.cx - t.w / 2 + t.fontSize * 0.34
      ctx.textAlign = 'left'
    } else if (block.align === 'right') {
      anchorX = t.cx + t.w / 2 - t.fontSize * 0.34
      ctx.textAlign = 'right'
    }

    const firstLineY = t.cy - ((t.lines.length - 1) * t.lineHeight) / 2
    for (let i = 0; i < t.lines.length; i++) {
      const line = t.lines[i]
      const y = firstLineY + i * t.lineHeight
      if (block.stroke) {
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.lineWidth = Math.max(4, t.fontSize * 0.14)
        ctx.strokeStyle = 'rgba(0,0,0,0.92)'
        ctx.strokeText(line, anchorX, y)
        // 二次描边让边缘更实，缩放后不发虚
        ctx.lineWidth = Math.max(2, t.fontSize * 0.07)
        ctx.strokeText(line, anchorX, y)
      } else if (
        t.shadow &&
        (spec.template === 'caption' || spec.template === 'quote' || spec.template === 'poster')
      ) {
        // 只在「字直接压在图上」的模板给文字加投影；气泡/胶囊里的字有自己的底板，
        // 再加投影只会显脏
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = t.fontSize * 0.22
        ctx.shadowOffsetY = t.fontSize * 0.04
      }
      ctx.fillStyle = block.color
      ctx.fillText(line, anchorX, y)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }
    ctx.restore()
  }

  // 4) 贴纸
  for (const s of layout.stickers) {
    ctx.save()
    ctx.translate(s.cx, s.cy)
    if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.font = `${Math.round(s.size)}px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = s.size * 0.12
    ctx.fillText(s.item.emoji, 0, 0)
    ctx.restore()
  }

  // 5) 选中框（仅编辑态）
  const sel = options.selection
  if (sel) {
    ctx.save()
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3
    ctx.setLineDash([12, 10])
    if (sel.kind === 'text') {
      const t = layout.texts.find((x) => x.block.id === sel.id)
      if (t) {
        if (t.rotation) {
          ctx.translate(t.cx, t.cy)
          ctx.rotate((t.rotation * Math.PI) / 180)
          ctx.translate(-t.cx, -t.cy)
        }
        ctx.strokeRect(t.cx - t.w / 2, t.cy - t.h / 2, t.w, t.h)
      }
    } else {
      const s = layout.stickers.find((x) => x.item.id === sel.id)
      if (s) {
        const r = s.size * 0.62
        ctx.strokeRect(s.cx - r, s.cy - r, r * 2, r * 2)
      }
    }
    ctx.restore()
  }

  ctx.restore()
}

// ────────────────────────────── 命中检测 / 拖拽 ──────────────────────────────

/** 把画布坐标点转换到某个旋转矩形的局部坐标，再判断是否落在框内 */
function hitRotatedRect(px: number, py: number, cx: number, cy: number, w: number, h: number, rotation: number): boolean {
  const rad = (-rotation * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
  const pad = 8
  return Math.abs(rx) <= w / 2 + pad && Math.abs(ry) <= h / 2 + pad
}

export type HitTarget = { kind: 'text'; id: string } | { kind: 'sticker'; id: string } | null

export function hitTest(layout: MemeLayout, px: number, py: number): HitTarget {
  // 贴纸在上层，优先命中
  for (let i = layout.stickers.length - 1; i >= 0; i--) {
    const s = layout.stickers[i]
    const r = s.size * 0.62
    if (hitRotatedRect(px, py, s.cx, s.cy, r * 2, r * 2, s.rotation)) return { kind: 'sticker', id: s.item.id }
  }
  for (let i = layout.texts.length - 1; i >= 0; i--) {
    const t = layout.texts[i]
    if (hitRotatedRect(px, py, t.cx, t.cy, t.w, t.h, t.rotation)) return { kind: 'text', id: t.block.id }
  }
  return null
}

// ────────────────────────────── 导出 ──────────────────────────────

export function renderToCanvas(
  spec: MemeSpec,
  img: HTMLImageElement | null,
  W: number,
  H: number,
  scale: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)
  const layout = layoutMeme(ctx, spec, W, H)
  drawMeme(ctx, layout, spec, img)
  return canvas
}

export function describeSpec(spec: MemeSpec, img: HTMLImageElement | null): { W: number; H: number } {
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) return { W: LOGICAL_W, H: LOGICAL_W }
  const { W, H } = computeCanvasSize(spec.aspect, img)
  return { W, H }
}
