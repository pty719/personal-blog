<!-- SelectionFlower 的 Vue 入口：DOM/Canvas 交互全部在 motion-runtime.ts -->
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createSelectionFlower } from './motion-runtime'

const props = defineProps({
  height: { type: Number, default: 720 },
  reducedMotion: { type: Boolean, default: undefined },
})

const host = ref(null)
let controller = null

function options() {
  const next = { height: props.height }
  if (props.reducedMotion !== undefined) next.reducedMotion = props.reducedMotion
  return next
}

onMounted(() => {
  if (!host.value) return
  controller = createSelectionFlower(host.value, options())
})

watch(
  () => [props.height, props.reducedMotion],
  () => {
    if (!controller) return
    controller.update({
      height: props.height,
      reducedMotion: props.reducedMotion,
    })
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
  <div ref="host" class="selection-flower-host" />
</template>

<style scoped>
.selection-flower-host {
  display: block;
  width: 100%;
}
</style>
