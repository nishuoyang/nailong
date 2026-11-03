<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { removeAvatar, uploadAvatar } from '@/api/upload'
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_SIZE,
  AVATAR_MIN_EDGE,
  avatarHue,
  formatBytes,
  readImageSize,
  validateAvatarFile,
} from '@/utils/avatar'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'
import ImageCropCanvas from '@/components/common/ImageCropCanvas.vue'

/**
 * 头像上传弹窗内容。
 *
 * 布局：**左窄右宽**——
 *  - 左边是固定尺寸的正方形预览框，显示最终头像（未上传时是已保存头像 / 色块）；
 *  - 右边是操作画布：选好图后在这里拖动、缩放，决定头像截取哪一块。
 *
 * 裁剪结果（取景框在原图里的矩形）随文件一起提交，服务端据此精确裁剪，
 * 所以「预览里看到的」和「最终存下来的」是同一块像素。
 */

const props = withDefaults(
  defineProps<{
    /** 当前已保存的头像 URL（null = 还没上传过） */
    currentUrl?: string | null
    /** 用户名：没上传头像时用它算色块颜色与首字母 */
    name?: string | null
  }>(),
  { currentUrl: null, name: '?' },
)

const emit = defineEmits<{
  (e: 'uploaded', url: string): void
  (e: 'removed'): void
}>()

const toast = useToast()

const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const removing = ref(false)
const progress = ref(0)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

/** 原图尺寸（已按 EXIF 方向纠正，与浏览器 naturalWidth 一致） */
const naturalW = ref(0)
const naturalH = ref(0)
/** 取景框在原图坐标系里的矩形 */
const crop = ref<{ x: number; y: number; size: number } | null>(null)

/** 左侧预览框边长（CSS 像素）。盒子尺寸与下面的裁剪映射共用这一个值，改一处即可 */
const PREVIEW_SIZE = 152

/** 画布里显示的图片：选了新图用本地预览，否则用已保存的头像 */
const canvasSrc = computed(() => previewUrl.value || props.currentUrl || '')
/** 左侧小预览：有新图显示本地预览，否则显示已保存头像 / 色块 */
const thumbSrc = computed(() => previewUrl.value || props.currentUrl || '')

const initial = computed(() => (props.name || '?').trim().charAt(0).toUpperCase())
const hue = computed(() => avatarHue(props.name))
/** 没上传过时展示的色块——与全站头像回退用的是同一套配色 */
const placeholderStyle = computed(() => ({
  background: `linear-gradient(145deg, hsl(${hue.value} 46% 78%), hsl(${(hue.value + 38) % 360} 52% 62%))`,
}))

/**
 * 左侧预览框的裁剪映射。
 *
 * ⚠️ 预览框**不是**「原图缩略图」，而是**取景框里的那一块**：
 * 把原图按 `crop.size → PREVIEW_SIZE` 的比例整体缩放，再平移到取景矩形对齐的位置，
 * 于是框里看到的就是最终 512px 头像的构图。
 *
 * 之前这里只用了 `object-cover`（等于居中裁一块原图），跟 `crop` 毫无绑定，
 * 所以拖动/缩放画布时预览框纹丝不动 —— 这就是「预览不跟随画布」的根因。
 * 现在 crop 每次变化都会重算这组偏移，预览与画布在同一帧内同步。
 *
 * 返回 null 时（还没选图 / 取景框尚未算出 / 已保存头像）退回 `object-cover`：
 * 初始状态本来就是「盖满 + 居中」，与 `initialTransform` 的构图一致，不会闪一下。
 */
const previewCropStyle = computed(() => {
  const rect = crop.value
  if (!file.value || !rect || !rect.size || !naturalW.value || !naturalH.value) return null
  const ratio = PREVIEW_SIZE / rect.size
  return {
    width: `${naturalW.value * ratio}px`,
    height: `${naturalH.value * ratio}px`,
    left: `${-rect.x * ratio}px`,
    top: `${-rect.y * ratio}px`,
  }
})

function revokePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

