<!-- 把文字选区开花挂到真实文章内容上：Canvas 在正文后面，正文保持原排版 -->
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createSelectionFlower } from './motion-runtime'

const props = defineProps({
  reducedMotion: { type: Boolean, default: undefined },
})

const layer = ref(null)
const content = ref(null)
let controller = null

function options() {
  const next = { attachTo: content.value }
  if (props.reducedMotion !== undefined) next.reducedMotion = props.reducedMotion
  return next
}

onMounted(() => {
  if (!layer.value || !content.value) return
  controller = createSelectionFlower(layer.value, options())
})

watch(
  () => props.reducedMotion,
  (value) => {
    if (controller) controller.update({ reducedMotion: value })
  },
)

onBeforeUnmount(() => {
  if (controller) controller.destroy()
  controller = null
})

defineExpose({
  getState: () => (controller ? controller.getState() : null),
})
</script>

<template>
  <div class="selection-flower-scene">
    <div ref="layer" class="selection-flower-layer" aria-hidden="true" />
    <div ref="content" class="selection-flower-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.selection-flower-scene {
  position: relative;
  isolation: isolate;
  display: flow-root;
}

.selection-flower-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.selection-flower-content {
  position: relative;
  z-index: 1;
  background: transparent;
}

/* 正文使用压深后的可访问绿 #15803d（白字 5.02:1），花朵才会被完整遮在选区后面 */
.selection-flower-content :deep(::selection) {
  background: #15803d;
  color: #fff;
}
</style>
