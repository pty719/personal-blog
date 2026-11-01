<script setup>
defineProps({
  to: { type: [String, Object], required: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  meta: { type: String, default: '' },
})
</script>

<template>
  <router-link
    :to="to"
    class="group block border-l-2 border-foreground/10 hover:border-foreground/40 py-6 pl-5 md:pl-8 pr-2 hover:bg-foreground/5 transition-colors no-underline text-inherit"
  >
    <h3 class="font-serif font-normal tracking-tight text-xl md:text-2xl leading-snug">
      <span class="article-title">{{ title }}</span>
    </h3>
    <p v-if="summary" class="font-sans text-base md:text-lg leading-8 text-foreground/90 mt-2">
      {{ summary }}
    </p>
    <p v-if="meta" class="font-sans text-sm text-foreground/70 mt-2">{{ meta }}</p>
  </router-link>
</template>

<style scoped>
/* 标记式 hover：Warm Sand 从左侧扫过标题，替代整行变色 */
.article-title {
  background-image: linear-gradient(
    transparent 60%,
    rgba(212, 163, 115, 0.26) 60%,
    rgba(212, 163, 115, 0.26) 90%,
    transparent 90%
  );
  background-repeat: no-repeat;
  background-size: 0% 100%;
  padding-bottom: 0.05em;
  transition: background-size 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
}
a:hover .article-title {
  background-size: 100% 100%;
}
</style>
