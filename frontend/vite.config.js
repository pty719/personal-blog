// Vite 构建配置（前端项目的"总开关"）
// 阅读顺序：index.html -> 本文件 -> src/main.js -> src/App.vue -> src/router/index.js -> src/views/
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'   // Tailwind CSS v4 的 Vite 插件（自动扫描 .vue 里的 class）

export default defineConfig({
  // 让 Vite 认识 .vue 文件（Vue 插件，必须）+ 编译 Tailwind 工具类
  plugins: [vue(), tailwindcss()],

  server: {
    port: 5173,          // 开发服务器端口（浏览器访问 http://127.0.0.1:5173）
    proxy: {
      // 关键配置：把前端发出的 /api 请求转发给后端 8000 端口
      // 前端代码里统一写 fetch('/api/moments') 这种相对路径，
      // 开发时由 Vite 代理转发，部署时由 nginx 转发 —— 前端代码零改动
      '/api': 'http://127.0.0.1:8001',   // 本地后端端口（8000 已空闲，恢复默认）
    },
  },
})
