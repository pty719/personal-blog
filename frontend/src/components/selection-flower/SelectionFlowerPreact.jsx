/**
 * SelectionFlower — Preact 入口。共享同一套框架无关运行时。
 */
import { useEffect, useRef } from 'preact/hooks'
import { createSelectionFlower } from './motion-runtime'

export function SelectionFlower(props) {
  const hostRef = useRef(null)
  const controllerRef = useRef(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    if (!hostRef.current) return undefined
    const controller = createSelectionFlower(hostRef.current, {
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

  return <div ref={hostRef} class={props.class || props.className} />
}

export default SelectionFlower
