/**
 * AsciiSharks — 原生 JS 入口。
 *
 *   import { mountAsciiSharks } from './components/ascii/mountAsciiSharks'
 *   const controller = mountAsciiSharks(document.querySelector('#ocean'), {
 *     height: 720,
 *     onSubmit: ({ text, attachments }) => console.log(text, attachments),
 *   })
 *   // controller.update({ theme: 'dark' })
 *   // controller.destroy()
 */
import { createAsciiSharks, mountAsciiSharks as mount } from './motion-runtime'

export { createAsciiSharks }
export const mountAsciiSharks = mount
export default mount
