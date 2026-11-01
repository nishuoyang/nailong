import type { WhaleMeme } from '@/data/whaleMemes'

/**
 * 把卡片里那张内联 SVG 连同表情文案一起压成 1000×1000 的 PNG。
 * SVG 里没有外部资源，字体在 canvas 上用站内自托管的 Smiley Sans，
 * 所以不依赖 html2canvas，也不会被 CSP 的 img-src 拦下来。
 */
const SIZE = 1000
const FONT_FAMILY = '"Smiley Sans", "PingFang SC", "Microsoft YaHei", sans-serif'

function linesFor(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  const chars = Array.from(text)
  let line = ''
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? ''
    const next = line + char
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = char
      if (lines.length === maxLines - 1) {
        line = chars.slice(index).join('')
        break
      }
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function fitCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  baseSize: number,
) {
  let size = baseSize
  let lines = [text]
  do {
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    lines = linesFor(ctx, text, maxWidth, maxLines)
    const fits = lines.every((line) => ctx.measureText(line).width <= maxWidth)
    if (fits && lines.length <= maxLines) return { size, lines }
    size -= 4
  } while (size >= 30)
  return { size: 30, lines: [text] }
}

function paintCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: 'top' | 'bottom',
  maxWidth: number,
  maxLines: number,
  baseSize: number,
) {
  const { size, lines } = fitCaption(ctx, text, maxWidth, maxLines, baseSize)
  ctx.font = `700 ${size}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = size * 0.24
  ctx.strokeStyle = '#0B1B4D'
  ctx.fillStyle = '#FFFFFF'
  const lineHeight = size * 1.08
  const total = lines.length * lineHeight
  const startCenter = position === 'bottom' ? SIZE - 48 - total / 2 : 48 + total / 2
  lines.forEach((line, index) => {
    const cy = startCenter + index * lineHeight
    ctx.strokeText(line, SIZE / 2, cy, maxWidth)
    ctx.fillText(line, SIZE / 2, cy, maxWidth)
  })
}

async function loadFont() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load(`700 64px "Smiley Sans"`)
    await document.fonts.ready
  } catch {
    /* 字体没加载成功就退回系统字体，不影响导出 */
  }
}

function svgToDataUrl(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(SIZE))
  clone.setAttribute('height', String(SIZE))
  clone.setAttribute('viewBox', '0 0 400 400')
  const markup = new XMLSerializer().serializeToString(clone)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

async function renderPng(svg: SVGSVGElement, meme: WhaleMeme) {
  const source = new Image()
  source.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    source.onload = () => resolve()
    source.onerror = () => reject(new Error('表情包渲染失败'))
  })
  source.src = svgToDataUrl(svg)
  await loaded

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 canvas')

  ctx.drawImage(source, 0, 0, SIZE, SIZE)
  await loadFont()

  // 上下两条渐变暗角，让白字在浅色背景上也立得住
  const shade = ctx.createLinearGradient(0, 0, 0, SIZE)
  shade.addColorStop(0, 'rgba(8, 20, 54, 0.32)')
  shade.addColorStop(0.22, 'rgba(8, 20, 54, 0)')
  shade.addColorStop(0.78, 'rgba(8, 20, 54, 0)')
  shade.addColorStop(1, 'rgba(8, 20, 54, 0.36)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, SIZE, SIZE)

  paintCaption(ctx, meme.top, 'top', SIZE - 120, 2, 76)
  paintCaption(ctx, meme.bottom, 'bottom', SIZE - 120, 2, 62)

  ctx.font = '500 18px "SFMono-Regular", "Cascadia Code", ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillText('大肥鱼 · 深度摸鱼', SIZE - 26, SIZE - 24)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))), 'image/png')
  })
}

export async function downloadWhaleMeme(svg: SVGSVGElement, meme: WhaleMeme) {
  const blob = await renderPng(svg, meme)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `dafeiyu-${meme.id}.png`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function downloadMemeAsset(src: string, filename: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error('表情包素材加载失败')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export async function copyWhaleCaption(meme: WhaleMeme) {
  await copyText(meme.title ?? `${meme.top}\n${meme.bottom}`)
}