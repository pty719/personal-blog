// 前端入口：整个 Vue 应用的启动点（第 1 个读）
// 阅读顺序：index.html -> vite.config.js -> 本文件 -> src/App.vue -> src/router/index.js -> src/views/
import { createApp } from 'vue'
import App from './App.vue'          // 根组件（所有页面的"外壳"）
import router from './router'        // 路由配置（URL 和页面的对应关系）
import './style.css'                 // 全局样式

// 创建 Vue 应用 -> 挂上路由 -> 渲染到 index.html 的 #app 里
createApp(App).use(router).mount('#app')
