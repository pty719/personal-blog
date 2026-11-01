<script setup>
defineProps({
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  variant: { type: String, default: 'solid' }, // solid | ghost
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['btn-editorial', variant === 'ghost' ? 'btn-editorial--ghost' : '']"
  >
    <slot />
  </button>
</template>
