<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'

const route = useRoute()

/**
 * 页面组件的复用键。
 *
 * 默认用 route.path，换路由就重建 —— 页面之间互不影响，这是想要的。
 * 但图片详情页是例外：同批图片左右切换只改 `:id`，语义上是「同一页换内容」。
 * 若仍按 path 做 key，整个详情页会被销毁重建（骨架屏 + 页面过渡 + 滚动位置丢失），
 * 看起来就像刷新了一次。这类路由固定用路由名当 key，让组件实例复用。
 */
const viewKey = computed(() => (route.name === 'image-detail' ? 'image-detail' : route.path))
</script>

<template>
  <AppLayout>
    <router-view v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="viewKey" />
      </Transition>
    </router-view>
  </AppLayout>
</template>
