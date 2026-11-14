<!-- AsciiSharks 的 Svelte 入口：共享 motion-runtime -->
<script>
  import { afterUpdate, onDestroy, onMount } from 'svelte'
  import { createAsciiSharks } from './motion-runtime'

  export let theme = 'light'
  export let paused = false
  export let speed = 1
  export let seed = 7
  export let fishCount = null
  export let sharks = undefined
  export let showComposer = true
  export let height = 880
  export let reducedMotion = undefined
  export let variant = 'default'
  export let onSubmit = null
  export let onVoiceInput = null

  let host
  let controller = null

  function options() {
    const next = {
      theme,
      paused,
      speed,
      seed,
      showComposer,
      height,
      variant,
      onSubmit: (payload) => onSubmit && onSubmit(payload),
      onVoiceInput: typeof onVoiceInput === 'function' ? () => onVoiceInput() : null,
    }
    if (fishCount !== null && fishCount !== undefined) next.fishCount = fishCount
    if (Array.isArray(sharks) && sharks.length) next.sharks = sharks
    if (reducedMotion !== undefined) next.reducedMotion = reducedMotion
    return next
  }

  onMount(() => {
    controller = createAsciiSharks(host, options())
  })

  afterUpdate(() => {
    if (!controller) return
    controller.update({
      theme,
      paused,
      speed,
      seed,
      fishCount: fishCount === null ? undefined : fishCount,
      sharks,
      showComposer,
      height,
      reducedMotion,
      variant,
    })
  })

  onDestroy(() => {
    if (controller) controller.destroy()
    controller = null
  })
</script>

<div bind:this={host}></div>
