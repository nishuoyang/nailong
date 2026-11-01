<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { WhaleMeme } from '@/data/whaleMemes'
import MemeBackdrop from './MemeBackdrop.vue'
import MemeProps from './MemeProps.vue'
import WhaleGirl from './WhaleGirl.vue'

const props = defineProps<{
  meme: WhaleMeme
  follow?: boolean
}>()

const rawId = useId()
const uid = computed(() => `wh-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`)
const svgRef = ref<SVGSVGElement | null>(null)

const sunglasses = computed(() => props.meme.scene === 'float')
const nightcap = computed(() => props.meme.scene === 'sleep')
const bags = computed(() => props.meme.scene === 'overtime' || props.meme.scene === 'night')

defineExpose({ svgRef })
</script>

<template>
  <svg
    ref="svgRef"
    class="whale-art"
    viewBox="0 0 400 400"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="meme.note"
  >
    <MemeBackdrop :tone="meme.tone" :uid="uid" />
    <MemeProps :scene="meme.scene" layer="back" />

    <g class="whale-art__girl">
      <WhaleGirl
        :expression="meme.expression"
        :uid="`${uid}-girl`"
        :follow="follow"
        :sunglasses="sunglasses"
        :nightcap="nightcap"
        :bags="bags"
      />
    </g>

    <MemeProps :scene="meme.scene" layer="front" />
  </svg>
</template>

<style scoped>
.whale-art {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
