import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // ── Element Plus 按需引入 ──
    // 全量引入（app.use(ElementPlus) + element-plus/dist/index.css）会让首屏
    // 多出约 877 KB JS + 349 KB CSS，而全站只用到 19 个组件。这里改为按需：
    //   Components  → 模板中的 <el-*> 自动解析并注入「组件 + 对应样式」
    //   AutoImport  → 自动注入 ElMessage / ElMessageBox / ElNotification 等函数式 API
    // 注意：main.ts 里不要再 app.use(ElementPlus)，也不要再引入全量 index.css。
    // 生成的两个 d.ts 需要提交到仓库，否则 vue-tsc 在干净检出时会报未定义。
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // Rolldown（Vite 8）已废弃 rollupOptions/manualChunks，改用 rolldownOptions.output.codeSplitting。
    // 这里把「Vue 运行时生态」单独拆成 vendor-vue：
    // 它变更频率远低于业务代码，独立成块后业务代码发布不会使其 hash 失效，可长期命中强缓存。
    // 注意：不要把 element-plus 整体归入一个 group —— 那会把仅管理后台用到的
    // el-table / el-upload 等一并提升为首屏 eager 依赖，反而拖慢首屏。
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-vue',
              test: /node_modules[\\/](?:vue|vue-router|pinia|@vue[\\/](?:runtime-core|runtime-dom|reactivity|shared|compiler-core|compiler-dom))[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 图片走同源代理，与生产完全一致：
      // 数据库里存的是 /minio/{bucket}/{object} 这种同源相对路径，
      // 若开发环境不代理 /minio，<img src="/minio/..."> 会打到 Vite 上变成 404。
      // （早期开发库中存的是 http://localhost:9000 绝对地址，靠下面 CSP 的
      //  img-src http://localhost:9000 直连 —— 那条路径在生产会变成混合内容，已弃用。）
      '/minio': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3000; frame-src https://player.bilibili.com; frame-ancestors 'none';",
    },
  },
})
