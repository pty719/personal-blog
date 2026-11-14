import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAsciiSharks } from './motion-runtime'

let host
let controller

function mount(options = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  controller = createAsciiSharks(host, {
    seed: 3,
    fishCount: 0,
    paused: true,
    reducedMotion: true,
    height: 600,
    ...options,
  })
  return controller
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  if (controller) controller.destroy()
  controller = null
  if (host) host.remove()
  host = null
  document.body.innerHTML = ''
})

describe('AsciiSharks runtime', () => {
  it('mounts the canvas, fog, composer and disabled send button', () => {
    const inst = mount()
    expect(inst.root.classList.contains('as-root')).toBe(true)
    expect(inst.root.querySelector('canvas').getAttribute('aria-hidden')).toBe('true')
    expect(inst.root.querySelector('.as-fog')).not.toBeNull()
    expect(inst.root.querySelector('.as-title').textContent).toBe('what’s on your mind?')
    expect(inst.root.querySelector('.as-input').getAttribute('maxlength')).toBe('2000')
    expect(inst.root.querySelector('.as-send').disabled).toBe(true)
    expect(inst.root.style.height).toBe('600px')
    expect(inst.root.dataset.reduced).toBe('true')
  })

  it('submits on Enter, clears input, and records local history', () => {
    const onSubmit = vi.fn()
    const inst = mount({ onSubmit })
    const input = inst.root.querySelector('.as-input')
    input.value = 'hello ocean'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    const send = inst.root.querySelector('.as-send')
    expect(send.disabled).toBe(false)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].text).toBe('hello ocean')
    expect(onSubmit.mock.calls[0][0].attachments).toEqual([])
    expect(input.value).toBe('')
    expect(send.disabled).toBe(true)
    expect(inst.getState().localHistory).toEqual(['hello ocean'])

    inst.root.querySelector('.as-history').click()
    const panel = inst.root.querySelector('.as-history-panel')
    expect(panel.hidden).toBe(false)
    expect(panel.textContent).toContain('hello ocean')
  })

  it('does not submit on Shift+Enter and shows the empty history state', () => {
    const onSubmit = vi.fn()
    const inst = mount({ onSubmit })
    const input = inst.root.querySelector('.as-input')
    input.value = 'line'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    expect(onSubmit).not.toHaveBeenCalled()

    inst.root.querySelector('.as-history').click()
    expect(inst.root.querySelector('.as-history-panel').textContent).toContain('No messages yet')
  })

  it('keeps local history capped at eight items', () => {
    const inst = mount()
    const input = inst.root.querySelector('.as-input')
    for (let i = 0; i < 10; i += 1) {
      input.value = `message ${i}`
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    }
    const history = inst.getState().localHistory
    expect(history).toHaveLength(8)
    expect(history[0]).toBe('message 9')
  })

  it('disables the microphone when no callback is connected', () => {
    const inst = mount()
    const mic = inst.root.querySelector('.as-mic')
    expect(mic.disabled).toBe(true)
    expect(mic.getAttribute('aria-label')).toBe('Voice input is not connected')
  })

  it('enables the microphone when a callback is provided', () => {
    const onVoiceInput = vi.fn(() => 'spoken words')
    const inst = mount({ onVoiceInput })
    const mic = inst.root.querySelector('.as-mic')
    expect(mic.disabled).toBe(false)
    mic.click()
    return Promise.resolve().then(() => {
      expect(onVoiceInput).toHaveBeenCalled()
    })
  })

  it('hides the composer without touching the canvas', () => {
    const inst = mount()
    const canvas = inst.root.querySelector('canvas')
    inst.update({ showComposer: false })
    expect(inst.root.dataset.composer).toBe('false')
    expect(inst.root.querySelector('canvas')).toBe(canvas)
    expect(inst.getState().showComposer).toBe(false)
    inst.update({ showComposer: true })
    expect(inst.getState().showComposer).toBe(true)
  })

  it('rebuilds on seed change while keeping the canvas and local history', () => {
    const inst = mount()
    const canvas = inst.root.querySelector('canvas')
    const input = inst.root.querySelector('.as-input')
    input.value = 'keep me'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    const before = inst.engine.sharks[0].spine[0].x
    inst.update({ seed: 99 })
    expect(inst.root.querySelector('canvas')).toBe(canvas)
    expect(inst.getState().localHistory).toEqual(['keep me'])
    expect(Number.isFinite(inst.engine.sharks[0].spine[0].x)).toBe(true)
    expect(inst.engine.sharks[0].spine[0].x).not.toBe(before)
  })

  it('supports two independent instances and cleans up on destroy', () => {
    const first = mount()
    const secondHost = document.createElement('div')
    document.body.appendChild(secondHost)
    const second = createAsciiSharks(secondHost, {
      seed: 8, fishCount: 0, paused: true, reducedMotion: true, height: 500,
    })

    first.root.querySelector('.as-input').value = 'first only'
    first.root.querySelector('.as-input').dispatchEvent(new Event('input', { bubbles: true }))
    first.root.querySelector('.as-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(first.getState().localHistory).toEqual(['first only'])
    expect(second.getState().localHistory).toEqual([])

    const firstRoot = first.root
    const secondRoot = second.root
    first.destroy()
    second.destroy()
    controller = null
    expect(firstRoot.isConnected).toBe(false)
    expect(secondRoot.isConnected).toBe(false)
    secondHost.remove()
  })
})
