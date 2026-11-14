/**
 * SelectionFlower — Solid 入口。DOM 只在 onMount 后访问。
 */
import { createEffect, onCleanup, onMount } from 'solid-js'
import { createSelectionFlower } from './motion-runtime'

export function SelectionFlower(props) {
  let host
  let controller = null

  onMount(() => {
    controller = createSelectionFlower(host, {
      height: props.height,
      reducedMotion: props.reducedMotion,
    })
    onCleanup(() => {
      if (controller) controller.destroy()
      controller = null
    })
  })

  createEffect(() => {
    if (!controller) return
    controller.update({
      height: props.height,
      reducedMotion: props.reducedMotion,
    })
  })

  return <div ref={host} class={props.class} />
}

export default SelectionFlower
