import { ref } from 'vue'

const isOpen = ref(false)
const seed = ref('')

export function useCommandPalette() {
  return {
    isOpen,
    seed,
    open(query = '') {
      seed.value = query
      isOpen.value = true
    },
    close() {
      isOpen.value = false
    },
    toggle() {
      isOpen.value = !isOpen.value
    },
  }
}
