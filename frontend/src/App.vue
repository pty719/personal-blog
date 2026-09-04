<!-- 根组件：所有页面的"外壳"（第 3 个读）
     结构：顶部导航栏（所有页面共用） + 中间路由出口（当前 URL 对应的页面）
     阅读顺序：main.js -> 本文件 -> router/index.js -> views/
     样式：Editorial（编辑杂志风）—— 米底 #F9F8F6、柔和黑 #1C1C1C、无圆角/阴影；
           暖沙 #D4A373 仅用于激活路由文字（全站唯一彩色），hover 下划线为柔和黑。
     逻辑（menu 数组 / router-link 遍历 / 路由出口 / 页脚）与原版一致，仅改样式。 -->
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
  { text: 'AI 新闻', path: '/ai-news' },        // AI 资讯自动采集
]
</script>

<template>
  <!-- 导航栏：Editorial —— 单色、细下边框、字距拉开；hover 时滑出下划线 -->
  <nav class="sticky top-0 z-30 bg-background border-b border-foreground/10">
    <div class="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between gap-x-8 gap-y-3 py-5 md:py-6 flex-wrap">
      <!-- Logo：衬线 + 拉开字距（原文案，仅作站名展示） -->
      <span class="font-serif font-normal text-lg md:text-xl tracking-[0.2em] text-foreground">
        yizhiyu的小站
      </span>
      <!-- 菜单：无衬线小号 + 字距，透明层级给次级感 -->
      <div class="flex items-center gap-5 md:gap-8 font-sans text-xs md:text-sm tracking-[0.15em] md:tracking-[0.2em]">
        <router-link
          v-for="item in menu"
          :key="item.path"
          :to="item.path"
          class="nav-link"
        >
          {{ item.text }}
        </router-link>
      </div>
    </div>
  </nav>

  <!-- 路由出口：当前 URL 对应的页面组件渲染在这里（内容栏居中对称） -->
  <main class="px-6 md:px-12 pt-12 md:pt-16 pb-24 md:pb-32">
    <div class="max-w-4xl mx-auto min-h-[calc(100vh-12rem)]">
      <router-view />
    </div>
  </main>

  <footer class="border-t border-foreground/10 py-10 px-6">
    <p class="text-center font-sans text-xs tracking-[0.15em] text-foreground/40">
      © 2026 小站 · FastAPI + Vue3 求职作品
    </p>
  </footer>
</template>

<style scoped>
/* scoped：这里的样式只作用于本组件，不会污染其他页面 */

/* 导航链接：hover 时细线从右往左滑出（Editorial hover-underline），
   激活项（路由完全匹配）常驻下划线 + 加深 */
.nav-link {
  position: relative;
  padding: 2px 0;
  color: var(--color-foreground);
  opacity: 0.6;                       /* = text-foreground/60 */
  font-weight: 500;                   /* 导航菜单字重 */
  text-decoration: none;
  transition: opacity 0.4s ease;
}
.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--color-foreground); /* hover/激活下划线均为柔和黑（单色反馈） */
  transform: scaleX(0);
  transform-origin: right center;      /* 默认从右端收缩到无 */
  transition: transform 0.4s ease;
}
.nav-link:hover {
  opacity: 1;                          /* hover 文字加深，下划线滑出 */
}
.nav-link.router-link-exact-active {
  opacity: 1;
  color: var(--color-primary);         /* 全站唯一彩色：当前激活路由文字 */
}
.nav-link:hover::after,
.nav-link.router-link-exact-active::after {
  transform: scaleX(1);
  transform-origin: left center;       /* 悬停/激活时从右往左铺开 */
}
</style>
