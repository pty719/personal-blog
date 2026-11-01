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
        <p class="font-sans text-xs md:text-sm tracking-[0.12em] text-foreground/60 mt-5">
          {{ article.category }}
          <template v-if="article.tags"> · {{ article.tags }}</template>
          · {{ article.views }} 次浏览 · {{ (article.created_at || '').slice(0, 10) }}
        </p>
      </header>

      <div
        v-if="article.summary"
        class="mt-8 pt-5 border-t border-foreground/20 font-serif italic text-lg leading-8 text-foreground/80"
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
