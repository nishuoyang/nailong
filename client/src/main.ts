import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import { reveal } from './directives/reveal'
import './style.css'

// Element Plus is auto-imported per component (see vite.config.ts). Do not
// app.use(ElementPlus) here: it would pull the full 877 KB bundle into the shell.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const app = createApp(App)
app.directive('reveal', reveal)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
