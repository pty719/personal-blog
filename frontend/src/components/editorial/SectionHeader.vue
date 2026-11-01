<script setup>
defineProps({
  title: { type: String, required: true },
  to: { type: [String, Object], default: '' },
  linkText: { type: String, default: '全部 →' },
})
</script>

<template>
  <div class="flex items-baseline justify-between gap-6 pb-5 border-b border-foreground/10">
    <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">{{ title }}</h2>
    <router-link
      v-if="to"
      :to="to"
      class="font-sans text-xs tracking-[0.2em] text-foreground/60 hover:text-foreground transition-colors"
    >
      {{ linkText }}
    </router-link>
  </div>
</template>
