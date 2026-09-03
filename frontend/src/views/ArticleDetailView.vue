<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'   // Markdown 渲染库：把 # 标题等语法转成 HTML

// useRoute：拿到当前 URL 的路由信息（里面有 :id 参数）
const route = useRoute()
const article = ref(null)    // 文章数据（初始 null = 还没加载）
const error = ref('')

onMounted(async () => {
  try {
    // route.params.id = URL 里的文章 id（字符串），拼进请求
    const res = await fetch(`/api/articles/${route.params.id}`)
    if (!res.ok) throw new Error('文章不存在（' + res.status + '）')
    article.value = await res.json()
  } catch (e) {
    error.value = '加载失败：' + e.message
  }
})
</script>

<template>
  <div v-if="error" class="error">{{ error }}</div>

  <!-- v-else-if：article 加载出来才渲染（null 时不渲染，避免 undefined 报错） -->
  <article v-else-if="article">
    <h1>{{ article.title }}</h1>
    <div class="meta">
      {{ article.category }} · {{ article.tags }} · {{ article.views }} 次浏览 ·
      {{ article.created_at.slice(0, 10) }}
    </div>
    <!-- AI 生成的摘要（有值才显示） -->
    <div v-if="article.summary" class="summary">📝 {{ article.summary }}</div>
    <!-- v-html：把 Markdown 渲染后的 HTML 塞进页面（marked.parse 转换） -->
    <div class="content" v-html="marked.parse(article.content)"></div>
  </article>

  <p v-else>加载中...</p>
</template>

<style scoped>
.meta { color: #9ca3af; font-size: 14px; margin: 12px 0 24px; }
.summary {
  background: #eff6ff; color: #1d4ed8; border-left: 4px solid #2563eb;
  padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; line-height: 1.7;
}
.content { line-height: 1.9; background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; }
.error { color: #dc2626; }
</style>
