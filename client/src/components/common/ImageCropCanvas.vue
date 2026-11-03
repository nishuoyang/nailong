<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  clampTransform,
  coverScale,
  cropGeometry,
  cropSourceRect,
  initialTransform,
  stateFromSourceRect,
  zoomAt,
  type CropState,
} from '@/utils/crop'

/**
 * 图片裁剪画布。
 *
 * 画布上叠一个方形取景框，图片在框后面移动/缩放 —— 取景框里的内容就是最终头像。
 * 交互约定：
 *  - **拖动**：pointer 事件（支持鼠标与触摸），按住图片即可移动；
 *  - **缩放**：滚轮，以光标位置为锚点（对着人脸缩放，脸钉在原地）；
 *  - 两者**互不冲突**：拖动走 pointermove 的增量，缩放走 wheel，
 *    拖动中缩放也不会让位置跳变（缩放用锚点反解，不动拖动基准）。
 */

const props = defineProps<{
  /** 图片地址（通常是 objectURL） */
  src: string
  /** 原图尺寸（已按 EXIF 方向纠正，与浏览器 naturalWidth 一致） */
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  /** 取景框在原图坐标系里的矩形（原图像素） */
  (e: 'update:crop', rect: { x: number; y: number; size: number }): void
}>()

const stageRef = ref<HTMLElement | null>(null)
const stageW = ref(0)
const stageH = ref(0)
const transform = ref<CropState>({ scale: 1, offsetX: 0, offsetY: 0 })
const dragging = ref(false)

/** 上一次的取景矩形（原图坐标），画布尺寸变化时用它保住构图 */
let lastRect: { x: number; y: number; width: number; height: number } | null = null
/** 拖动增量基准（用增量而非绝对值，缩放插进来也不会跳） */
let lastPointer = { x: 0, y: 0 }

const geometry = computed(() =>
  cropGeometry(stageW.value, stageH.value, props.naturalWidth, props.naturalHeight),
)
const frame = computed(() => geometry.value.frame)

const imageStyle = computed(() => {
  const g = geometry.value
  const t = transform.value
  const w = props.naturalWidth * t.scale
  const h = props.naturalHeight * t.scale
  const cx = g.frame.left + g.frame.size / 2
  const cy = g.frame.top + g.frame.size / 2
  return {
    width: `${props.naturalWidth}px`,
    height: `${props.naturalHeight}px`,
    transformOrigin: '0 0',
    transform: `translate(${cx - w / 2 + t.offsetX}px, ${cy - h / 2 + t.offsetY}px) scale(${t.scale})`,
  }
})

const frameStyle = computed(() => ({
  left: `${frame.value.left}px`,
  top: `${frame.value.top}px`,
  width: `${frame.value.size}px`,
  height: `${frame.value.size}px`,
}))

/** 缩放百分比：以「刚好盖满取景框」为 100% */
const zoomPct = computed(() => {
  const g = geometry.value
  if (!g.naturalW || !g.naturalH || !g.frame.size) return 100
  return Math.round((transform.value.scale / coverScale(g)) * 100)
})

function emitCrop() {
  const g = geometry.value
  if (!g.naturalW || !g.naturalH || !g.frame.size) return
  const rect = cropSourceRect(transform.value, g)
  lastRect = rect
  // 取整并夹回原图内，保证送出去的一定是正方形且不越界
  const size = Math.max(1, Math.min(Math.round(rect.width), props.naturalWidth, props.naturalHeight))
  const x = Math.max(0, Math.min(Math.round(rect.x), props.naturalWidth - size))
  const y = Math.max(0, Math.min(Math.round(rect.y), props.naturalHeight - size))
  emit('update:crop', { x, y, size })
}

watch(transform, emitCrop, { deep: true })

// 画布尺寸变了（窗口缩放/布局变化）→ 用旧取景反推新状态，构图不跑
watch([stageW, stageH], () => {
  const g = geometry.value
  if (!props.naturalWidth || !props.naturalHeight || !g.frame.size) return
  transform.value = lastRect
    ? stateFromSourceRect(lastRect, g)
    : initialTransform(g)
})

