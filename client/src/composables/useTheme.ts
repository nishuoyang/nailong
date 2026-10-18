import { ref } from 'vue'

type Theme = 'light' | 'dark'

const isDark = ref(false)
let initialized = false
let explicit = false

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isDark.value ? '#14110d' : '#f3ede1')
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const stored = localStorage.getItem('theme')
  explicit = stored === 'dark' || stored === 'light'
  isDark.value = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
  apply()
  if (!explicit) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      if (!explicit) {
        isDark.value = event.matches
        apply()
      }
    })
  }
}

function setTheme(theme: Theme) {
  explicit = true
  isDark.value = theme === 'dark'
  localStorage.setItem('theme', theme)
  apply()
}

function toggleTheme() {
  setTheme(isDark.value ? 'light' : 'dark')
}

export function useTheme() {
  init()
  return { isDark, setTheme, toggleTheme }
}
