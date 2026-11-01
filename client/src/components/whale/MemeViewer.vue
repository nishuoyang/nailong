<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import MemeArt from './MemeArt.vue'
import { useToast } from '@/composables/useToast'
import { copyText, downloadMemeAsset, downloadWhaleMeme } from '@/utils/whaleMemeExport'
import { WHALE_MOODS, type WhaleMeme } from '@/data/whaleMemes'

const props = defineProps<{
  memes: WhaleMeme[]
  index: number
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'update:index', value: number): void
}>()

interface ArtExpose {
  svgRef: SVGSVGElement | null
}

const artRef = ref<ArtExpose | null>(null)
const toast = useToast()
const saving = ref(false)

const current = computed<WhaleMeme>(() => props.memes[props.index] ?? props.memes[0]!)
const mood = computed(() => WHALE_MOODS.find((item) => item.key === current.value.mood))
const hasImage = computed(() => Boolean(current.value.image))

function go(step: number) {
  const total = props.memes.length
  if (!total) return
  emit('update:index', (props.index + step + total) % total)
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (current.value.image) {
      await downloadMemeAsset(current.value.full ?? current.value.image, `dafeiyu-${current.value.id}.gif`)
      toast.success('已保存 GIF 动图')
    } else {
      const svg = artRef.value?.svgRef
      if (!svg) return
      await downloadWhaleMeme(svg, current.value)
      toast.success('已保存到下载文件夹')
    }
  } catch {
    toast.error('保存失败了，换一张再试试')
  } finally {
    saving.value = false
  }
}

async function copy() {
  try {
    await copyText(current.value.title ?? `${current.value.top}\n${current.value.bottom}`)
    toast.success('文案已复制')
  } catch {
    toast.error('剪贴板被浏览器拦住了')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowRight') go(1)
  if (event.key === 'ArrowLeft') go(-1)
}

watch(
  () => props.index,
  () => {
    saving.value = false
  },
)

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="wh-viewer" role="dialog" aria-modal="true" :aria-label="`表情包：${current.title ?? current.top}`">
      <button class="wh-viewer__backdrop" type="button" aria-label="关闭" @click="emit('close')" />

      <div class="wh-viewer__panel">
        <button class="wh-viewer__close" type="button" aria-label="关闭" @click="emit('close')">
          <AppIcon name="close" :size="18" />
        </button>

        <div class="wh-viewer__stage">
          <div class="wh-viewer__sticker" :class="{ 'wh-viewer__sticker--image': hasImage }">
            <img
              v-if="current.image"
              :src="current.full ?? current.image"
              :alt="current.title ?? '大肥鱼表情包'"
              class="wh-viewer__gif"
              decoding="async"
              draggable="false"
            />
            <template v-else>
              <MemeArt ref="artRef" :meme="current" />
              <span class="wh-viewer__shade" />
              <span class="wh-viewer__caption wh-viewer__caption--top">{{ current.top }}</span>
              <span class="wh-viewer__caption wh-viewer__caption--bottom">{{ current.bottom }}</span>
            </template>
          </div>
        </div>

        <span class="wh-viewer__eyebrow font-mono">STICKER PREVIEW · NO.{{ String(index + 1).padStart(2, '0') }}</span>

      <div class="wh-viewer__info">
          <div class="wh-viewer__topline">
            <span class="wh-viewer__no font-mono">NO.{{ String(index + 1).padStart(2, '0') }} / {{ String(memes.length).padStart(2, '0') }}</span>
            <span class="wh-viewer__mood">
              <span class="wh-viewer__glyph">{{ mood?.glyph }}</span>{{ mood?.label }}
            </span>
          </div>

          <h2 class="wh-viewer__title">{{ current.title ?? current.top }}</h2>
          <p class="wh-viewer__note">{{ current.note }}</p>

          <div class="wh-viewer__tags">
            <span v-for="tag in current.tags" :key="tag" class="wh-viewer__tag">#{{ tag }}</span>
          </div>

          <div class="wh-viewer__actions">
            <button class="wh-viewer__btn wh-viewer__btn--primary" type="button" :disabled="saving" @click="save">
              <AppIcon :name="saving ? 'refresh' : 'download'" :size="16" />
              {{ saving ? '正在保存' : hasImage ? '保存 GIF' : '保存 PNG' }}
            </button>
            <button class="wh-viewer__btn" type="button" @click="copy">
              <AppIcon name="copy" :size="16" /> 复制文案
            </button>
          </div>

          <div class="wh-viewer__nav">
            <button type="button" class="wh-viewer__navbtn" aria-label="上一张" @click="go(-1)">
              <AppIcon name="arrow-left" :size="16" /> 上一张
            </button>
            <span class="wh-viewer__hint font-mono">← → 切换 · Esc 关闭</span>
            <button type="button" class="wh-viewer__navbtn" aria-label="下一张" @click="go(1)">
              下一张 <AppIcon name="arrow-right" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wh-viewer {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 18px;
}
.wh-viewer__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(4, 12, 34, 0.78);
  backdrop-filter: blur(14px);
  animation: wh-viewer-fade 0.3s ease both;
}
.wh-viewer__panel {
  position: relative;
  display: grid;
  gap: 22px;
  width: min(1040px, 100%);
  max-height: calc(100dvh - 36px);
  overflow: auto;
  padding: 22px;
  border-radius: 30px;
  border: 1px solid rgba(127, 227, 255, 0.24);
  background: linear-gradient(160deg, #0a1a44 0%, #071230 100%);
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 0.8);
  animation: wh-viewer-pop 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
  color: #eef6ff;
  scrollbar-width: thin;
}
.wh-viewer__eyebrow {
  display: none;
}