// 换了一张图 → 复位
// ⚠️ 必须逐个列出依赖项：写成 `watch(() => [a, b, c])` 的话每次都返回新数组，
// 引用永远不相等 → 父组件每次重渲染都会把裁剪状态重置掉（拖拽/缩放会"没反应"）。
watch(
  [() => props.naturalWidth, () => props.naturalHeight, () => props.src],
  () => {
    lastRect = null
    const g = geometry.value
    transform.value = g.frame.size ? initialTransform(g) : { scale: 1, offsetX: 0, offsetY: 0 }
  },
)

function onPointerDown(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0) return
  dragging.value = true
  lastPointer = { x: e.clientX, y: e.clientY }
  // 指针捕获失败（某些环境下会抛）不能影响拖拽本身，所以先置状态再捕获
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  } catch {
    /* 捕获失败时退化为普通事件流，拖拽依然可用 */
  }
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - lastPointer.x
  const dy = e.clientY - lastPointer.y
  lastPointer = { x: e.clientX, y: e.clientY }
  const t = transform.value
  transform.value = clampTransform(
    { ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy },
    geometry.value,
  )
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  } catch {
    /* 忽略 */
  }
}

/** 滚轮缩放：以光标为锚点 */
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  const factor = Math.exp(-e.deltaY * 0.0015)
  transform.value = zoomAt(
    transform.value,
    factor,
    e.clientX - rect.left,
    e.clientY - rect.top,
    geometry.value,
  )
}

/** 按钮缩放：以取景框中心为锚点 */
function zoomBy(factor: number) {
  const g = geometry.value
  transform.value = zoomAt(
    transform.value,
    factor,
    g.frame.left + g.frame.size / 2,
    g.frame.top + g.frame.size / 2,
    g,
  )
}

function reset() {
  transform.value = initialTransform(geometry.value)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  const stage = stageRef.value
  if (!stage) return
  // wheel 必须非 passive，否则 preventDefault 不生效、页面会跟着滚
  stage.addEventListener('wheel', onWheel, { passive: false })
  ro = new ResizeObserver((entries) => {
    const box = entries[0].contentRect
    stageW.value = box.width
    stageH.value = box.height
  })
  ro.observe(stage)
})

onBeforeUnmount(() => {
  stageRef.value?.removeEventListener('wheel', onWheel)
  ro?.disconnect()
})
</script>

<template>
  <div class="space-y-3">
    <!-- 画布 -->
    <div
      ref="stageRef"
      class="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-[26px] border border-line bg-[#1a1611]"
      :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        :src="src"
        class="pointer-events-none absolute left-0 top-0 max-w-none"
        :style="imageStyle"
        alt=""
        draggable="false"
      />
      <!-- 取景框：框外压暗，一眼看出会被裁掉哪些 -->
      <div
        class="crop-frame pointer-events-none absolute border-2 border-paper/90 shadow-[0_0_0_9999px_rgba(15,12,8,0.55)]"
        :style="frameStyle"
      />
      <p
        class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#15110b]/70 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/85"
      >
        拖动移动 · 滚轮缩放
      </p>
    </div>

    <!-- 缩放控件 -->
    <div class="flex items-center justify-center gap-2">
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink"
        aria-label="缩小"
        @click="zoomBy(1 / 1.2)"
      >
        <AppIcon name="minus" :size="14" />
      </button>
      <span class="min-w-[52px] text-center font-mono text-[11px] text-muted">{{ zoomPct }}%</span>
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink"
        aria-label="放大"
        @click="zoomBy(1.2)"
      >
        <AppIcon name="plus" :size="14" />
      </button>
      <button
        type="button"
        class="ml-1 inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-ink hover:text-ink"
        @click="reset"
      >
        <AppIcon name="refresh" :size="12" /> 重置
      </button>
    </div>
  </div>
</template>
