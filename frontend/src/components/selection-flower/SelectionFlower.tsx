/**
 * SelectionFlower — React 入口。
 * 只做挂载/更新/销毁；完整实现位于 motion-runtime.ts 与 SelectionFlowerEngine.js。
 *
 * 依赖：npm install react react-dom
 */
import { useEffect, useRef } from 'react'
import { createSelectionFlower } from './motion-runtime'
import type {
  SelectionFlowerController,
  SelectionFlowerOptions,
} from './motion-runtime'

export interface SelectionFlowerProps extends SelectionFlowerOptions {
  className?: string
}

export function SelectionFlower(props: SelectionFlowerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SelectionFlowerController | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const controller = createSelectionFlower(host, {
      height: propsRef.current.height,
      reducedMotion: propsRef.current.reducedMotion,
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
      height: props.height,
      reducedMotion: props.reducedMotion,
    })
  })

  return <div ref={hostRef} className={props.className} />
}

export default SelectionFlower
