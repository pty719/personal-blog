/**
 * AsciiSharks — Preact 入口。共享同一套框架无关运行时。
 */
import { useEffect, useRef } from 'preact/hooks'
import { createAsciiSharks } from './motion-runtime'

export function AsciiSharks(props) {
  const hostRef = useRef(null)
  const controllerRef = useRef(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    if (!hostRef.current) return undefined
    const controller = createAsciiSharks(hostRef.current, {
      theme: propsRef.current.theme,
      paused: propsRef.current.paused,
      speed: propsRef.current.speed,
      seed: propsRef.current.seed,
      fishCount: propsRef.current.fishCount,
      sharks: propsRef.current.sharks,
      showComposer: propsRef.current.showComposer,
      height: propsRef.current.height,
      reducedMotion: propsRef.current.reducedMotion,
      variant: propsRef.current.variant,
      onSubmit: (payload) => {
        if (propsRef.current.onSubmit) propsRef.current.onSubmit(payload)
      },
      onVoiceInput: typeof propsRef.current.onVoiceInput === 'function'
        ? () => propsRef.current.onVoiceInput()
        : null,
    })
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    const controller = controllerRef.current
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

  return <div ref={hostRef} class={props.class || props.className} />
}

export default AsciiSharks
