<!-- SelectionFlower 的 Svelte 入口：共享 motion-runtime -->
<script>
  import { afterUpdate, onDestroy, onMount } from 'svelte'
  import { createSelectionFlower } from './motion-runtime'

  export let height = 720
  export let reducedMotion = undefined

  let host
  let controller = null

  function options() {
    const next = { height }
    if (reducedMotion !== undefined) next.reducedMotion = reducedMotion
    return next
  }

  onMount(() => {
    controller = createSelectionFlower(host, options())
  })

  afterUpdate(() => {
    if (!controller) return
    controller.update({ height, reducedMotion })
  })

  onDestroy(() => {
    if (controller) controller.destroy()
    controller = null
  })
</script>

<div bind:this={host}></div>
