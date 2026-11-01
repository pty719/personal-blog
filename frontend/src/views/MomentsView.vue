<script setup>
import { usePagedList } from '../composables/usePagedList'
import SectionHeader from '../components/editorial/SectionHeader.vue'
import StateBlock from '../components/editorial/StateBlock.vue'
import PaginationBar from '../components/editorial/PaginationBar.vue'

const { items, page, total, totalPages, loading, error, goTo } = usePagedList('/api/moments', {
  pageSize: 10,
})

function changePage(target) {
  goTo(target)
  window.scrollTo(0, 0)
}
</script>

<template>
  <section>
    <SectionHeader title="说说列表">
      <template #aside>
        <p v-if="!loading && !error" class="font-sans text-xs tracking-[0.15em] text-foreground/70">
          共 {{ total }} 条
        </p>
      </template>
    </SectionHeader>

    <StateBlock
      v-if="loading || error || items.length === 0"
      :state="loading ? 'loading' : error ? 'error' : 'empty'"
      :message="error || '暂无说说'"
    />

    <div v-else class="mt-2">
      <article
        v-for="moment in items"
        :key="moment.id"
        class="border-l-2 border-foreground/10 pl-5 md:pl-8 py-7"
      >
        <p class="font-sans text-base md:text-lg leading-8 text-foreground/90 whitespace-pre-wrap">
          {{ moment.content }}
        </p>
        <div v-if="moment.images" class="mt-4">
          <img
            :src="moment.images.split(',')[0]"
            loading="lazy"
            decoding="async"
            class="w-full max-h-80 object-cover border border-foreground/10"
            alt="说说配图"
          />
        </div>
        <p class="mt-3 font-sans text-xs tracking-[0.12em] text-foreground/70">
          {{ (moment.created_at || '').slice(0, 10) }}
        </p>
      </article>
    </div>

    <PaginationBar
      :page="page"
      :total-pages="totalPages"
      @update:page="changePage"
    />
  </section>
</template>