async function acceptFile(next: File | null | undefined) {
  if (!next) return
  error.value = ''

  const invalid = validateAvatarFile(next)
  if (invalid) {
    error.value = invalid
    return
  }

  // 尺寸要等图片解码出来才知道
  const size = await readImageSize(next)
  if (!size) {
    error.value = '这个文件不是能识别的图片'
    return
  }
  if (size.width < AVATAR_MIN_EDGE || size.height < AVATAR_MIN_EDGE) {
    error.value = `图片太小了（宽高至少 ${AVATAR_MIN_EDGE}px，当前 ${size.width}×${size.height}）`
    return
  }

  revokePreview()
  file.value = next
  previewUrl.value = URL.createObjectURL(next)
  naturalW.value = size.width
  naturalH.value = size.height
  crop.value = null
}

function onDrop(event: DragEvent) {
  dragging.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFile(input.files?.[0])
  // 清空 value：连续选同一个文件也能再次触发 change
  input.value = ''
}

function clearSelection() {
  revokePreview()
  file.value = null
  naturalW.value = 0
  naturalH.value = 0
  crop.value = null
}

/**
 * 画布每次拖动/缩放都会推上来新的取景矩形。
 * 这一份 crop 同时喂给「左侧预览」和提交参数，两边看到的必定是同一块像素。
 */
function onCropUpdate(rect: { x: number; y: number; size: number }) {
  crop.value = rect
}

async function submit() {
  if (!file.value || uploading.value) return
  // 取景框还没算出来（画布尺寸为 0）时不能提交
  if (!crop.value) {
    error.value = '取景还没准备好，稍等一下再试'
    return
  }
  uploading.value = true
  progress.value = 0
  error.value = ''
  try {
    const data = new FormData()
    data.append('file', file.value)
    data.append('cropX', String(crop.value.x))
    data.append('cropY', String(crop.value.y))
    data.append('cropSize', String(crop.value.size))
    const res = await uploadAvatar(data, (percent) => (progress.value = percent))
    progress.value = 100
    const url = res.data.data.avatarUrl
    if (url) {
      emit('uploaded', url)
      toast.success('头像已更新')
    } else {
      toast.warning('头像地址为空，请重试')
    }
    clearSelection()
  } catch (err: any) {
    error.value = err.response?.data?.message || '上传失败，请稍后再试'
    toast.error(error.value)
  } finally {
    uploading.value = false
  }
}

async function restoreDefault() {
  if (removing.value) return
  removing.value = true
  error.value = ''
  try {
    await removeAvatar()
    clearSelection()
    emit('removed')
    toast.success('已恢复默认头像')
  } catch (err: any) {
    const message = err.response?.data?.message || '操作失败，请稍后再试'
    error.value = message
    toast.error(message)
  } finally {
    removing.value = false
  }
}

