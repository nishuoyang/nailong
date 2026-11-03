/**
 * 头像裁剪的几何计算（纯函数，不碰 DOM，方便单独推理与验证）。
 *
 * 坐标系：
 *  - **画布**：CSS 像素矩形 `canvasW × canvasH`，用户看到的操作区域。
 *  - **取景框**：居中的正方形，边长 `frame.size`。最终头像 = 取景框里的内容。
 *  - **原图**：`naturalW × naturalH`，按 `scale` 缩放后绘制在画布上。
 *    `offsetX / offsetY` = 图片中心相对取景框中心的偏移（画布像素）。
 *
 * 核心约束：**图片始终盖满取景框**。
 *  - 缩放下限 = 刚好盖满取景框的比例（再小取景框里就会露白）；
 *  - 偏移上限 = (图片缩放后尺寸 − 取景框边长) / 2（再拖取景框里就会露白）。
 * 于是无论怎么拖拽缩放，裁出来的头像永远是满的，不会有半张图或白边。
 * 图片超出画布的那部分由 `overflow: hidden` 裁掉，不会溢到页面别处。
 */

export interface CropState {
  /** 显示缩放：每个原图像素对应多少画布像素 */
  scale: number
  /** 图片中心相对取景框中心的横向偏移（画布像素） */
  offsetX: number
  /** 图片中心相对取景框中心的纵向偏移（画布像素） */
  offsetY: number
}

export interface CropFrame {
  /** 取景框左上角在画布中的位置 */
  left: number
  top: number
  /** 取景框边长（正方形） */
  size: number
}

export interface CropGeometry {
  canvasW: number
  canvasH: number
  /** 原图像素尺寸（已按 EXIF 方向纠正） */
  naturalW: number
  naturalH: number
  frame: CropFrame
}

/** 取景框四周留白（画布像素） */
export const CROP_FRAME_PADDING = 22
/** 相对「刚好盖满取景框」那一档，最多再放大几倍 */
export const CROP_MAX_ZOOM = 5
/**
 * 取景区域在原图里至少保留多少像素边长。
 *
 * 放大上限以此为准：再放大下去取景区域太小，撑成 512px 会糊。
 */
export const CROP_MIN_CROP_PX = 256
/** 导出头像的边长 */
export const CROP_OUTPUT_SIZE = 512

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value
}

/** 几何：取景框取画布短边减留白并居中 */
export function cropGeometry(
  canvasW: number,
  canvasH: number,
  naturalW: number,
  naturalH: number,
  padding = CROP_FRAME_PADDING,
): CropGeometry {
  const size = Math.max(1, Math.min(canvasW, canvasH) - padding * 2)
  return {
    canvasW,
    canvasH,
    naturalW,
    naturalH,
    frame: { left: (canvasW - size) / 2, top: (canvasH - size) / 2, size },
  }
}

/** 刚好盖满取景框所需的缩放比例 */
export function coverScale(geo: CropGeometry): number {
  if (!geo.naturalW || !geo.naturalH) return 1
  return Math.max(geo.frame.size / geo.naturalW, geo.frame.size / geo.naturalH)
}

/**
 * 允许的最大缩放。
 *
 * 上限是「刚好盖满」的 CROP_MAX_ZOOM 倍，同时保证取景区域在原图里
 * 还剩 CROP_MIN_CROP_PX 边长（否则拉成 512px 会糊）。
 */
export function maxScale(geo: CropGeometry): number {
  const cover = coverScale(geo)
  const byPixels = geo.frame.size / CROP_MIN_CROP_PX
  return Math.max(cover, Math.min(cover * CROP_MAX_ZOOM, byPixels))
}

/** 把缩放限制到合法范围 */
export function clampScale(scale: number, geo: CropGeometry): number {
  const min = coverScale(geo)
  const max = maxScale(geo)
  return clamp(scale, min, Math.max(min, max))
}

/** 该缩放下允许的最大横向偏移（再往外拖，取景框里就会露白） */
export function maxOffsetX(scale: number, geo: CropGeometry): number {
  return Math.max(0, (geo.naturalW * scale - geo.frame.size) / 2)
}

