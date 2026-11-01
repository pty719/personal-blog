<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
})
const emit = defineEmits(['update:page'])

function go(target) {
  if (target < 1 || target > props.totalPages || target === props.page) return
  emit('update:page', target)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="flex flex-wrap items-center justify-center gap-1 mt-10" aria-label="分页">
    <button class="pag-btn" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
    <button
      v-for="p in totalPages"
      :key="p"
      class="pag-btn"
      :class="{ 'pag-btn--active': p === page }"
      :aria-current="p === page ? 'page' : undefined"
      @click="go(p)"
    >
      {{ p }}
    </button>
    <button class="pag-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
  </nav>
</template>

<style scoped>
.pag-btn {
  min-width: 2.25rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(28, 28, 28, 0.2);
  border-radius: 0;
  background: transparent;
  color: rgba(28, 28, 28, 0.7);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.pag-btn:hover:not(:disabled) { border-color: rgba(28, 28, 28, 0.5); color: var(--color-foreground); }
.pag-btn--active { border-color: var(--color-foreground); color: var(--color-foreground); }
.pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
