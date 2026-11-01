<script setup lang="ts">
import type { WhaleScene } from '@/data/whaleMemes'

/**
 * 每张表情包的小道具。layer = back 的画在角色后面，front 的画在前面。
 * 道具只用基础形状，保持贴纸感，也方便导出 PNG 时原样序列化。
 */
defineProps<{
  scene: WhaleScene
  layer: 'back' | 'front'
}>()

const HEART = 'M0 5C0 -3 -8 -6 -11 2C-14 9 -5 15 0 19C5 15 14 9 11 2C8 -6 0 -3 0 5Z'
</script>

<template>
  <g>
    <!-- ══════════ 摸鱼：泳圈 ══════════ -->
    <g v-if="scene === 'float' && layer === 'front'">
      <ellipse cx="200" cy="304" rx="146" ry="38" fill="none" stroke="#FFC94D" stroke-width="30" />
      <ellipse cx="200" cy="304" rx="146" ry="38" fill="none" stroke="#FFF3C4" stroke-width="7" stroke-dasharray="16 26" opacity="0.95" />
      <ellipse cx="200" cy="304" rx="161" ry="53" fill="none" stroke="#C98A1E" stroke-width="2.5" opacity="0.45" />
      <ellipse cx="200" cy="304" rx="131" ry="23" fill="none" stroke="#C98A1E" stroke-width="2.5" opacity="0.45" />
    </g>

    <!-- ══════════ 深度思考：思考气泡 + 空碗 ══════════ -->
    <g v-if="scene === 'think' && layer === 'front'" transform="translate(-18 38)">
      <circle cx="316" cy="178" r="9" fill="#FFFFFF" stroke="#16307A" stroke-width="3" />
      <circle cx="338" cy="146" r="13" fill="#FFFFFF" stroke="#16307A" stroke-width="3" />
      <path
        d="M286 44C286 26 302 14 322 14H348C368 14 382 28 382 46V84C382 102 368 114 348 114H334L312 132L316 112C300 108 290 96 290 80Z"
        fill="#FFFFFF"
        stroke="#16307A"
        stroke-width="3.4"
        stroke-linejoin="round"
        opacity="0.97"
      />
      <g transform="translate(330 68)">
        <path d="M-32 6H32C30 30 18 42 0 42C-18 42 -30 30 -32 6Z" fill="#7FE3FF" stroke="#2E6BE6" stroke-width="3" />
        <path d="M-34 6H34" stroke="#2E6BE6" stroke-width="4" stroke-linecap="round" />
        <path d="M-22 -6C-18 -16 -8 -14 -4 -6M4 -6C8 -18 20 -16 24 -4" fill="none" stroke="#FFC94D" stroke-width="4" stroke-linecap="round" />
        <path d="M22 -6L40 -26M16 -2L34 -22" stroke="#C98A1E" stroke-width="4" stroke-linecap="round" />
      </g>
      <g fill="#FFFFFF" opacity="0.75">
        <circle cx="66" cy="112" r="6" />
        <circle cx="88" cy="84" r="4" />
      </g>
    </g>

    <!-- ══════════ 服务器繁忙：缠住的数据线 ══════════ -->
    <g v-if="scene === 'busy' && layer === 'front'">
      <path d="M34 268C96 226 150 316 222 262S318 208 368 250" fill="none" stroke="#0B1B4D" stroke-width="16" stroke-linecap="round" />
      <path d="M34 268C96 226 150 316 222 262S318 208 368 250" fill="none" stroke="#FF8FB1" stroke-width="9" stroke-linecap="round" />
      <path d="M58 156C118 204 172 112 244 160S320 196 356 168" fill="none" stroke="#0B1B4D" stroke-width="13" stroke-linecap="round" />
      <path d="M58 156C118 204 172 112 244 160S320 196 356 168" fill="none" stroke="#7FE3FF" stroke-width="7" stroke-linecap="round" />
      <g transform="translate(46 262)">
        <rect x="-12" y="-10" width="24" height="20" rx="4" fill="#FFD84D" stroke="#C99A00" stroke-width="2.6" />
        <path d="M12 0H24" stroke="#C99A00" stroke-width="4" stroke-linecap="round" />
      </g>
      <g transform="translate(360 246)">
        <rect x="-12" y="-10" width="24" height="20" rx="4" fill="#7FE3FF" stroke="#2E6BE6" stroke-width="2.6" />
        <path d="M-24 0H-12" stroke="#2E6BE6" stroke-width="4" stroke-linecap="round" />
      </g>
      <g transform="translate(58 64)">
        <path d="M0 -26L24 16H-24Z" fill="#FFD84D" stroke="#C99A00" stroke-width="3" stroke-linejoin="round" />
        <path d="M0 -12V2" stroke="#0B1B4D" stroke-width="4.4" stroke-linecap="round" />
        <circle cx="0" cy="9" r="2.6" fill="#0B1B4D" />
      </g>
    </g>

    <!-- ══════════ 大肥鱼：软尺 ══════════ -->
    <g v-if="scene === 'fat' && layer === 'front'">
      <path d="M66 292Q200 330 334 292" fill="none" stroke="#C99A00" stroke-width="26" stroke-linecap="round" />
      <path d="M66 292Q200 330 334 292" fill="none" stroke="#FFD84D" stroke-width="20" stroke-linecap="round" />
      <g stroke="#B07E00" stroke-width="2.2" stroke-linecap="round">
        <path d="M96 301V311" />
        <path d="M124 307V317" />
        <path d="M152 312V322" />
        <path d="M180 315V325" />
        <path d="M208 315V325" />
        <path d="M236 312V322" />
        <path d="M264 307V317" />
        <path d="M292 301V311" />
      </g>
      <rect x="312" y="278" width="26" height="36" rx="7" fill="#FFD84D" stroke="#B07E00" stroke-width="3" />
    </g>

    <!-- ══════════ 再改最后一版：笔记本 ══════════ -->
    <g v-if="scene === 'overtime' && layer === 'front'">
      <g transform="translate(200 322)">
        <path d="M-92 6L-78 -66Q-76 -74 -68 -74H68Q76 -74 78 -66L92 6Z" fill="#1B2C66" stroke="#0B1B4D" stroke-width="3.4" stroke-linejoin="round" />
        <rect x="-64" y="-62" width="128" height="56" rx="6" fill="#0A1438" />
        <g stroke="#7FE3FF" stroke-width="3" stroke-linecap="round" opacity="0.95">
          <path d="M-50 -50H-14" />
          <path d="M-50 -38H22" />
          <path d="M-50 -26H2" />
          <path d="M-50 -14H30" />
        </g>
        <circle cx="58" cy="-50" r="4" fill="#FF8FB1" />
        <path d="M-104 6H104L96 28H-96Z" fill="#2E4FD4" stroke="#0B1B4D" stroke-width="3.4" stroke-linejoin="round" />
        <path d="M-44 18H44" stroke="#7FE3FF" stroke-width="3" stroke-linecap="round" opacity="0.7" />
      </g>
      <g transform="translate(44 268)">
        <path d="M-16 0H16V30C16 38 8 44 0 44C-8 44 -16 38 -16 30Z" fill="#FFFFFF" stroke="#2E6BE6" stroke-width="3" />
        <path d="M16 4H24C30 4 30 22 22 24" fill="none" stroke="#2E6BE6" stroke-width="3" />
        <path d="M-6 -8C-10 -16 -2 -18 -4 -26M4 -8C0 -16 8 -18 6 -26" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" opacity="0.8" />
      </g>
    </g>

    <!-- ══════════ token：小鱼币 ══════════ -->
    <g v-if="scene === 'token' && layer === 'front'">
      <g v-for="(coin, index) in [
        { x: 88, y: 126, s: 1 },
        { x: 314, y: 154, s: 0.82 },
        { x: 340, y: 268, s: 0.95 },
        { x: 62, y: 232, s: 0.75 },
        { x: 280, y: 62, s: 0.7 },
      ]" :key="index" :transform="`translate(${coin.x} ${coin.y}) scale(${coin.s})`">
        <circle r="18" fill="#FFD84D" stroke="#B07E00" stroke-width="3" />
        <circle r="12.5" fill="none" stroke="#B07E00" stroke-width="2" opacity="0.55" />
        <path d="M-5 -6H5M0 -6V7" stroke="#8A5B00" stroke-width="3.6" stroke-linecap="round" />
      </g>
      <g fill="#FFFFFF" opacity="0.9">
        <path d="M120 92l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path d="M286 200l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </g>
    </g>

    <!-- ══════════ 先睡为敬：被子 ══════════ -->
    <g v-if="scene === 'sleep' && layer === 'front'">
      <path
        d="M56 336C62 312 84 298 112 302C138 306 152 296 174 292C196 288 214 292 234 298C256 304 274 298 292 302C320 308 338 318 344 336V400H56Z"
        fill="#7FA2FF"
        stroke="#16307A"
        stroke-width="3.4"
        stroke-linejoin="round"
      />
      <path
        d="M62 340C86 318 108 316 130 318C160 322 178 310 200 310C222 310 244 320 270 318C296 316 318 322 338 340"
        fill="none"
        stroke="#B9CCFF"
        stroke-width="5"
        stroke-linecap="round"
        opacity="0.8"
      />
      <g fill="#FFF3C4" opacity="0.85">
        <path d="M110 338l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path d="M210 356l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path d="M292 332l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </g>

    <!-- ══════════ 我真的会谢：小水洼 + 碎心 ══════════ -->
    <g v-if="scene === 'cry' && layer === 'front'">
      <ellipse cx="200" cy="372" rx="132" ry="16" fill="#7FE3FF" opacity="0.55" />
      <g transform="translate(76 112) rotate(-14)">
        <path :d="HEART" fill="#FF8FB1" stroke="#C24A72" stroke-width="2.6" transform="scale(1.2)" />
        <path d="M0 4L-4 14" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
      </g>
      <path d="M318 148l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFFFFF" opacity="0.8" />
    </g>

    <!-- ══════════ 改需求：手机 + 闪电 ══════════ -->
    <g v-if="scene === 'shock' && layer === 'front'">
      <g transform="translate(304 296) rotate(-12)">
        <rect x="-32" y="-60" width="64" height="120" rx="13" fill="#0B1B4D" stroke="#061233" stroke-width="3" />
        <rect x="-26" y="-52" width="52" height="100" rx="7" fill="#DFF3FF" />
        <path d="M0 -26V6" stroke="#E8466F" stroke-width="8" stroke-linecap="round" />
        <circle cx="0" cy="20" r="4.5" fill="#E8466F" />
        <path d="M-10 58H10" stroke="#7FE3FF" stroke-width="3" stroke-linecap="round" />
      </g>
      <path d="M54 96L34 128H52L40 158L70 122H52L64 96Z" fill="#FFD84D" stroke="#B07E00" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M96 62L84 84H96L88 102L108 78H96L104 62Z" fill="#FF8FB1" stroke="#C24A72" stroke-width="2.2" stroke-linejoin="round" opacity="0.9" />
    </g>

    <!-- ══════════ 比心：爱心 ══════════ -->
    <g v-if="scene === 'love' && layer === 'front'">
      <g fill="#FF5C8A" stroke="#B7264F" stroke-width="2">
        <path :d="HEART" transform="translate(82 170) scale(1.5)" />
        <path :d="HEART" transform="translate(322 208) scale(1.15) rotate(12)" />
        <path :d="HEART" transform="translate(300 92) scale(0.85) rotate(-12)" />
        <path :d="HEART" transform="translate(112 314) scale(0.9)" />
      </g>
      <g fill="#FFFFFF">
        <path d="M138 96l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path d="M268 142l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </g>
    </g>

    <!-- ══════════ 加载中：转圈圈 ══════════ -->
    <g v-if="scene === 'loading' && layer === 'back'" fill="none" stroke-linecap="round">
      <g stroke="#4D6BFE" stroke-width="9" opacity="0.85">
        <path d="M200 36A154 154 0 0 1 322 110" />
        <path d="M344 240A154 154 0 0 1 290 330" />
        <path d="M110 330A154 154 0 0 1 56 240" />
      </g>
      <g stroke="#FFFFFF" stroke-width="4" opacity="0.75">
        <path d="M200 54A136 136 0 0 1 306 118" />
        <path d="M328 236A136 136 0 0 1 282 312" />
      </g>
    </g>

    <!-- ══════════ 游到下班：小鱼 + 速度线 ══════════ -->
    <g v-if="scene === 'swim' && layer === 'front'">
      <g fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" opacity="0.75">
        <path d="M58 250H96" />
        <path d="M46 274H88" />
        <path d="M70 298H104" />
      </g>
      <g v-for="(fish, index) in [
        { x: 76, y: 144, s: 1, r: 10 },
        { x: 322, y: 116, s: 0.8, r: -12 },
        { x: 300, y: 330, s: 0.9, r: 8 },
        { x: 118, y: 360, s: 0.7, r: -6 },
      ]" :key="index" :transform="`translate(${fish.x} ${fish.y}) scale(${fish.s}) rotate(${fish.r})`">
        <path d="M-18 0C-18 -13 -1 -19 11 -10C21 -4 21 4 11 10C-1 19 -18 13 -18 0Z" fill="#7FE3FF" stroke="#2E6BE6" stroke-width="2.6" />
        <path d="M-18 0L-31 -9V9Z" fill="#7FE3FF" stroke="#2E6BE6" stroke-width="2.6" stroke-linejoin="round" />
        <circle cx="5" cy="-4" r="2.2" fill="#0B1B4D" />
      </g>
    </g>

    <!-- ══════════ 干饭时间：白米饭 ══════════ -->
    <g v-if="scene === 'rice' && layer === 'front'">
      <g transform="translate(318 316)">
        <path d="M-48 -12H48C44 34 30 50 0 50C-30 50 -44 34 -48 -12Z" fill="#F4F9FF" stroke="#2E6BE6" stroke-width="3" stroke-linejoin="round" />
        <path d="M-44 -4H44" stroke="#2E6BE6" stroke-width="3" stroke-linecap="round" />
        <path d="M-42 30C-28 40 -14 44 0 44C14 44 28 40 42 30" fill="none" stroke="#BFD9FF" stroke-width="2.4" opacity="0.8" />
        <path d="M-40 -12C-36 -36 -20 -48 0 -48C20 -48 36 -36 40 -12Z" fill="#FFFFFF" stroke="#D9E6FF" stroke-width="2.4" />
        <g fill="#EAF2FF">
          <ellipse cx="-18" cy="-26" rx="7" ry="4" transform="rotate(-24 -18 -26)" />
          <ellipse cx="4" cy="-38" rx="7" ry="4" transform="rotate(8 4 -38)" />
          <ellipse cx="24" cy="-22" rx="7" ry="4" transform="rotate(26 24 -22)" />
          <ellipse cx="-4" cy="-18" rx="6" ry="3.5" />
          <ellipse cx="16" cy="-34" rx="5" ry="3" transform="rotate(12 16 -34)" />
        </g>
        <path d="M-10 -46L-40 -96M8 -46L38 -92" stroke="#C98A1E" stroke-width="4" stroke-linecap="round" />
        <path d="M-54 34H54" stroke="#2E6BE6" stroke-width="4" stroke-linecap="round" />
        <g fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.75">
          <path d="M-18 -62C-22 -72 -14 -76 -18 -86" />
          <path d="M6 -58C2 -68 10 -72 6 -82" />
        </g>
      </g>
      <g fill="#FFFFFF" opacity="0.7">
        <circle cx="62" cy="184" r="4" />
        <circle cx="84" cy="160" r="2.6" />
      </g>
    </g>

    <!-- ══════════ 元气满满：音符 + 彩纸 ══════════ -->
    <g v-if="scene === 'dance' && layer === 'front'">
      <g transform="translate(76 128) rotate(-12)" stroke="#FF5C8A" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M0 0V-34L22 -40V-8" />
        <ellipse cx="-7" cy="2" rx="9" ry="6.5" fill="#FF5C8A" stroke="none" transform="rotate(-18 -7 2)" />
        <ellipse cx="15" cy="-6" rx="9" ry="6.5" fill="#FF5C8A" stroke="none" transform="rotate(-18 15 -6)" />
      </g>
      <g transform="translate(330 166) rotate(14)" stroke="#4D6BFE" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M0 0V-26L16 -30V-6" />
        <ellipse cx="-6" cy="2" rx="8" ry="6" fill="#4D6BFE" stroke="none" transform="rotate(-18 -6 2)" />
        <ellipse cx="11" cy="-4" rx="8" ry="6" fill="#4D6BFE" stroke="none" transform="rotate(-18 11 -4)" />
      </g>
      <g>
        <rect x="56" y="248" width="16" height="7" rx="2" fill="#FFD84D" transform="rotate(-24 64 251)" />
        <rect x="326" y="290" width="15" height="7" rx="2" fill="#FF8FB1" transform="rotate(18 333 293)" />
        <rect x="288" y="74" width="14" height="7" rx="2" fill="#7FE3FF" transform="rotate(-30 295 77)" />
        <rect x="92" y="330" width="14" height="7" rx="2" fill="#FFFFFF" transform="rotate(22 99 333)" />
        <circle cx="352" cy="116" r="5" fill="#FFD84D" />
        <circle cx="48" cy="196" r="4" fill="#7FE3FF" />
      </g>
    </g>

    <!-- ══════════ 信号不好：没信号的手机 ══════════ -->
    <g v-if="scene === 'wifi' && layer === 'front'">
      <g transform="translate(314 318) rotate(-8) scale(0.92)">
        <rect x="-36" y="-66" width="72" height="132" rx="14" fill="#0B1B4D" stroke="#061233" stroke-width="3" />
        <rect x="-29" y="-57" width="58" height="110" rx="8" fill="#EDF6FF" />
        <g fill="none" stroke="#2E6BE6" stroke-width="4" stroke-linecap="round" opacity="0.35">
          <path d="M-18 4A24 24 0 0 1 18 4" />
          <path d="M-10 -4A13 13 0 0 1 10 -4" />
        </g>
        <path d="M-14 24L14 -6M14 24L-14 -6" stroke="#E8466F" stroke-width="5" stroke-linecap="round" />
        <circle cx="0" cy="8" r="3.2" fill="#2E6BE6" opacity="0.5" />
      </g>
    </g>

    <!-- ══════════ 凌晨三点：闹钟 + 手机微光 ══════════ -->
    <g v-if="scene === 'night' && layer === 'front'">
      <g transform="translate(70 104)">
        <circle r="30" fill="#EAF4FF" stroke="#16307A" stroke-width="3.4" />
        <path d="M0 0V-19M0 0L13 9" fill="none" stroke="#0B1B4D" stroke-width="4" stroke-linecap="round" />
        <circle r="3.4" fill="#0B1B4D" />
        <path d="M-20 -24L-13 -31M20 -24L13 -31" stroke="#16307A" stroke-width="4" stroke-linecap="round" />
        <path d="M-12 32L-18 40M12 32L18 40" stroke="#16307A" stroke-width="4" stroke-linecap="round" />
      </g>
      <g transform="translate(318 306) rotate(10)">
        <rect x="-30" y="-56" width="60" height="112" rx="12" fill="#0B1B4D" stroke="#061233" stroke-width="3" />
        <rect x="-24" y="-48" width="48" height="94" rx="6" fill="#BFE6FF" />
        <path d="M-12 -20H12M-12 -6H12M-12 8H4" stroke="#2E6BE6" stroke-width="3.4" stroke-linecap="round" opacity="0.7" />
      </g>
      <circle cx="318" cy="300" r="76" fill="#7FE3FF" opacity="0.12" />
      <path d="M84 236l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFF3C4" opacity="0.75" />
      <path d="M246 84l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#EAF4FF" opacity="0.6" />
    </g>

    <!-- ══════════ 首屏：闪光 ══════════ -->
    <g v-if="scene === 'hero' && layer === 'front'">
      <g fill="#FFFFFF" opacity="0.9">
        <path d="M76 118l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
        <path d="M326 84l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path d="M302 322l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" opacity="0.7" />
      </g>
      <g fill="#FFD84D" opacity="0.9">
        <path d="M58 286l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </g>
    </g>
  </g>
</template>