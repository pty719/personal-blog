<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import { apiGet } from '../lib/publicApi'
import StateBlock from '../components/editorial/StateBlock.vue'

const route = useRoute()
const article = ref(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    article.value = await apiGet(`/api/articles/${route.params.id}`)
  } catch (e) {
    error.value = e.status === 404 ? '文章不存在。' : e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-col">
    <StateBlock v-if="loading" state="loading" message="加载文章…" />
    <StateBlock v-else-if="error" state="error" :message="error" />

    <article v-else-if="article">
      <header class="pb-8 border-b border-foreground/10">
        <h1 class="font-serif font-light tracking-tight text-3xl md:text-4xl leading-[1.15]">
          {{ article.title }}
        </h1>
        <p class="font-sans text-xs md:text-sm tracking-[0.12em] text-foreground/70 mt-5">
          <span class="folio">NO. {{ String(article.id).padStart(2, '0') }}</span>
          <span class="mx-2 text-foreground/20">/</span>
          {{ article.category }}
          <template v-if="article.tags"> · {{ article.tags }}</template>
          · {{ article.views }} 次浏览 · {{ (article.created_at || '').slice(0, 10) }}
        </p>
      </header>

      <div
        v-if="article.summary"
        class="standfirst mt-8 pt-5 border-t border-foreground/20 font-serif italic text-lg leading-8 text-foreground/80"
      >
        {{ article.summary }}
      </div>

      <div class="prose-editorial mt-10" v-html="marked.parse(article.content)"></div>

      <div class="mt-14 pt-6 border-t border-foreground/10">
        <router-link
          to="/articles"
          class="font-sans text-sm tracking-[0.15em] border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
        >
          ← 返回文章列表
        </router-link>
      </div>
    </article>
  </div>
</template>

<style scoped>
/* 刊物页码：真实文章 id，不是装饰序号 */
.folio {
  font-family: var(--font-serif);
  color: var(--color-primary-ink);
  letter-spacing: 0.08em;
}

/* 导语大引号：贴在摘要左上角，像杂志的开口引文 */
.standfirst { position: relative; }
.standfirst::before {
  content: "“";
  position: absolute;
  left: -1.4rem;
  top: -0.35rem;
  font-family: var(--font-serif);
  font-size: 2.5rem;
  line-height: 1;
  color: var(--color-primary);
}
@media (max-width: 767px) {
  .standfirst::before { display: none; }
}
</style>
