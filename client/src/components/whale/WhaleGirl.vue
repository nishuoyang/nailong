<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WhaleExpression } from '@/data/whaleMemes'

/**
 * 大肥鱼本鱼：DeepSeek 鲸鱼娘的 Q 版女仆形态。
 * 蓝渐变长发 + 呆毛 + 鲸鱼头鳍 + 鲸尾 + 白色荷叶边女仆头饰 +
 * 绀蓝女仆装 + 绣小鲸鱼的白围兜。
 *
 * 全部内联 SVG，方便序列化导成 PNG，所以颜色/描边都写成属性。
 * 角色原型：溟月（上善无形）；女仆装设计：ZipZipPipe；Q 版扩散：这个刀子真甜。
 */
const props = withDefaults(
  defineProps<{
    expression?: WhaleExpression
    uid?: string
    follow?: boolean
    sunglasses?: boolean
    nightcap?: boolean
    bags?: boolean
  }>(),
  {
    expression: 'open',
    uid: 'wg',
    follow: false,
    sunglasses: false,
    nightcap: false,
    bags: false,
  },
)

const root = ref<SVGSVGElement | null>(null)
const look = ref({ x: 0, y: 0 })
let frame = 0
let pending: PointerEvent | null = null

function applyLook() {
  frame = 0
  const event = pending
  const el = root.value
  if (!event || !el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.44
  const dx = event.clientX - cx
  const dy = event.clientY - cy
  const distance = Math.hypot(dx, dy) || 1
  const strength = Math.min(1, distance / 260) * 5
  look.value = {
    x: Number(((dx / distance) * strength).toFixed(2)),
    y: Number(((dy / distance) * strength).toFixed(2)),
  }
}

function onPointerMove(event: PointerEvent) {
  if (!props.follow) return
  pending = event
  if (!frame) frame = requestAnimationFrame(applyLook)
}

onMounted(() => {
  if (props.follow) window.addEventListener('pointermove', onPointerMove, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  if (frame) cancelAnimationFrame(frame)
})

const eyeXs = [154, 246]
const isOpenEye = computed(() =>
  props.expression === 'open' || props.expression === 'angry' || props.expression === 'tired',
)
const isClosedSmile = computed(() => props.expression === 'happy' || props.expression === 'eat')
const isSquint = computed(
  () => props.expression === 'smug' || props.expression === 'sleep' || props.expression === 'cry',
)
const showTears = computed(() => props.expression === 'cry')
const showBlush = computed(() => props.expression !== 'shock')
</script>

<template>
  <svg
    ref="root"
    viewBox="0 0 400 400"
    class="whale-girl"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="`${uid}-hair-back`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#16224F" />
        <stop offset="42%" stop-color="#223A7C" />
        <stop offset="76%" stop-color="#3F7FC0" />
        <stop offset="100%" stop-color="#67B8E9" />
      </linearGradient>
      <linearGradient :id="`${uid}-hair-front`" x1="0" y1="0" x2="0.1" y2="1">
        <stop offset="0%" stop-color="#1B2A60" />
        <stop offset="55%" stop-color="#2C4C96" />
        <stop offset="100%" stop-color="#5AA7DE" />
      </linearGradient>
      <linearGradient :id="`${uid}-skin`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFEDE2" />
        <stop offset="100%" stop-color="#FFD4C0" />
      </linearGradient>
      <linearGradient :id="`${uid}-dress`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#243769" />
        <stop offset="100%" stop-color="#141F42" />
      </linearGradient>
      <linearGradient :id="`${uid}-tail`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#31497F" />
        <stop offset="100%" stop-color="#16224A" />
      </linearGradient>
      <linearGradient :id="`${uid}-fin`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3E5A94" />
        <stop offset="100%" stop-color="#1A2850" />
      </linearGradient>
      <linearGradient :id="`${uid}-apron`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="100%" stop-color="#ECF3FF" />
      </linearGradient>
      <radialGradient :id="`${uid}-iris`" cx="36%" cy="28%" r="82%">
        <stop offset="0%" stop-color="#8FE2FF" />
        <stop offset="44%" stop-color="#2E6BE0" />
        <stop offset="100%" stop-color="#12224F" />
      </radialGradient>
    </defs>

    <ellipse cx="200" cy="392" rx="88" ry="8" fill="#081436" opacity="0.2" />

    <!-- ═════════ 后发 ═════════ -->
    <path
      d="M200 44C120 44 64 102 66 184C68 248 40 316 56 366C70 402 112 406 140 386C154 400 182 404 200 392C218 404 246 400 260 386C288 406 330 402 344 366C360 316 332 248 334 184C336 102 280 44 200 44Z"
      :fill="`url(#${uid}-hair-back)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <g fill="none" stroke="#6FB6E8" stroke-width="3" stroke-linecap="round" opacity="0.3">
      <path d="M104 140C82 220 88 300 108 350" />
      <path d="M128 166C112 244 116 322 132 372" />
      <path d="M296 140C318 220 312 300 292 350" />
      <path d="M272 166C288 244 284 322 268 372" />
    </g>
    <g fill="none" stroke="#0F1838" stroke-width="2.4" stroke-linecap="round" opacity="0.25">
      <path d="M92 170C72 250 80 336 102 376" />
      <path d="M308 170C328 250 320 336 298 376" />
    </g>

    <!-- ═════════ 鲸鱼头鳍 ═════════ -->
    <g>
      <path
        d="M112 182C86 176 54 186 28 204C44 220 68 224 88 214C92 232 102 250 116 262C116 234 114 206 112 182Z"
        :fill="`url(#${uid}-fin)`"
        stroke="#141C3E"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path d="M100 190C74 194 50 202 32 212C52 222 78 218 96 206C104 202 106 196 100 190Z" fill="#C7DCF7" opacity="0.8" />
      <path d="M108 186C86 190 62 198 44 208" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.5" />
      <path d="M104 196C92 206 82 220 76 234M108 214C100 226 94 238 90 246" fill="none" stroke="#5A7FB8" stroke-width="2.2" stroke-linecap="round" opacity="0.55" />
    </g>
    <g>
      <path
        d="M288 182C314 176 346 186 372 204C356 220 332 224 312 214C308 232 298 250 284 262C284 234 286 206 288 182Z"
        :fill="`url(#${uid}-fin)`"
        stroke="#141C3E"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path d="M300 190C326 194 350 202 368 212C348 222 322 218 304 206C296 202 294 196 300 190Z" fill="#C7DCF7" opacity="0.8" />
      <path d="M292 186C314 190 338 198 356 208" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.5" />
      <path d="M296 196C308 206 318 220 324 234M292 214C300 226 306 238 310 246" fill="none" stroke="#5A7FB8" stroke-width="2.2" stroke-linecap="round" opacity="0.55" />
    </g>

    <!-- ═════════ 腿与鞋 ═════════ -->
    <path d="M176 344V378H190V344Z" fill="#F7FBFF" stroke="#2B2340" stroke-width="2.2" />
    <path d="M210 344V378H224V344Z" fill="#F7FBFF" stroke="#2B2340" stroke-width="2.2" />
    <path d="M168 376Q168 386 178 386H192Q198 386 198 376Z" fill="#1C2A56" stroke="#141C3E" stroke-width="2.4" />
    <path d="M202 376Q202 386 212 386H226Q232 386 232 376Z" fill="#1C2A56" stroke="#141C3E" stroke-width="2.4" />
    <path d="M170 381H196M204 381H230" stroke="#4C7BE8" stroke-width="2" stroke-linecap="round" />

    <!-- ═════════ 裙子 ═════════ -->
    <path
      d="M166 326C150 336 134 344 128 350C160 360 240 360 272 350C266 344 250 336 234 326Z"
      :fill="`url(#${uid}-dress)`"
      stroke="#141C3E"
      stroke-width="2.8"
      stroke-linejoin="round"
    />
    <path
      d="M128 350C160 360 240 360 272 350C272 355 266 359 258 361C232 366 168 366 142 361C134 359 128 355 128 350Z"
      fill="#FDFEFF"
      stroke="#2B2340"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
    <path d="M134 344C166 354 234 354 266 344" fill="none" stroke="#E5B85C" stroke-width="2.2" stroke-linecap="round" opacity="0.8" />
    <path d="M154 350L158 356M246 350L242 356" stroke="#E5B85C" stroke-width="3" stroke-linecap="round" opacity="0.9" />

    <!-- ═════════ 身体与女仆装 ═════════ -->
    <path d="M184 246H216V290H184Z" :fill="`url(#${uid}-skin)`" stroke="#6B3A45" stroke-width="2.4" />
    <path
      d="M158 290C170 282 230 282 242 290L246 330C220 338 180 338 154 330Z"
      :fill="`url(#${uid}-dress)`"
      stroke="#141C3E"
      stroke-width="2.8"
      stroke-linejoin="round"
    />

    <!-- 白色围兜 -->
    <path
      d="M176 298C186 294 214 294 224 298L229 332C214 338 186 338 171 332Z"
      :fill="`url(#${uid}-apron)`"
      stroke="#2B2340"
      stroke-width="2.4"
      stroke-linejoin="round"
    />
    <path
      d="M176 298C170 304 168 316 171 332M224 298C230 304 232 316 229 332"
      fill="none"
      stroke="#D9E6FF"
      stroke-width="3"
      stroke-linecap="round"
    />

    <!-- 围兜上的小鲸鱼刺绣 -->
    <g transform="translate(200 318) scale(0.75)" fill="#4C7BE8" stroke="#2C4FA8" stroke-width="1.8">
      <path d="M-15 0C-11 -7 1 -9 9 -4C15 -1 15 6 9 9C1 13 -11 8 -15 0Z" />
      <path d="M-15 0L-23 -6V6Z" stroke-linejoin="round" />
      <circle cx="4" cy="-2" r="1.4" fill="#FFFFFF" stroke="none" />
      <path d="M-4 -11C-2 -16 3 -16 5 -13" fill="none" stroke-linecap="round" />
    </g>

    <!-- 领口荷叶边 -->
    <path
      d="M156 288C168 278 232 278 244 288C246 296 240 302 234 300C226 292 174 292 166 300C160 302 154 296 156 288Z"
      fill="#FDFEFF"
      stroke="#2B2340"
      stroke-width="2.4"
      stroke-linejoin="round"
    />
    <path d="M162 292C168 300 174 300 180 292M186 288C192 296 198 296 204 288M210 292C216 300 222 300 228 292" fill="none" stroke="#D9E6FF" stroke-width="2.2" stroke-linecap="round" />

    <!-- 领结 + 宝石 -->
    <g transform="translate(200 296)" stroke="#141C3E" stroke-width="2.2" stroke-linejoin="round">
      <path d="M0 0C-12 -8 -22 0 -16 8C-10 14 0 6 0 0Z" fill="#1B2A5E" />
      <path d="M0 0C12 -8 22 0 16 8C10 14 0 6 0 0Z" fill="#1B2A5E" />
      <circle r="4.5" fill="#4C7BE8" />
    </g>

    <!-- 金扣 -->
    <g fill="#E5B85C" stroke="#B07E2E" stroke-width="1.4">
      <circle cx="166" cy="312" r="2.6" />
      <circle cx="166" cy="324" r="2.6" />
      <circle cx="234" cy="312" r="2.6" />
      <circle cx="234" cy="324" r="2.6" />
    </g>

    <!-- 手臂 -->
    <g stroke="#141C3E" stroke-width="2.6" stroke-linejoin="round">
      <path d="M158 292C140 300 130 316 128 332C136 340 148 342 156 334C160 320 162 304 164 296Z" :fill="`url(#${uid}-dress)`" />
      <path d="M242 292C260 300 270 316 272 332C264 340 252 342 244 334C240 320 238 304 236 296Z" :fill="`url(#${uid}-dress)`" />
      <circle cx="136" cy="338" r="10" :fill="`url(#${uid}-skin)`" />
      <circle cx="264" cy="338" r="10" :fill="`url(#${uid}-skin)`" />
      <path d="M128 328C138 334 148 334 156 328M272 328C262 334 252 334 244 328" fill="none" stroke="#FDFEFF" stroke-width="5" stroke-linecap="round" />
    </g>

    <!-- ═════════ 脸 ═════════ -->
    <path
      d="M200 58C270 58 314 100 314 166C314 226 272 270 200 270C128 270 86 226 86 166C86 100 130 58 200 58Z"
      :fill="`url(#${uid}-skin)`"
      stroke="#2B2340"
      stroke-width="2.8"
    />
    <path d="M134 250C158 266 242 266 266 250C252 268 230 274 200 274C170 274 148 268 134 250Z" fill="#F6BFAE" opacity="0.3" />
    <path d="M197 214Q200 217 203 214" fill="none" stroke="#D79E8B" stroke-width="2" stroke-linecap="round" opacity="0.75" />

    <!-- ═════════ 侧发 ═════════ -->
    <path
      d="M118 106C92 158 78 218 82 278C84 306 70 320 74 336C78 352 60 360 50 368C74 380 100 366 112 338C132 296 138 236 140 182C142 146 132 122 118 106Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path
      d="M282 106C308 158 322 218 318 278C316 306 330 320 326 336C322 352 340 360 350 368C326 380 300 366 288 338C268 296 262 236 260 182C258 146 268 122 282 106Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path d="M110 140C94 194 88 254 92 304" fill="none" stroke="#7FC8FF" stroke-width="3.2" stroke-linecap="round" opacity="0.4" />
    <path d="M290 140C306 194 312 254 308 304" fill="none" stroke="#7FC8FF" stroke-width="3.2" stroke-linecap="round" opacity="0.4" />
    <path
      d="M96 270C76 298 74 328 58 346C70 364 94 366 108 348C120 332 112 302 106 282Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path
      d="M304 270C324 298 326 328 342 346C330 364 306 366 292 348C280 332 288 302 294 282Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path d="M84 300C78 318 76 334 64 346M316 300C322 318 324 334 336 346" fill="none" stroke="#8FD0F5" stroke-width="2.6" stroke-linecap="round" opacity="0.45" />

    <!-- ═════════ 鲸尾 ═════════ -->
    <path
      d="M276 342C314 338 346 320 362 292C368 280 380 286 379 300C376 326 358 346 334 358C356 364 372 378 380 394C354 392 334 380 320 362C310 376 296 386 278 390C286 374 288 358 284 342Z"
      :fill="`url(#${uid}-tail)`"
      stroke="#141C3E"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path d="M332 340C350 348 364 364 372 380" fill="none" stroke="#8FC7F5" stroke-width="3" stroke-linecap="round" opacity="0.45" />
    <path d="M292 360C306 370 314 380 318 388" fill="none" stroke="#8FC7F5" stroke-width="2.6" stroke-linecap="round" opacity="0.35" />

    <!-- ═════════ 刘海 ═════════ -->
    <path
      d="M200 50C150 50 106 84 100 150C114 136 132 130 150 136C158 122 172 116 186 122C190 136 194 146 200 152L200 50Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path
      d="M200 50C250 50 294 84 300 150C286 136 268 130 250 136C242 122 228 116 214 122C210 136 206 146 200 152Z"
      :fill="`url(#${uid}-hair-front)`"
      stroke="#141C3E"
      stroke-width="3"
    />
    <path d="M200 58V118" stroke="#10193A" stroke-width="2.4" stroke-linecap="round" opacity="0.7" />
    <path d="M124 106C140 80 168 66 198 64C228 62 258 74 280 100" fill="none" stroke="#8FD0F5" stroke-width="6" stroke-linecap="round" opacity="0.28" />
    <path d="M132 120C140 128 146 138 150 146M268 120C260 128 254 138 250 146" fill="none" stroke="#0F1838" stroke-width="2" stroke-linecap="round" opacity="0.35" />

    <!-- ═════════ 女仆头饰 ═════════ -->
    <g v-if="!nightcap">
      <path
        d="M86 114C92 96 106 84 136 74C142 64 160 62 168 72C176 62 196 60 204 70C212 60 232 62 238 72C248 64 266 68 272 78C290 86 304 98 314 114C302 104 290 106 282 116C274 104 258 104 250 114C242 102 226 102 218 112C210 100 190 100 182 112C174 102 158 102 150 114C142 104 126 104 118 116C110 106 98 106 86 114Z"
        fill="#D8E7FF"
        stroke="#2B2340"
        stroke-width="2.2"
        stroke-linejoin="round"
        opacity="0.95"
      />
      <path
        d="M94 108C100 88 114 76 140 66C146 56 164 54 172 64C180 54 198 52 206 62C214 54 232 56 238 66C250 60 266 66 272 76C286 84 296 94 304 108C294 100 284 102 276 110C268 98 254 98 246 108C238 96 224 96 216 106C208 94 192 94 184 106C176 96 162 96 154 108C146 98 132 98 124 110C116 102 106 102 94 108Z"
        fill="#FDFEFF"
        stroke="#2B2340"
        stroke-width="2.8"
        stroke-linejoin="round"
      />
      <path d="M104 98C110 82 120 72 134 66C140 58 154 58 158 66C166 58 180 58 184 66C192 58 208 58 216 66C224 58 238 60 242 68C256 64 270 72 276 82C288 90 296 98 298 104" fill="none" stroke="#DCE9FF" stroke-width="3" stroke-linecap="round" />
      <path d="M140 66C138 80 136 94 136 104M172 64C172 80 172 94 172 104M206 62C208 78 210 94 212 104M238 66C242 80 246 94 248 104M272 76C278 86 282 96 284 104" fill="none" stroke="#DCE9FF" stroke-width="2.2" stroke-linecap="round" opacity="0.8" />
      <path d="M124 96C132 88 142 88 150 96M166 84C174 78 184 78 192 86M208 86C218 78 228 78 236 84M250 96C258 88 268 88 276 96" fill="none" stroke="#EAF2FF" stroke-width="2.4" stroke-linecap="round" />
      <path d="M100 102C126 110 274 110 300 102" fill="none" stroke="#E3EDFF" stroke-width="4" stroke-linecap="round" opacity="0.9" />
      <path d="M112 92C136 100 264 100 288 92" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.75" />
      <path d="M124 80C146 88 254 88 276 80" fill="none" stroke="#DCE9FF" stroke-width="2.4" stroke-linecap="round" opacity="0.7" />
      <g fill="#EAF2FF">
        <circle cx="118" cy="98" r="2.2" />
        <circle cx="146" cy="102" r="2.2" />
        <circle cx="174" cy="104" r="2.2" />
        <circle cx="202" cy="105" r="2.2" />
        <circle cx="230" cy="104" r="2.2" />
        <circle cx="258" cy="102" r="2.2" />
        <circle cx="286" cy="98" r="2.2" />
      </g>
      <g transform="translate(300 100) rotate(12) scale(1.32)" stroke="#141C3E" stroke-width="2.2" stroke-linejoin="round">
        <path d="M0 0C-13 -9 -24 2 -17 10C-10 17 0 8 0 0Z" fill="#4C7BE8" />
        <path d="M0 0C13 -9 24 2 17 10C10 17 0 8 0 0Z" fill="#4C7BE8" />
        <circle r="5" fill="#2C4FA8" />
        <path d="M-4 12L-10 24M4 12L10 24" stroke="#E5B85C" stroke-width="2.4" stroke-linecap="round" />
        <path d="M14 -8L18 -14L22 -8L26 -14" stroke="#FFD84D" stroke-width="2" stroke-linecap="round" opacity="0.9" />
      </g>
    </g>

    <!-- ═════════ 睡帽 ═════════ -->
    <g v-else>
      <path
        d="M128 104C140 58 180 28 226 34C248 37 258 52 250 66L260 112C214 94 170 98 128 104Z"
        fill="#4C7BE8"
        stroke="#141C3E"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path d="M129 104C172 96 216 98 259 112" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round" />
      <circle cx="248" cy="32" r="13" fill="#FFF3C4" stroke="#C9A54E" stroke-width="2.4" />
      <path d="M184 60L190 72M212 52L218 64" stroke="#DCE8FF" stroke-width="3" stroke-linecap="round" opacity="0.8" />
    </g>

    <!-- ═════════ 呆毛 ═════════ -->
    <path
      v-if="!nightcap"
      d="M194 50C180 22 202 4 232 10C252 14 256 32 244 40C234 46 224 38 228 28"
      fill="none"
      stroke="#16224F"
      stroke-width="8"
      stroke-linecap="round"
    />
    <path
      v-if="!nightcap"
      d="M190 52C180 30 196 12 218 12"
      fill="none"
      stroke="#6FB6E8"
      stroke-width="2.4"
      stroke-linecap="round"
      opacity="0.5"
    />

    <!-- ═════════ 眉毛 ═════════ -->
    <g
      v-if="expression === 'angry' || expression === 'shock' || expression === 'tired'"
      fill="none"
      stroke="#2B2340"
      stroke-width="4"
      stroke-linecap="round"
    >
      <path v-if="expression === 'angry'" d="M132 156L176 148M268 156L224 148" />
      <path v-else-if="expression === 'shock'" d="M132 148Q154 140 176 146M268 148Q246 140 224 146" />
      <path v-else d="M134 154Q154 148 174 152M266 154Q246 148 226 152" />
    </g>

    <!-- ═════════ 眼睛 ═════════ -->
    <g v-if="!sunglasses">
      <template v-if="isOpenEye">
        <g v-for="(cx, eyeIndex) in eyeXs" :key="`open-${cx}`">
          <ellipse :cx="cx" cy="184" rx="27" ry="30" fill="#FFFFFF" stroke="#2B2340" stroke-width="2.6" />
          <g :transform="`translate(${look.x} ${look.y})`">
            <ellipse :cx="cx" cy="186" rx="22" ry="26" :fill="`url(#${uid}-iris)`" />
            <ellipse :cx="cx" cy="190" rx="10.5" ry="14.5" fill="#12224F" />
            <circle :cx="cx - 10" cy="172" r="7.6" fill="#FFFFFF" />
            <circle :cx="cx + 9" cy="202" r="3.6" fill="#BFF1FF" />
          </g>
          <path
            :d="`M${cx - 29} 170Q${cx} 154 ${cx + 29} 170`"
            fill="none"
            stroke="#2B2340"
            stroke-width="5.6"
            stroke-linecap="round"
          />
          <path
            :d="
              eyeIndex === 0
                ? `M${cx - 31} 166L${cx - 38} 157`
                : `M${cx + 31} 166L${cx + 38} 157`
            "
            stroke="#2B2340"
            stroke-width="3.6"
            stroke-linecap="round"
          />
          <path
            v-if="bags || expression === 'tired'"
            :d="`M${cx - 17} 220Q${cx} 230 ${cx + 17} 220`"
            fill="none"
            stroke="#8A5A6A"
            stroke-width="3"
            stroke-linecap="round"
            opacity="0.55"
          />
        </g>
      </template>

      <template v-else-if="isClosedSmile">
        <g v-for="(cx, eyeIndex) in eyeXs" :key="`smile-${cx}`">
          <path
            :d="`M${cx - 24} 192Q${cx} 168 ${cx + 24} 192`"
            fill="none"
            stroke="#2B2340"
            stroke-width="6"
            stroke-linecap="round"
          />
          <path
            :d="
              eyeIndex === 0
                ? `M${cx - 27} 180L${cx - 34} 171`
                : `M${cx + 27} 180L${cx + 34} 171`
            "
            stroke="#2B2340"
            stroke-width="3.4"
            stroke-linecap="round"
          />
        </g>
      </template>

      <template v-else-if="isSquint">
        <g v-for="(cx, eyeIndex) in eyeXs" :key="`squint-${cx}`">
          <path
            :d="
              expression === 'cry'
                ? `M${cx - 22} 190Q${cx} 206 ${cx + 22} 190`
                : `M${cx - 25} 190Q${cx} 180 ${cx + 25} 190`
            "
            fill="none"
            stroke="#2B2340"
            stroke-width="5.6"
            stroke-linecap="round"
          />
          <path
            :d="
              eyeIndex === 0
                ? `M${cx - 27} 184L${cx - 34} 176`
                : `M${cx + 27} 184L${cx + 34} 176`
            "
            stroke="#2B2340"
            stroke-width="3.2"
            stroke-linecap="round"
          />
        </g>
      </template>

      <template v-else-if="expression === 'shock'">
        <g v-for="(cx, eyeIndex) in eyeXs" :key="`shock-${cx}`">
          <ellipse :cx="cx" cy="184" rx="25" ry="28" fill="#FFFFFF" stroke="#2B2340" stroke-width="2.6" />
          <circle :cx="cx + look.x" :cy="188 + look.y" r="5.6" fill="#14224F" />
          <path
            :d="`M${cx - 26} 158Q${cx} 146 ${cx + 26} 158`"
            fill="none"
            stroke="#2B2340"
            stroke-width="4.4"
            stroke-linecap="round"
          />
          <path
            :d="
              eyeIndex === 0
                ? `M${cx - 30} 158L${cx - 36} 150`
                : `M${cx + 30} 158L${cx + 36} 150`
            "
            stroke="#2B2340"
            stroke-width="3.2"
            stroke-linecap="round"
          />
        </g>
      </template>

      <template v-else-if="expression === 'love'">
        <g v-for="cx in eyeXs" :key="`love-${cx}`">
          <path
            d="M0 8C0 -2 -11 -6 -14 3C-17 11 -7 18 0 24C7 18 17 11 14 3C11 -6 0 -2 0 8Z"
            :transform="`translate(${cx} 170) scale(1.15)`"
            fill="#FF5C8A"
            stroke="#B7264F"
            stroke-width="2.6"
          />
          <circle :cx="cx - 6" cy="180" r="3.4" fill="#FFFFFF" opacity="0.9" />
        </g>
      </template>

      <template v-else-if="expression === 'dizzy'">
        <g v-for="cx in eyeXs" :key="`dizzy-${cx}`">
          <path
            :d="`M${cx - 16} 172L${cx + 16} 200M${cx + 16} 172L${cx - 16} 200`"
            stroke="#2B2340"
            stroke-width="6"
            stroke-linecap="round"
          />
        </g>
      </template>
    </g>

    <!-- ═════════ 墨镜 ═════════ -->
    <g v-if="sunglasses">
      <rect x="118" y="158" width="70" height="50" rx="17" fill="#0B1B4D" stroke="#061233" stroke-width="3.2" />
      <rect x="212" y="158" width="70" height="50" rx="17" fill="#0B1B4D" stroke="#061233" stroke-width="3.2" />
      <path d="M188 180H212" stroke="#061233" stroke-width="7" stroke-linecap="round" />
      <path d="M128 170H150M222 170H244" stroke="#7FE3FF" stroke-width="4.4" stroke-linecap="round" opacity="0.7" />
      <path d="M118 168L100 160M282 168L300 160" stroke="#061233" stroke-width="3.6" stroke-linecap="round" />
    </g>

    <!-- ═════════ 腮红 ═════════ -->
    <g v-if="showBlush">
      <ellipse cx="120" cy="218" rx="22" ry="12" fill="#FF8FB1" opacity="0.55" />
      <ellipse cx="280" cy="218" rx="22" ry="12" fill="#FF8FB1" opacity="0.55" />
      <g stroke="#F2638A" stroke-width="2.4" stroke-linecap="round" opacity="0.7">
        <path d="M109 214V223M117 212V221M125 214V223" />
        <path d="M275 214V223M283 212V221M291 214V223" />
      </g>
    </g>

    <!-- ═════════ 嘴 ═════════ -->
    <g v-if="expression === 'open' || expression === 'happy' || expression === 'love'">
      <path d="M182 232Q200 228 218 232Q214 254 200 256Q186 254 182 232Z" fill="#7C2B3F" stroke="#2B2340" stroke-width="2.2" />
      <path d="M191 244Q200 239 209 244Q206 253 200 253Q194 253 191 244Z" fill="#FF9FB0" />
    </g>
    <g v-else-if="expression === 'eat'">
      <path d="M185 236Q193 230 200 236Q207 242 215 236" fill="none" stroke="#2B2340" stroke-width="4.6" stroke-linecap="round" />
      <path d="M193 246Q200 252 207 246" fill="none" stroke="#B7264F" stroke-width="3" stroke-linecap="round" />
      <path d="M222 238Q226 232 230 238" fill="none" stroke="#2B2340" stroke-width="3" stroke-linecap="round" />
    </g>
    <g v-else-if="expression === 'smug'">
      <path d="M188 238Q202 248 216 234" fill="none" stroke="#2B2340" stroke-width="4.6" stroke-linecap="round" />
    </g>
    <g v-else-if="expression === 'tired'">
      <path d="M188 240Q200 244 212 238" fill="none" stroke="#2B2340" stroke-width="4" stroke-linecap="round" />
    </g>
    <g v-else-if="expression === 'cry'">
      <ellipse cx="200" cy="242" rx="15" ry="17" fill="#7C2B3F" stroke="#2B2340" stroke-width="2.2" />
      <ellipse cx="200" cy="250" rx="8" ry="6" fill="#FF9FB0" />
    </g>
    <g v-else-if="expression === 'sleep'">
      <ellipse cx="200" cy="240" rx="6" ry="8" fill="#7C2B3F" stroke="#2B2340" stroke-width="2" />
    </g>
    <g v-else-if="expression === 'shock'">
      <ellipse cx="200" cy="242" rx="10" ry="13" fill="#7C2B3F" stroke="#2B2340" stroke-width="2.2" />
    </g>
    <g v-else-if="expression === 'angry'">
      <path d="M188 241Q200 231 212 241" fill="none" stroke="#2B2340" stroke-width="4.6" stroke-linecap="round" />
      <path d="M194 249H206" stroke="#8A5A6A" stroke-width="2.6" stroke-linecap="round" />
    </g>
    <g v-else-if="expression === 'dizzy'">
      <path d="M184 240Q192 233 200 240Q208 247 216 240" fill="none" stroke="#2B2340" stroke-width="4.2" stroke-linecap="round" />
    </g>

    <!-- ═════════ 情绪小配件 ═════════ -->
    <g v-if="expression === 'angry'" stroke="#E8466F" stroke-width="3.6" stroke-linecap="round">
      <path d="M296 148Q306 140 312 150" />
      <path d="M296 164Q306 172 312 162" />
      <path d="M292 156H306" />
    </g>
    <path
      v-if="expression === 'shock' || expression === 'tired'"
      d="M314 150C321 162 325 172 317 178C309 182 302 175 304 166C306 158 310 155 314 150Z"
      fill="#BEEFFF"
      stroke="#2E6BE6"
      stroke-width="2.4"
    />
    <g v-if="showTears">
      <path d="M122 212C112 252 126 292 116 324" fill="none" stroke="#9FE8FF" stroke-width="9" stroke-linecap="round" opacity="0.9" />
      <path d="M278 212C288 252 274 292 284 324" fill="none" stroke="#9FE8FF" stroke-width="9" stroke-linecap="round" opacity="0.9" />
      <circle cx="116" cy="336" r="6" fill="#9FE8FF" stroke="#2E6BE6" stroke-width="2" />
      <circle cx="284" cy="336" r="6" fill="#9FE8FF" stroke="#2E6BE6" stroke-width="2" />
    </g>
    <g v-if="expression === 'love'" fill="#FF5C8A" opacity="0.95">
      <path d="M0 5C0 -3 -8 -5 -10 2C-12 8 -5 13 0 18C5 13 12 8 10 2C8 -5 0 -3 0 5Z" transform="translate(74 126) scale(1.1)" />
      <path d="M0 5C0 -3 -8 -5 -10 2C-12 8 -5 13 0 18C5 13 12 8 10 2C8 -5 0 -3 0 5Z" transform="translate(326 142) scale(0.8)" />
      <path d="M0 5C0 -3 -8 -5 -10 2C-12 8 -5 13 0 18C5 13 12 8 10 2C8 -5 0 -3 0 5Z" transform="translate(322 260) scale(0.95)" />
    </g>
    <g v-if="expression === 'sleep'" fill="none" stroke="#CFE6FF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M84 118H106L84 142H106" />
      <path d="M60 80H74L60 96H74" stroke-width="4" />
      <path d="M44 52H52L44 62H52" stroke-width="3" />
    </g>
  </svg>
</template>

<style scoped>
.whale-girl {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>