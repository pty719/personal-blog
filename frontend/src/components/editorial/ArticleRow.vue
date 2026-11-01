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
    <h3 class="font-serif font-normal tracking-tight text-xl md:text-2xl leading-snug group-hover:italic transition-all duration-500">
      {{ title }}
    </h3>
    <p v-if="summary" class="font-sans text-base md:text-lg leading-8 text-foreground/90 mt-2">
      {{ summary }}
    </p>
    <p v-if="meta" class="font-sans text-sm text-foreground/60 mt-2">{{ meta }}</p>
  </router-link>
</template>