.wh-viewer__close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #eef6ff;
  transition: background 0.2s ease, transform 0.2s ease;
}
.wh-viewer__close:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: rotate(90deg);
}
.wh-viewer__stage {
  display: grid;
  place-items: center;
  padding: 6px;
}
.wh-viewer__sticker {
  position: relative;
  width: min(460px, 100%);
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 24px;
  border: 7px solid #fff;
  background: #cfe6ff;
  box-shadow: 0 22px 50px -24px rgba(0, 0, 0, 0.85);
  transform: rotate(-1.2deg);
}
.wh-viewer__sticker--image {
  background: #fff;
}
.wh-viewer__gif {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.wh-viewer__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(7, 18, 48, 0.3) 0%,
    rgba(7, 18, 48, 0.02) 24%,
    rgba(7, 18, 48, 0) 70%,
    rgba(7, 18, 48, 0.34) 100%
  );
}
.wh-viewer__caption {
  position: absolute;
  left: 14px;
  right: 14px;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(24px, 3.4vw, 34px);
  line-height: 1.08;
  text-align: center;
  text-wrap: balance;
  text-shadow: -3px -3px 0 #0b1b4d, 3px -3px 0 #0b1b4d, -3px 3px 0 #0b1b4d, 3px 3px 0 #0b1b4d,
    0 5px 8px rgba(7, 18, 48, 0.4);
}
.wh-viewer__caption--top {
  top: 18px;
}
.wh-viewer__caption--bottom {
  bottom: 18px;
}
.wh-viewer__info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 4px 4px;
}
.wh-viewer__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-right: 44px;
}
.wh-viewer__no {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: #7fa2ff;
}
.wh-viewer__mood {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(127, 227, 255, 0.35);
  background: rgba(127, 227, 255, 0.1);
  color: #bfe6ff;
  font-size: 11px;
  font-weight: 600;
}
.wh-viewer__glyph {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #4d6bfe;
  font-size: 9px;
  color: #fff;
}
.wh-viewer__title {
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.1;
  letter-spacing: 0.01em;
  color: #f4f9ff;
}
.wh-viewer__note {
  font-size: 13px;
  line-height: 1.8;
  color: #a9c1e8;
}
.wh-viewer__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.wh-viewer__tag {
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 10px;
  font-family: var(--font-mono);
  color: #bfe6ff;
}
.wh-viewer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.wh-viewer__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #eef6ff;
  font-size: 13px;
  font-weight: 600;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
}
.wh-viewer__btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.1);
}
.wh-viewer__btn--primary {
  border-color: #ffd84d;
  background: #ffd84d;
  color: #071230;
}
.wh-viewer__btn--primary:hover:not(:disabled) {
  background: #ffe680;
}
.wh-viewer__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.wh-viewer__navbtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #bfe6ff;
  font-size: 12px;
  transition: color 0.2s ease;
}
.wh-viewer__navbtn:hover {
  color: #fff;
}
.wh-viewer__hint {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #5577b8;
}
@media (max-width: 859px) {
  .wh-viewer__panel {
    padding-top: 60px;
  }

  .wh-viewer__eyebrow {
    position: absolute;
    top: 24px;
    left: 24px;
    display: block;
    font-size: 8px;
    letter-spacing: 0.18em;
    color: #7fa2ff;
  }
}

@media (min-width: 860px) {
  .wh-viewer__panel {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    align-items: center;
    padding: 30px;
  }
  .wh-viewer__info {
    min-height: 100%;
    justify-content: center;
  }
}
@keyframes wh-viewer-fade {
  from {
    opacity: 0;
  }
}
@keyframes wh-viewer-pop {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.97);
  }
}
</style>