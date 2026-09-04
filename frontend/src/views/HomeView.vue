<!-- 首页组件 v2：门户页
     结构：博主介绍（hero）→ AI 助手大入口 → 最新文章 / 最新说说 / AI 新闻速递
     数据：全部来自后端公开接口（/api/articles、/api/moments、/api/ai-news）
     容错：任一接口挂了不影响其他区块（各自 try/catch） -->
<script setup>
import { onMounted, ref } from 'vue'

const articles = ref([])     // 最新文章（前 3 篇）
const moments = ref([])      // 最新说说（前 3 条）
const aiNews = ref([])       // AI 新闻（前 3 条，功能上线后才有数据）
const failed = ref([])       // 记录哪个接口失败（调试用）

async function loadJson(url, target) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    // 列表接口统一返回 {items: [...]} 结构
    target.value = (data.items || []).slice(0, 3)
  } catch (e) {
    failed.value.push(url + '：' + e.message)
  }
}

onMounted(() => {
  loadJson('/api/articles', articles)
  loadJson('/api/moments', moments)
  loadJson('/api/ai-news', aiNews)
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 md:px-12">
    <!-- ========== 博主介绍（hero）========== -->
    <section class="py-20 md:py-28 border-b border-foreground/10">
      <p class="font-sans text-xs md:text-sm text-foreground/40 tracking-[0.25em]">你好，我是</p>
      <h1 class="font-serif font-light tracking-tight text-5xl md:text-6xl leading-[1.05] mt-4">
        yizhiyu
      </h1>
      <p class="font-sans text-base md:text-lg text-foreground/90 max-w-xl mt-6 leading-8">
        智能体应用开发者（求职中）—— 用 Python 构建会思考、能检索、懂记忆的 AI 应用。
        这个站点的 AI 助手能调用站内工具、RAG 检索知识库、记住对话上下文。
      </p>
      <div class="mt-10 flex items-center gap-6">
        <router-link
          to="/ai-assistant"
          class="inline-block border border-foreground px-6 py-3 font-sans text-sm tracking-[0.15em] hover:bg-foreground hover:text-background transition-colors"
        >
          和 AI 助手聊聊 →
        </router-link>
        <router-link
          to="/articles"
          class="font-sans text-sm tracking-[0.15em] border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
        >
          阅读文章
        </router-link>
      </div>
    </section>

    <!-- ========== 最新文章 ========== -->
    <section class="py-14 md:py-16 border-b border-foreground/10">
      <div class="flex items-baseline justify-between">
        <h2 class="font-serif text-2xl md:text-3xl font-light">最新文章</h2>
        <router-link to="/articles" class="font-sans text-xs tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors">
          全部 →
        </router-link>
      </div>
      <div class="mt-8 space-y-6">
        <router-link
          v-for="a in articles"
          :key="a.id"
          :to="'/articles/' + a.id"
          class="block group"
        >
          <h3 class="font-serif text-lg md:text-xl leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
            {{ a.title }}
          </h3>
          <p v-if="a.summary" class="font-sans text-sm text-foreground/60 leading-6 mt-1 line-clamp-2">
            {{ a.summary }}
          </p>
          <p class="font-sans text-xs text-foreground/40 mt-2">
            {{ (a.created_at || '').slice(0, 10) }}
          </p>
        </router-link>
        <p v-if="!articles.length" class="font-sans text-sm text-foreground/40">
          暂无文章
        </p>
      </div>
    </section>

    <!-- ========== 最新说说 ========== -->
    <section class="py-14 md:py-16 border-b border-foreground/10">
      <div class="flex items-baseline justify-between">
        <h2 class="font-serif text-2xl md:text-3xl font-light">最新说说</h2>
        <router-link to="/moments" class="font-sans text-xs tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors">
          全部 →
        </router-link>
      </div>
      <div class="mt-8 space-y-6">
        <div v-for="m in moments" :key="m.id" class="border-l border-foreground/20 pl-6">
          <p class="font-sans text-sm md:text-base leading-7 text-foreground/90 whitespace-pre-wrap">
            {{ m.content }}
          </p>
          <p class="font-sans text-xs text-foreground/40 mt-2">
            {{ (m.created_at || '').slice(0, 10) }}
          </p>
        </div>
        <p v-if="!moments.length" class="font-sans text-sm text-foreground/40">
          暂无说说
        </p>
      </div>
    </section>

    <!-- ========== AI 新闻速递 ========== -->
    <section class="py-14 md:py-16">
      <div class="flex items-baseline justify-between">
        <h2 class="font-serif text-2xl md:text-3xl font-light">AI 新闻速递</h2>
        <router-link to="/ai-news" class="font-sans text-xs tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors">
          全部 →
        </router-link>
      </div>
      <p class="font-sans text-sm text-foreground/60 mt-3">
        自动采集的 AI 领域最新资讯（每 6 小时更新）
      </p>
      <div class="mt-8 space-y-6">
        <a
          v-for="n in aiNews"
          :key="n.id"
          :href="n.url"
          target="_blank"
          rel="noopener"
          class="block group"
        >
          <div class="flex items-baseline gap-3">
            <h3 class="font-serif text-lg leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
              {{ n.title }}
            </h3>
            <span class="font-sans text-xs text-foreground/40 shrink-0">{{ n.source }}</span>
          </div>
          <p v-if="n.summary" class="font-sans text-sm text-foreground/60 leading-6 mt-1 line-clamp-2">
            {{ n.summary }}
          </p>
          <p class="font-sans text-xs text-foreground/40 mt-2">
            {{ (n.published_at || '').slice(0, 10) }}
          </p>
        </a>
        <p v-if="!aiNews.length" class="font-sans text-sm text-foreground/40">
          AI 新闻采集即将上线…
        </p>
      </div>
    </section>
  </div>
</template>
