<script setup>
import { usePagedList } from '../composables/usePagedList'
import ArticleRow from '../components/editorial/ArticleRow.vue'
import StateBlock from '../components/editorial/StateBlock.vue'
import PaginationBar from '../components/editorial/PaginationBar.vue'

const { items, page, total, totalPages, loading, error, goTo } = usePagedList('/api/articles', {
  pageSize: 10,
})

function changePage(target) {
  goTo(target)
  window.scrollTo(0, 0)
}
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between gap-6 pb-5 border-b border-foreground/10">
      <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">文章列表</h2>
      <p v-if="!loading && !error" class="font-sans text-xs tracking-[0.15em] text-foreground/60">
        共 {{ total }} 篇
      </p>
    </div>

    <StateBlock
      v-if="loading || error || items.length === 0"
      :state="loading ? 'loading' : error ? 'error' : 'empty'"
      :message="error || '暂无文章'"
    />

    <ul v-else class="list-none mt-2">
      <li v-for="article in items" :key="article.id">
        <ArticleRow
          :to="'/articles/' + article.id"
          :title="article.title"
          :summary="article.summary"
          :meta="`${article.category} · ${article.views} 次浏览 · ${(article.created_at || '').slice(0, 10)}`"
        />
      </li>
    </ul>

    <PaginationBar
      :page="page"
      :total-pages="totalPages"
      @update:page="changePage"
    />
  </section>
</template>
