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
import { useRoute } from 'vue-router'

const route = useRoute()

// 详情页（/articles/9）也算「文章」激活：扁平路由没有父子关系，手动判断前缀
function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

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
  <a href="#main-content" class="skip-link">跳到主要内容</a>

  <!-- 导航栏：Editorial —— 单色、细下边框、字距拉开；hover 时滑出下划线 -->
  <nav class="sticky top-0 z-30 bg-background border-b border-foreground/10" aria-label="主导航">
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
          :class="{ 'nav-link--active': isActive(item.path) }"
        >
          {{ item.text }}
        </router-link>
      </div>
    </div>
  </nav>

  <!-- 路由出口：当前 URL 对应的页面组件渲染在这里（内容栏居中对称） -->
  <main id="main-content" tabindex="-1" class="px-6 md:px-12 pt-12 md:pt-16 pb-24 md:pb-32">
    <div :class="[route.meta.wide ? 'max-w-6xl' : 'max-w-4xl', 'mx-auto min-h-[calc(100vh-12rem)]']">
      <router-view />
    </div>
  </main>
</template>

<style scoped>
/* 跳转链接：键盘用户按 Tab 第一下即可跳过导航 */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 50;
  padding: 0.75rem 1rem;
  background: var(--color-foreground);
  color: var(--color-background);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  letter-spacing: 0.1em;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
}

/* 导航链接：hover 时细线从右往左滑出（Editorial hover-underline），
   激活项（含详情页等子路径）常驻下划线 + 加深 */
.nav-link {
  position: relative;
  padding: 2px 0;
  color: var(--color-foreground);
  opacity: 0.7;                       /* = text-foreground/70 */
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
.nav-link--active {
  opacity: 1;
  color: var(--color-primary-ink);     /* 加深的暖沙：文字对比度 ≥4.5:1 */
}
.nav-link:hover::after,
.nav-link--active::after {
  transform: scaleX(1);
  transform-origin: left center;       /* 悬停/激活时从右往左铺开 */
}
</style>
