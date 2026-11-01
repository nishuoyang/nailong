<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import MemeArt from './MemeArt.vue'
import { useToast } from '@/composables/useToast'
import { copyText, downloadMemeAsset, downloadWhaleMeme } from '@/utils/whaleMemeExport'
import { WHALE_MOODS, type WhaleMeme } from '@/data/whaleMemes'

const props = defineProps<{
  meme: WhaleMeme
  index: number
}>()

const emit = defineEmits<{
  (event: 'open', meme: WhaleMeme): void
}>()

interface ArtExpose {
  svgRef: SVGSVGElement | null
}

const artRef = ref<ArtExpose | null>(null)
const toast = useToast()
const saving = ref(false)

const mood = computed(() => WHALE_MOODS.find((item) => item.key === props.meme.mood))
const hasImage = computed(() => Boolean(props.meme.image))
const tilt = computed(() => {
  const sequence = [-2.4, 1.8, -1.2, 2.6, 1.1, -2.8, 2.1, -1.6]
  return sequence[props.index % sequence.length] ?? 0
})

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (props.meme.image) {
      await downloadMemeAsset(props.meme.full ?? props.meme.image, `dafeiyu-${props.meme.id}.gif`)
      toast.success('已保存 GIF 动图')
    } else {
      const svg = artRef.value?.svgRef
      if (!svg) return
      await downloadWhaleMeme(svg, props.meme)
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
    await copyText(props.meme.title ?? `${props.meme.top}\n${props.meme.bottom}`)
    toast.success('文案已复制，去聊天框里贴吧')
  } catch {
    toast.error('剪贴板被浏览器拦住了')
  }
}
</script>

<template>
  <article class="wh-meme" :style="{ '--wh-tilt': `${tilt}deg`, '--wh-i': index }">
    <button class="wh-meme__sticker" type="button" :aria-label="`查看表情包：${meme.title ?? meme.top}`" @click="emit('open', meme)">
      <span class="wh-meme__art" :class="{ 'wh-meme__art--image': hasImage }">
        <img
          v-if="meme.image"
          :src="meme.image"
          :alt="meme.title ?? '大肥鱼表情包'"
          class="wh-meme__gif"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <template v-else>
          <MemeArt ref="artRef" :meme="meme" />
          <span class="wh-meme__shade" />
          <span class="wh-meme__caption wh-meme__caption--top">{{ meme.top }}</span>
          <span class="wh-meme__caption wh-meme__caption--bottom">{{ meme.bottom }}</span>
        </template>
      </span>
    </button>

    <div class="wh-meme__meta">
      <span class="wh-meme__mood">
        <span class="wh-meme__no font-mono">NO.{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="wh-meme__glyph">{{ mood?.glyph }}</span>
        {{ mood?.label }}
        <span class="wh-meme__tag">#{{ meme.tags[0] }}</span>
      </span>
      <span class="wh-meme__actions">
        <button class="wh-icon-btn" type="button" aria-label="复制文案" title="复制文案" @click="copy">
          <AppIcon name="copy" :size="14" />
        </button>
        <button
          class="wh-icon-btn"
          type="button"
          :aria-label="hasImage ? '保存 GIF' : '保存 PNG'"
          :title="hasImage ? '保存 GIF' : '保存 PNG'"
          :disabled="saving"
          @click="save"
        >
          <AppIcon :name="saving ? 'refresh' : 'download'" :size="14" />
        </button>
      </span>
    </div>
  </article>
</template>

<style scoped>
.wh-meme {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.wh-meme__sticker {
  display: block;
  width: 100%;
  padding: 7px;
  border: 0;
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 2px 0 rgba(255, 255, 255, 0.7) inset, 0 14px 28px -18px rgba(9, 26, 74, 0.65),
    0 4px 0 rgba(9, 26, 74, 0.08);
  transform: rotate(var(--wh-tilt));
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: zoom-in;
}
.wh-meme__sticker:hover,
.wh-meme__sticker:focus-visible {
  transform: rotate(0deg) translateY(-6px);
  box-shadow: 0 2px 0 rgba(255, 255, 255, 0.7) inset, 0 28px 48px -22px rgba(9, 26, 74, 0.7),
    0 6px 0 rgba(9, 26, 74, 0.1);
}
.wh-meme__art {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 20px;
  aspect-ratio: 1;
  background: #cfe6ff;
}
.wh-meme__art--image {
  background: #fff;
}
.wh-meme__gif {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.wh-meme__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(7, 18, 48, 0.3) 0%,
    rgba(7, 18, 48, 0.03) 24%,
    rgba(7, 18, 48, 0) 70%,
    rgba(7, 18, 48, 0.34) 100%
  );
  pointer-events: none;
}
.wh-meme__caption {
  position: absolute;
  left: 10px;
  right: 10px;
  font-family: var(--font-display);
  font-size: clamp(16px, 1.5vw, 21px);
  font-weight: 700;
  line-height: 1.08;
  color: #fff;
  text-align: center;
  letter-spacing: 0.01em;
  text-wrap: balance;
  paint-order: stroke fill;
  -webkit-text-stroke: 0.5px rgba(7, 18, 48, 0.25);
  text-shadow: -2.4px -2.4px 0 #0b1b4d, 2.4px -2.4px 0 #0b1b4d, -2.4px 2.4px 0 #0b1b4d,
    2.4px 2.4px 0 #0b1b4d, 0 3px 5px rgba(7, 18, 48, 0.35);
  pointer-events: none;
}
.wh-meme__caption--top {
  top: 13px;
}
.wh-meme__caption--bottom {
  bottom: 14px;
}
.wh-meme__no {
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--wh-muted, #6a83ab);
  opacity: 0.8;
}
.wh-meme__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}
.wh-meme__mood {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--wh-ink-2, #33507f);
  white-space: nowrap;
}
.wh-meme__glyph {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--wh-blue, #4d6bfe);
  color: #fff;
  font-size: 10px;
  line-height: 1;
}
.wh-meme__tag {
  color: var(--wh-muted, #6a83ab);
  font-weight: 500;
}
.wh-meme__actions {
  display: flex;
  gap: 5px;
}
.wh-icon-btn {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  border: 1px solid var(--wh-line, #bfd6f7);
  background: var(--wh-surface, #fff);
  color: var(--wh-ink-2, #33507f);
  transition: transform 0.2s var(--ease-spring), background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.wh-icon-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--wh-blue, #4d6bfe);
  border-color: var(--wh-blue, #4d6bfe);
  color: #fff;
}
.wh-icon-btn:disabled {
  opacity: 0.5;
}
@media (max-width: 640px) {
  .wh-meme__sticker {
    padding: 5px;
    border-radius: 20px;
  }
  .wh-meme__art {
    border-radius: 16px;
  }
  .wh-meme__caption {
    left: 6px;
    right: 6px;
    font-size: 15px;
    text-shadow: -1.8px -1.8px 0 #0b1b4d, 1.8px -1.8px 0 #0b1b4d, -1.8px 1.8px 0 #0b1b4d,
      1.8px 1.8px 0 #0b1b4d, 0 2px 4px rgba(7, 18, 48, 0.35);
  }
  .wh-meme__caption--top {
    top: 10px;
  }
  .wh-meme__caption--bottom {
    bottom: 11px;
  }
  .wh-meme__no,
  .wh-meme__tag {
    display: none;
  }
}
</style>