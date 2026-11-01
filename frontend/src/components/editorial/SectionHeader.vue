<script setup>
defineProps({
  title: { type: String, required: true },
  to: { type: [String, Object], default: '' },
  linkText: { type: String, default: '全部 →' },
})
</script>

<template>
  <div class="flex items-baseline justify-between gap-6 pb-5 border-b border-foreground/10">
    <div class="flex min-w-0 items-baseline gap-4">
      <span class="section-mark" aria-hidden="true"></span>
      <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">{{ title }}</h2>
    </div>
    <div class="flex shrink-0 items-baseline gap-5">
      <slot name="aside" />
      <router-link
        v-if="to"
        :to="to"
        class="font-sans text-xs tracking-[0.2em] text-foreground/70 hover:text-foreground transition-colors"
      >
        {{ linkText }}
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.section-mark {
  display: block;
  width: 2.5rem;
  height: 1px;
  flex-shrink: 0;
  background: var(--color-primary);
}
@media (max-width: 767px) {
  .section-mark { width: 1.5rem; }
}
</style>
