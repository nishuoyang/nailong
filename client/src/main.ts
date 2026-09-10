import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import './style.css'

// 注意：Element Plus 已改为按需引入（见 vite.config.ts 的 Components/AutoImport 插件），
// 这里不要再 `app.use(ElementPlus)`，也不要再 `import 'element-plus/dist/index.css'`，
// 否则会把全量组件与 349 KB 样式重新打回包里。

// vue-query 默认值：此前未配置，全部查询都在用库默认的 staleTime: 0，
// 导致每次组件挂载（即每次路由切换回来）以及每次窗口重新获得焦点都会重新发请求。
// 对图片展示站来说，列表数据在几十秒内变化极小，配合管理端已有的
// invalidateQueries（会强制刷新，不受 staleTime 影响），缓存 60s 是安全的。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // 切回标签页不再无条件重刷；数据过期时仍会按 staleTime 规则刷新
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