onBeforeUnmount(revokePreview)
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-[152px_1fr] sm:gap-7">
    <!-- 左：固定尺寸的正方形预览 -->
    <div class="mx-auto w-[152px] shrink-0 sm:mx-0">
      <div
        class="relative shrink-0 overflow-hidden rounded-[30px] bg-surface-2 shadow-[4px_4px_0_0_var(--ink)]"
        :style="{ width: `${PREVIEW_SIZE}px`, height: `${PREVIEW_SIZE}px` }"
      >
        <img
          v-if="thumbSrc"
          :src="thumbSrc"
          alt="头像预览"
          draggable="false"
          :class="previewCropStyle ? 'absolute max-w-none' : 'h-full w-full object-cover'"
          :style="previewCropStyle || undefined"
        />
        <!-- 没上传过时显示色块：和全站「未设置头像」的回退长得一样 -->
        <span
          v-else
          class="grid h-full w-full place-items-center text-5xl font-semibold text-ink/80"
          :style="placeholderStyle"
        >
          {{ initial }}
        </span>
        <span
          v-if="uploading"
          class="absolute inset-0 grid place-items-center bg-[#15110b]/55 font-mono text-[11px] text-paper"
        >
          {{ progress }}%
        </span>
        <!--
          描边用内阴影而不是 border：border 会占掉内容区（152 - 3 = 149），
          而裁剪映射按 152 算，预览就会比取景框紧 2%。内阴影不占位，盒子内沿正好 152。
        -->
        <span
          class="pointer-events-none absolute inset-0 rounded-[30px] shadow-[inset_0_0_0_1.5px_var(--ink)]"
        />
      </div>
      <p class="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
        最终头像 · 512px
      </p>
      <button
        v-if="currentUrl && !file"
        type="button"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-[11px] text-muted transition hover:border-accent hover:text-accent"
        :disabled="removing"
        @click="restoreDefault"
      >
        <AppIcon name="refresh" :size="12" />
        {{ removing ? '恢复中' : '恢复默认（色块）' }}
      </button>
    </div>

    <!-- 右：操作画布 -->
    <div class="min-w-0">
      <!-- 还没选图：拖放区 -->
      <div
        v-if="!file"
        class="flex min-h-[320px] flex-col items-center justify-center rounded-[26px] border-[1.5px] border-dashed border-line-strong bg-surface px-5 py-7 text-center transition"
        :class="dragging ? '!border-accent bg-accent/5' : 'hover:border-ink/50 hover:bg-surface-2'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="grid h-14 w-14 place-items-center rounded-[20px] border border-line bg-paper text-ink-2">
          <AppIcon name="camera" :size="24" />
        </div>
        <p class="mt-4 font-display text-2xl text-ink">把头像拖进来</p>
        <p class="mt-1.5 text-xs text-muted">或者点下面的按钮选一张</p>
        <button type="button" class="n-btn n-btn-outline mt-4" :disabled="uploading" @click="fileInput?.click()">
          <AppIcon name="image" :size="14" /> 选择图片
        </button>
        <input
          ref="fileInput"
          type="file"
          :accept="AVATAR_ACCEPT"
          class="hidden"
          @change="onPick"
        />
        <p class="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
          JPEG · PNG · WebP / ≤ {{ formatBytes(AVATAR_MAX_SIZE) }}
        </p>
      </div>

      <!-- 选好图：变成可拖拽缩放的画布 -->
      <template v-else>
        <ImageCropCanvas
          :src="canvasSrc"
          :natural-width="naturalW"
          :natural-height="naturalH"
          @update:crop="onCropUpdate"
        />

        <div class="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3 py-2.5">
          <AppIcon name="check" :size="15" class="shrink-0 text-jade" />
          <p class="min-w-0 flex-1 truncate text-xs text-ink-2">{{ file.name }}</p>
          <p class="shrink-0 font-mono text-[10px] text-muted">{{ formatBytes(file.size) }}</p>
          <button
            type="button"
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/10 hover:text-ink"
            aria-label="移除"
            @click="clearSelection"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>

        <!-- 错误 -->
        <p
          v-if="error"
          class="mt-3 flex items-start gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent"
        >
          <AppIcon name="alert" :size="13" class="mt-0.5 shrink-0" />
          {{ error }}
        </p>

        <!-- 进度 -->
        <div v-if="uploading" class="mt-4">
          <div class="mb-1.5 flex justify-between font-mono text-[9px] text-muted">
            <span>上传中…</span><span>{{ progress }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-line">
            <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: progress + '%' }" />
          </div>
        </div>

        <UiButton
          variant="primary"
          block
          class="mt-4"
          :loading="uploading"
          :disabled="!file"
          @click="submit"
        >
          <AppIcon v-if="!uploading" name="upload" :size="15" />
          {{ uploading ? '正在上传' : '上传头像' }}
        </UiButton>

        <p class="mt-3 text-[10px] leading-relaxed text-muted">
          上传后头像立即生效，会显示在你的主页、评论和作品列表里。
        </p>
      </template>

      <!-- 没选图时的错误提示 -->
      <p
        v-if="error && !file"
        class="mt-3 flex items-start gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent"
      >
        <AppIcon name="alert" :size="13" class="mt-0.5 shrink-0" />
        {{ error }}
      </p>
    </div>
  </div>
</template>
