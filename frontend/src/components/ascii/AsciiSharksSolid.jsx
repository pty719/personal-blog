/**
 * AsciiSharks — Solid 入口。DOM 只在 onMount 后访问。
 */
import { createEffect, onCleanup, onMount } from 'solid-js'
import { createAsciiSharks } from './motion-runtime'

export function AsciiSharks(props) {
  let host
  let controller = null

  onMount(() => {
    controller = createAsciiSharks(host, {
      theme: props.theme,
      paused: props.paused,
      speed: props.speed,
      seed: props.seed,
      fishCount: props.fishCount,
      sharks: props.sharks,
      showComposer: props.showComposer,
      height: props.height,
      reducedMotion: props.reducedMotion,
      variant: props.variant,
      onSubmit: (payload) => props.onSubmit && props.onSubmit(payload),
      onVoiceInput: typeof props.onVoiceInput === 'function'
        ? () => props.onVoiceInput()
        : null,
    })
    onCleanup(() => {
      if (controller) controller.destroy()
      controller = null
    })
  })

  createEffect(() => {
    if (!controller) return
    controller.update({
      theme: props.theme,
      paused: props.paused,
      speed: props.speed,
      seed: props.seed,
      fishCount: props.fishCount,
      sharks: props.sharks,
      showComposer: props.showComposer,
      height: props.height,
      reducedMotion: props.reducedMotion,
      variant: props.variant,
    })
  })

  return <div ref={host} class={props.class} />
}

export default AsciiSharks
