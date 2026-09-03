<!-- 根组件：所有页面的"外壳"（第 3 个读）
     结构：顶部导航栏（所有页面共用） + 中间路由出口（当前 URL 对应的页面）
     阅读顺序：main.js -> 本文件 -> router/index.js -> views/ -->
<script setup>
// script setup：Vue 3 的推荐写法，这里的 JS 逻辑会绑定到下面的模板
// ref() 创建"响应式数据"：值变了，页面自动更新
import { ref } from 'vue'

// 导航菜单：数组里每项 = 一个菜单项（text 显示文字，path 跳转地址）
// Week 2 每做一个新页面，就往这里加一项
const menu = [
  { text: '首页', path: '/' },
  { text: '文章', path: '/articles' },
  { text: '说说', path: '/moments' },
  { text: '友链', path: '/friends' },
  { text: '项目', path: '/projects' },
  { text: 'AI 伴侣', path: '/ai-partner' },
  { text: 'AI 助手', path: '/ai-assistant' },   // 站内 AI 助手（Agent）
]
</script>

<template>
  <!-- 导航栏：遍历 menu 数组生成链接，点击跳转对应路由 -->
  <nav class="navbar">
    <span class="logo">yizhiyu的小站</span>
    <router-link v-for="item in menu" :key="item.path" :to="item.path" class="nav-link">
      {{ item.text }}
    </router-link>
  </nav>

  <!-- 路由出口：当前 URL 对应的页面组件渲染在这里 -->
  <main class="content">
    <router-view />
  </main>

  <footer class="footer">© 2026 小站 · FastAPI + Vue3 求职作品</footer>
</template>

<style scoped>
/* scoped：这里的样式只作用于本组件，不会污染其他页面 */
.navbar {
  display: flex;             /* 横向排列 */
  align-items: center;
  gap: 20px;                 /* 菜单项间距 */
  padding: 14px 24px;
  background: #1f2937;       /* 深色导航栏 */
  color: #fff;
}
.logo { font-weight: bold; font-size: 20px; }
.nav-link { color: #d1d5db; text-decoration: none; }   /* 去掉下划线 */
.nav-link:hover { color: #fff; }                        /* 鼠标悬停变亮 */
.content { min-height: calc(100vh - 110px); padding: 24px; max-width: 900px; margin: 0 auto; }
.footer { text-align: center; color: #9ca3af; padding: 16px; font-size: 14px; }
</style>
