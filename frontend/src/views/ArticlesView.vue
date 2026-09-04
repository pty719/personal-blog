<script setup>
import { ref, onMounted } from 'vue'

// ① 响应式数据：articles 存文章列表，loading 标记加载状态
const articles = ref([])
const loading = ref(true)          // 初始为 true：还没加载完
const error = ref('')              // 加载失败时存错误信息

// ② onMounted：组件挂载后自动执行 → 拉后端数据（每个页面的标准套路）
onMounted(async () => {
  try {
    // 走 Vite 代理：/api 自动转发到后端 8000（vite.config.js 里配的）
    const res = await fetch('/api/articles?page=1&page_size=10')
    const data = await res.json()
    articles.value = data.items    // 把后端返回的文章列表存入 ref
  } catch (e) {
    error.value = '加载失败：' + e.message + '（后端启动了吗？）'
  } finally {
    loading.value = false          // 无论成功失败，都结束加载状态
  }
})
</script>

<template>
  <section>
    <h2 class="font-serif font-normal tracking-tight text-2xl mb-8 md:mb-12">
      文章列表
    </h2>

    <!-- 三个状态：加载中 / 出错 / 空列表 -->
    <p v-if="loading" class="font-sans text-sm text-foreground/60">加载中...</p>
    <p v-else-if="error" class="font-sans text-sm text-foreground/60">{{ error }}</p>
    <p v-else-if="articles.length === 0" class="font-sans text-sm text-foreground/60">暂无文章</p>

    <!-- 时间线式列表：细左边框 + hover 浅灰 /5 底 + 大行距 -->
    <ul v-else class="list-none">
      <li v-for="article in articles" :key="article.id">
        <router-link
          :to="`/articles/${article.id}`"
          class="group no-underline text-inherit block border-l-2 border-foreground/10 hover:border-foreground/40 py-6 pl-5 md:pl-8 pr-2 bg-transparent hover:bg-foreground/5 transition-colors"
        >
          <h3 class="font-serif font-normal tracking-tight text-xl md:text-2xl leading-snug text-foreground group-hover:italic transition-all duration-500">
            {{ article.title }}
          </h3>
          <!-- 正文：text-lg + leading-8 -->
          <p class="font-sans text-lg leading-8 text-foreground/90 mt-2 mb-3">
            {{ article.summary }}
          </p>
          <!-- 元信息：辅助 text-sm /40 -->
          <p class="font-sans text-sm text-foreground/40 mt-1">
            {{ article.category }} · {{ article.views }} 次浏览 ·
            {{ article.created_at.slice(0, 10) }}
          </p>
        </router-link>
      </li>
    </ul>
  </section>
</template>
