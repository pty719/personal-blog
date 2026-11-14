/**
 * AsciiSharks — React 入口。
 * 只做挂载/更新/销毁；完整实现位于 motion-runtime.ts 与 AsciiSharksEngine.js。
 *
 * 依赖：npm install react react-dom
 */
import { useEffect, useRef } from 'react'
import { createAsciiSharks } from './motion-runtime'
import type {
  AsciiSharksController,
  AsciiSharksOptions,
  AsciiSharksSubmitPayload,
} from './motion-runtime'

export interface AsciiSharksProps extends Omit<AsciiSharksOptions, 'onSubmit' | 'onVoiceInput'> {
  onSubmit?: (payload: AsciiSharksSubmitPayload) => void
  onVoiceInput?: (() => string | Promise<string> | void) | null
  className?: string
}

export function AsciiSharks(props: AsciiSharksProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AsciiSharksController | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const controller = createAsciiSharks(host, {
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
        if (typeof propsRef.current.onSubmit === 'function') propsRef.current.onSubmit(payload)
      },
      onVoiceInput: typeof propsRef.current.onVoiceInput === 'function'
        ? () => propsRef.current.onVoiceInput?.()
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

  return <div ref={hostRef} className={props.className} />
}

export default AsciiSharks
