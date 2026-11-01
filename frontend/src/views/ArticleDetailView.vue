<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import { apiGet } from '../lib/publicApi'
import StateBlock from '../components/editorial/StateBlock.vue'

const route = useRoute()
const article = ref(null)
const related = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    article.value = await apiGet(`/api/articles/${route.params.id}`)
    // 相关文章是增强信息：失败时静默忽略，不影响正文
    apiGet(`/api/articles/${route.params.id}/related`)
      .then((data) => { related.value = data || [] })
      .catch(() => { related.value = [] })
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
      <header class="article-cover">
        <div class="article-cover-inner">
          <h1 class="article-title font-serif font-light tracking-tight text-3xl md:text-5xl leading-[1.15]">
            {{ article.title }}
          </h1>
          <p class="article-meta font-sans text-xs md:text-sm tracking-[0.12em]">
            <span class="folio">NO. {{ String(article.id).padStart(2, '0') }}</span>
            <span class="meta-slash mx-2">/</span>
            {{ article.category }}
            <template v-if="article.tags"> · {{ article.tags }}</template>
            · {{ article.views }} 次浏览 · {{ (article.created_at || '').slice(0, 10) }}
          </p>
          <div
            v-if="article.summary"
            class="article-standfirst font-serif italic text-lg leading-8"
          >
            {{ article.summary }}
          </div>
        </div>
      </header>

      <div class="prose-editorial mt-10" v-html="marked.parse(article.content)"></div>

      <section v-if="related.length" class="mt-14 pt-8 border-t border-foreground/10">
        <h2 class="font-serif text-xl md:text-2xl font-light tracking-tight">相关文章</h2>
        <ul class="list-none mt-3">
          <li v-for="r in related" :key="r.id">
            <router-link
              :to="'/articles/' + r.id"
              class="block py-4 border-b border-foreground/10 group"
            >
              <span class="font-serif text-lg leading-7 group-hover:underline decoration-foreground/40 underline-offset-4">
                {{ r.title }}
              </span>
              <span v-if="r.summary" class="block font-sans text-sm text-foreground/70 mt-1 line-clamp-1">
                {{ r.summary }}
              </span>
            </router-link>
          </li>
        </ul>
      </section>

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
/* 深墨封面带：全宽出血，标题、元信息与导语反白 */
.article-cover {
  margin-inline: calc(50% - 50vw);
  margin-top: -48px;              /* 抵消 App main 的 pt-12，贴住导航下沿 */
  padding: 72px max(24px, calc(50vw - 28rem)) 64px;
  background: var(--color-ink-deep);
  color: var(--color-background);
  border-bottom: 1px solid rgba(212, 163, 115, 0.55);
}
.article-cover-inner {
  max-width: 56rem;
  margin: 0 auto;
}

.article-title { color: var(--color-background); }
.article-meta {
  margin-top: 1.25rem;
  color: rgba(249, 248, 246, 0.7);
}
.meta-slash { color: rgba(249, 248, 246, 0.25); }

/* 刊物页码：真实文章 id，在深墨场上用暖沙 */
.folio {
  font-family: var(--font-serif);
  color: var(--color-primary);
  letter-spacing: 0.08em;
}

/* 导语：顶部细线 + 大引号，像杂志的开口引文 */
.article-standfirst {
  position: relative;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(249, 248, 246, 0.2);
  color: rgba(249, 248, 246, 0.84);
}
.article-standfirst::before {
  content: "“";
  position: absolute;
  left: -1.4rem;
  top: -0.35rem;
  font-family: var(--font-serif);
  font-size: 2.5rem;
  line-height: 1;
  color: var(--color-primary);
}

@media (min-width: 768px) {
  .article-cover { margin-top: -64px; }  /* 抵消 App main 的 md:pt-16 */
}
@media (max-width: 767px) {
  .article-cover { padding: 56px 24px 48px; }
  .article-standfirst::before { display: none; }
}
</style>
