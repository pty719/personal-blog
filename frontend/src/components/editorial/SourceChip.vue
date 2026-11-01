<script setup>
defineProps({
  label: { type: String, default: '' },
})
</script>

<template>
  <span class="inline-block px-2 py-0.5 border border-foreground/20 font-sans text-xs tracking-[0.15em] text-foreground/70">
    {{ label }}
  </span>
</template>
