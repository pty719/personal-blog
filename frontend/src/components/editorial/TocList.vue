<script setup>
defineProps({
  items: { type: Array, required: true },
  activeId: { type: String, default: '' },
})
</script>

<template>
  <ul class="toc-list">
    <li
      v-for="item in items"
      :key="item.id"
      :class="{ 'toc-item--sub': item.level === 3 }"
    >
      <a
        :href="'#' + item.id"
        :class="{ 'toc-link--active': item.id === activeId }"
      >
        {{ item.text }}
      </a>
    </li>
  </ul>
</template>

<style scoped>
.toc-list { list-style: none; }
.toc-list li + li { margin-top: 0.35rem; }
.toc-list a {
  display: block;
  padding-left: 0.5rem;
  border-left: 1px solid transparent;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  line-height: 1.6;
  color: rgba(28, 28, 28, 0.7);
  transition: color 0.15s ease, border-color 0.15s ease;
}
.toc-list a:hover { color: var(--color-foreground); }
.toc-link--active {
  color: var(--color-primary-ink);
  border-left-color: var(--color-primary);
}
.toc-item--sub a { padding-left: 1.25rem; }
</style>
