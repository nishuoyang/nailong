import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Element Plus has been fully replaced by the local UI kit (AppIcon / UiButton /
    // UiModal / …). Keeping the resolver plugins would still install and scan the
    // whole component library for nothing, so they were removed with it.
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
    // 编辑器/工具常把临时文件落在源码目录里，Windows 上被 watch 到会 EBUSY 崩溃。
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmp'],
    },
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
        // img-src 必须允许 blob:，与 server/src/main.ts 下发的生产 CSP 保持一致：
        // 投稿页与头像上传都用 URL.createObjectURL() 生成本地预览图，
        // 少了这一项，开发环境（:5173）里选完图会直接报「这个文件不是能识别的图片」。
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:3000; frame-src https://player.bilibili.com; frame-ancestors 'none';",
    },
  },
})