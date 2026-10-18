<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import SiteHeader from './SiteHeader.vue'
import SiteFooter from './SiteFooter.vue'
import MobileDock from './MobileDock.vue'
import CommandPalette from './CommandPalette.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useCommandPalette } from '@/composables/useCommandPalette'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const FeedbackDialog = defineAsyncComponent(() => import('./FeedbackDialog.vue'))
const showFeedback = ref(false)
const { toggle, isOpen } = useCommandPalette()

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    toggle()
    return
  }
  if (event.key === '/' && !isOpen.value && !isTypingTarget(event.target)) {
    event.preventDefault()
    toggle()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="grain relative flex min-h-dvh flex-col bg-paper text-ink">
    <SiteHeader />
    <main class="flex-1" :class="isAdmin ? '' : 'pb-24 lg:pb-0'">
      <slot />
    </main>
    <SiteFooter v-if="!isAdmin" @feedback="showFeedback = true" />
    <MobileDock v-if="!isAdmin" />
    <CommandPalette />
    <FeedbackDialog v-if="showFeedback" v-model="showFeedback" />
    <ToastHost />
  </div>
</template>