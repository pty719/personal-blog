<!-- AsciiSharks 的 Vue 入口：只负责挂载/更新/销毁，所有交互在 motion-runtime.ts -->
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createAsciiSharks } from './motion-runtime'

const props = defineProps({
  theme: { type: String, default: 'light' },
  paused: { type: Boolean, default: false },
  speed: { type: Number, default: 1 },
  seed: { type: Number, default: 7 },
  fishCount: { type: Number, default: null },
  sharks: { type: Array, default: undefined },
  showComposer: { type: Boolean, default: true },
  height: { type: [Number, String], default: 880 },
  reducedMotion: { type: Boolean, default: undefined },
  onSubmit: { type: Function, default: null },
  onVoiceInput: { type: Function, default: null },
  variant: { type: String, default: 'default' },
})

const host = ref(null)
let controller = null

function buildOptions() {
  const options = {
    theme: props.theme,
    paused: props.paused,
    speed: props.speed,
    seed: props.seed,
    showComposer: props.showComposer,
    height: props.height,
    variant: props.variant,
    onSubmit: (payload) => {
      if (typeof props.onSubmit === 'function') props.onSubmit(payload)
    },
    onVoiceInput: typeof props.onVoiceInput === 'function'
      ? () => props.onVoiceInput()
      : null,
  }
  if (props.fishCount !== null && props.fishCount !== undefined) options.fishCount = props.fishCount
  if (Array.isArray(props.sharks) && props.sharks.length) options.sharks = props.sharks
  if (props.reducedMotion !== undefined) options.reducedMotion = props.reducedMotion
  return options
}

onMounted(() => {
  if (!host.value) return
  controller = createAsciiSharks(host.value, buildOptions())
})

watch(
  () => [props.theme, props.paused, props.speed, props.showComposer, props.height, props.reducedMotion, props.variant],
  () => {
    if (!controller) return
    controller.update({
      theme: props.theme,
      paused: props.paused,
      speed: props.speed,
      showComposer: props.showComposer,
      height: props.height,
      reducedMotion: props.reducedMotion,
      variant: props.variant,
    })
  },
)

watch(
  () => [props.seed, props.fishCount, props.sharks],
  () => {
    if (!controller) return
    const next = { seed: props.seed, fishCount: props.fishCount }
    if (Array.isArray(props.sharks) && props.sharks.length) next.sharks = props.sharks
    controller.update(next)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (controller) controller.destroy()
  controller = null
})

defineExpose({
  reset: () => controller && controller.reset(),
  setPaused: (value) => controller && controller.setPaused(value),
  getState: () => (controller ? controller.getState() : null),
})
</script>

<template>
  <div ref="host" class="ascii-sharks-host" />
</template>

<style scoped>
.ascii-sharks-host {
  display: block;
  width: 100%;
}
</style>
