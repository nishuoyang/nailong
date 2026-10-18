import type { Directive } from 'vue'

/**
 * v-reveal — a one-shot IntersectionObserver entrance.
 * Usage: v-reveal or v-reveal="{ delay: 120 }". Honours reduced motion.
 */
export const reveal: Directive<HTMLElement, { delay?: number } | undefined> = {
  mounted(el, binding) {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in')
      return
    }
    el.classList.add('reveal')
    el.style.setProperty('--reveal-delay', (binding.value?.delay ?? 0) + 'ms')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-in')
            io.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(el)
    ;(el as any).__revealIO = io
  },
  unmounted(el) {
    ;(el as any).__revealIO?.disconnect?.()
  },
}
