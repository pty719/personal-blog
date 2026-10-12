<!-- AI 新闻页：自动采集的 AI 领域资讯列表
     数据：GET /api/ai-news（后端定时爬取 RSSHub 入库）
     交互：点击卡片 → 新窗口打开原文（target="_blank"） -->
<script setup>
import { onMounted, ref } from 'vue'

const news = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/api/ai-news')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    news.value = data.items || []
  } catch (e) {
    error.value = '新闻加载失败：' + e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-20">
    <p class="font-sans text-xs md:text-sm text-foreground/40 tracking-[0.25em]">自动采集 · 每 6 小时更新</p>
    <h1 class="font-serif font-light tracking-tight text-4xl md:text-5xl leading-[1.1] mt-4">
      AI 新闻
    </h1>

    <p v-if="loading" class="font-sans text-sm text-foreground/60 mt-10">加载中…</p>
    <p v-if="error" class="font-sans text-sm text-foreground/90 mt-10">{{ error }}</p>
    <p v-if="!loading && !error && !news.length" class="font-sans text-sm text-foreground/60 mt-10">
      暂无新闻——后端采集任务尚未上线或第一次抓取还没完成。
    </p>

    <!-- 新闻列表：日期分组简化为倒序列表 -->
    <div class="mt-12 border-t border-foreground/10">
      <a
        v-for="(n, idx) in news"
        :key="n.id || idx"
        :href="n.url"
        target="_blank"
        rel="noopener"
        class="block py-8 border-b border-foreground/10 group"
      >
        <div class="flex items-baseline gap-4">
          <span class="font-sans text-xs text-foreground/40 shrink-0">
            {{ (n.published_at || '').slice(0, 10) }}
          </span>
          <span class="font-sans text-xs tracking-[0.15em] text-foreground/40 border border-foreground/20 px-2 py-0.5 shrink-0">
            {{ n.source }}
          </span>
        </div>
        <h2 class="font-serif text-xl md:text-2xl leading-8 mt-3 group-hover:underline decoration-foreground/40 underline-offset-4">
          {{ n.title }}
        </h2>
        <p v-if="n.summary" class="font-sans text-sm text-foreground/60 leading-7 mt-3 max-w-3xl line-clamp-3">
          {{ n.summary }}
        </p>
      </a>
    </div>

    <!-- 合规声明：公开技术资讯聚合，非新闻信息服务（配合备案要求） -->
    <p class="font-sans text-xs text-foreground/40 leading-6 mt-12 pt-6 border-t border-foreground/10">
      本站「AI 技术资讯」为公开技术信息聚合：内容来自公开 RSS 源（Hacker News 等），版权归原作者所有，
      点击标题跳转原文。本站仅作技术资讯展示与学习交流，不提供新闻采编服务，不构成互联网新闻信息服务。
    </p>
  </div>
</template>
