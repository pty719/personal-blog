<script setup>
defineProps({
  state: { type: String, default: 'empty' }, // loading | error | empty
  message: { type: String, default: '' },
})
</script>

<template>
  <p
    v-if="state === 'loading'"
    class="font-sans text-sm text-foreground/60 py-6"
    role="status"
    aria-live="polite"
  >
    {{ message || '加载中…' }}
  </p>
  <p
    v-else-if="state === 'error'"
    class="font-sans text-sm text-foreground/90 py-6 border-l border-foreground/30 pl-4"
    role="alert"
  >
    {{ message || '加载失败，请稍后重试。' }}
  </p>
  <p v-else class="font-sans text-sm text-foreground/60 py-6" role="status">
    {{ message || '暂无内容' }}
  </p>
</template>