/** 该缩放下允许的最大纵向偏移 */
export function maxOffsetY(scale: number, geo: CropGeometry): number {
  return Math.max(0, (geo.naturalH * scale - geo.frame.size) / 2)
}

/** 把偏移夹回合法范围，并同步把缩放夹回合法范围 */
export function clampTransform(t: CropState, geo: CropGeometry): CropState {
  const scale = clampScale(t.scale, geo)
  const limitX = maxOffsetX(scale, geo)
  const limitY = maxOffsetY(scale, geo)
  return {
    scale,
    offsetX: clamp(t.offsetX, -limitX, limitX),
    offsetY: clamp(t.offsetY, -limitY, limitY),
  }
}

/** 初始状态：按比例盖满取景框并居中 */
export function initialTransform(geo: CropGeometry): CropState {
  return clampTransform({ scale: coverScale(geo), offsetX: 0, offsetY: 0 }, geo)
}

/** 图片在画布中的外框 */
export function imageRect(t: CropState, geo: CropGeometry) {
  const width = geo.naturalW * t.scale
  const height = geo.naturalH * t.scale
  const frameCx = geo.frame.left + geo.frame.size / 2
  const frameCy = geo.frame.top + geo.frame.size / 2
  return {
    left: frameCx - width / 2 + t.offsetX,
    top: frameCy - height / 2 + t.offsetY,
    width,
    height,
  }
}

/**
 * 以某个点为锚点缩放：缩放前后，该点下面的图像内容保持不动。
 *
 * 这是缩放手感的关键——鼠标指着人脸滚轮缩放，脸应该钉在原地，
 * 而不是朝取景框中心缩。
 */
export function zoomAt(
  t: CropState,
  factor: number,
  pointX: number,
  pointY: number,
  geo: CropGeometry,
): CropState {
  const target = clampScale(t.scale * factor, geo)
  const before = imageRect(t, geo)
  // 锚点对应的原图坐标（与缩放无关）
  const u = (pointX - before.left) / t.scale
  const v = (pointY - before.top) / t.scale
  // 反解新的图片外框，让锚点仍停在同一个画面位置
  const width = geo.naturalW * target
  const height = geo.naturalH * target
  const left = pointX - u * target
  const top = pointY - v * target
  const frameCx = geo.frame.left + geo.frame.size / 2
  const frameCy = geo.frame.top + geo.frame.size / 2
  return clampTransform(
    {
      scale: target,
      offsetX: left + width / 2 - frameCx,
      offsetY: top + height / 2 - frameCy,
    },
    geo,
  )
}

/**
 * 取景框在**原图**坐标系里的矩形（单位：原图像素）。
 *
 * 因为图片始终盖满取景框，这里的取值一定落在原图范围内。
 */
export function cropSourceRect(
  t: CropState,
  geo: CropGeometry,
): { x: number; y: number; width: number; height: number } {
  const rect = imageRect(t, geo)
  return {
    x: (geo.frame.left - rect.left) / t.scale,
    y: (geo.frame.top - rect.top) / t.scale,
    width: geo.frame.size / t.scale,
    height: geo.frame.size / t.scale,
  }
}

/**
 * 由「原图里的取景矩形」反推变换状态。
 *
 * 用途：画布尺寸变化（窗口缩放、弹窗布局变化）时用它把当前取景换算到新画布上，
 * 用户已经调好的构图不会跑掉。
 */
export function stateFromSourceRect(
  rect: { x: number; y: number; width: number; height: number },
  geo: CropGeometry,
): CropState {
  const scale = geo.frame.size / Math.max(1, rect.width)
  const left = geo.frame.left - rect.x * scale
  const top = geo.frame.top - rect.y * scale
  const frameCx = geo.frame.left + geo.frame.size / 2
  const frameCy = geo.frame.top + geo.frame.size / 2
  return clampTransform(
    {
      scale,
      offsetX: left + (geo.naturalW * scale) / 2 - frameCx,
      offsetY: top + (geo.naturalH * scale) / 2 - frameCy,
    },
    geo,
  )
}
