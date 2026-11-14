/**
 * SelectionFlower — 原生 JS 入口。
 *
 *   import { mountSelectionFlower } from './components/selection-flower/mountSelectionFlower'
 *   const controller = mountSelectionFlower(document.querySelector('#demo'), { height: 720 })
 *   // controller.update({ reducedMotion: true })
 *   // controller.destroy()
 */
import { createSelectionFlower, mountSelectionFlower as mount } from './motion-runtime'

export { createSelectionFlower }
export const mountSelectionFlower = mount
export default mount
