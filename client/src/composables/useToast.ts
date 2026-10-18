import { reactive } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seed = 0

function push(message: string, type: ToastItem['type'] = 'info', duration = 2800) {
  const id = ++seed
  state.items.push({ id, message, type })
  window.setTimeout(() => {
    const idx = state.items.findIndex((t) => t.id === id)
    if (idx >= 0) state.items.splice(idx, 1)
  }, duration)
}

export function useToast() {
  return {
    state,
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error', 3800),
    info: (m: string) => push(m, 'info'),
    warning: (m: string) => push(m, 'warning', 3400),
  }
}
