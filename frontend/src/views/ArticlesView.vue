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
  <h2>文章列表</h2>

  <!-- ③ 三个状态：加载中 / 出错 / 空列表，用 v-if 逐个判断 -->
  <p v-if="loading">加载中...</p>
  <p v-else-if="error">{{ error }}</p>
  <p v-else-if="articles.length === 0">暂无文章</p>

  <!-- ④ v-for 遍历真实数据，:key 用 article.id（后端返回的唯一 id） -->
  <ul v-else>
    <li v-for="article in articles" :key="article.id" class="article-item">
      <router-link :to="`/articles/${article.id}`" class="article-link">
        <div class="article-title">{{ article.title }}</div>
        <div class="article-summary">{{ article.summary }}</div>
        <div class="article-meta">
        {{ article.category }} · {{ article.views }} 次浏览 ·
        {{ article.created_at.slice(0, 10) }}   <!-- 日期只取前 10 位（YYYY-MM-DD） -->
      </div>
      </router-link>
    </li>
  </ul>
</template>

<style scoped>
.article-item {
  list-style: none;
  padding: 16px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.article-title { font-size: 18px; font-weight: bold; }
.article-summary { color: #6b7280; margin: 6px 0; }
.article-meta { color: #9ca3af; font-size: 13px; }
.article-link { text-decoration: none; color: inherit; display: block; }
.article-link:hover .article-title { color: #2563eb; }   /* 悬停变蓝 */
</style>
