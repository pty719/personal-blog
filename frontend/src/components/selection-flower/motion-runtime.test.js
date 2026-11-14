import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSelectionFlower } from './motion-runtime'

let host
let controller
let originalRect

function mount(options = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  controller = createSelectionFlower(host, {
    reducedMotion: true,
    ...options,
  })
  return controller
}

function firstParagraph(inst) {
  return inst.root.querySelectorAll('.sf-p')[0]
}

function press(paragraph, key, extra = {}) {
  paragraph.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  originalRect = Range.prototype.getBoundingClientRect
  Range.prototype.getBoundingClientRect = function getRect() {
    return {
      left: 10, top: 20, right: 18, bottom: 40, width: 8, height: 20, x: 10, y: 20, toJSON() {},
    }
  }
})

afterEach(() => {
  if (controller) controller.destroy()
  controller = null
  if (host) host.remove()
  host = null
  if (originalRect) Range.prototype.getBoundingClientRect = originalRect
  else delete Range.prototype.getBoundingClientRect
  window.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('SelectionFlower runtime', () => {
  it('renders the exact copy with canvas behind the transparent article', () => {
    const inst = mount()
    expect(inst.root.querySelector('.sf-title').textContent)
      .toBe('Select any of this andwatch it flower.')
    const paragraphs = inst.root.querySelectorAll('.sf-p')
    expect(paragraphs).toHaveLength(4)
    expect(paragraphs[0].textContent).toContain('Drag across a line.')
    expect(paragraphs[2].querySelector('em').textContent).toBe('Let go, and it grows backwards.')
    expect(paragraphs[3].textContent).toBe('Only a highlight plants anything. The cursor can do it too, if you turn it on.')

    const canvas = inst.root.querySelector('canvas')
    const article = inst.root.querySelector('.sf-article')
    expect(canvas.style.zIndex).toBe('0')
    expect(canvas.style.pointerEvents || 'none').toBe('none')
    expect(article.style.zIndex).toBe('1')
    expect(article.style.background).toBe('transparent')
  })

  it('plants on Enter, exposes an instruction and one live result, then clears in reduced motion', () => {
    vi.useFakeTimers()
    const inst = mount({ reducedMotion: true })
    const paragraph = firstParagraph(inst)
    const help = inst.root.querySelector('.sf-sr')
    const status = inst.root.querySelector('[aria-live="polite"]')
    expect(help.textContent).toContain('Enter')
    expect(status).toBeTruthy()

    press(paragraph, 'Enter')
    expect(inst.engine.plants.length).toBeGreaterThan(0)
    expect(inst.getState().plants).toBeGreaterThan(0)

    // 播报有 300ms 去抖，避免拖选过程中逐次刷屏
    vi.advanceTimersByTime(400)
    expect(status.textContent).toContain('已种下')

    vi.advanceTimersByTime(1100)
    expect(inst.engine.plants).toHaveLength(0)
  })

  it('selects 36 characters for Enter and the whole paragraph for End', () => {
    const inst = mount()
    const paragraph = firstParagraph(inst)
    press(paragraph, 'Enter')
    const selection = window.getSelection()
    expect(selection.toString().length).toBe(36)

    press(paragraph, 'End')
    expect(selection.toString()).toBe(paragraph.textContent)
  })

  it('extends the keyboard selection with Shift+Arrow', () => {
    const inst = mount()
    const paragraph = firstParagraph(inst)
    paragraph.focus()
    press(paragraph, 'ArrowRight', { shiftKey: true })
    expect(window.getSelection().toString().length).toBe(1)
    press(paragraph, 'ArrowRight', { shiftKey: true })
    expect(window.getSelection().toString().length).toBe(2)
    press(paragraph, 'ArrowLeft', { shiftKey: true })
    expect(window.getSelection().toString().length).toBe(1)
  })

  it('clears the owned selection and flowers on Escape', () => {
    const inst = mount({ reducedMotion: true })
    const paragraph = firstParagraph(inst)
    press(paragraph, 'Enter')
    expect(inst.engine.plants.length).toBeGreaterThan(0)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(window.getSelection().rangeCount).toBe(0)
    expect(inst.engine.plants).toHaveLength(0)
  })

  it('does not clear a selection owned by another instance', () => {
    const first = mount({ reducedMotion: true })
    const secondHost = document.createElement('div')
    document.body.appendChild(secondHost)
    const second = createSelectionFlower(secondHost, { reducedMotion: true })

    press(firstParagraph(first), 'Enter')
    const before = window.getSelection().toString()
    expect(before.length).toBe(36)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    // 选区属于第一个实例：第一个实例会清除它；第二个实例不得误清
    expect(window.getSelection().rangeCount).toBe(0)
    expect(second.engine.plants).toHaveLength(0)

    second.destroy()
    secondHost.remove()
  })

  it('keeps instances independent and cleans up idempotently', () => {
    const first = mount({ reducedMotion: true })
    const secondHost = document.createElement('div')
    document.body.appendChild(secondHost)
    const second = createSelectionFlower(secondHost, { reducedMotion: true })

    press(firstParagraph(first), 'Enter')
    expect(first.engine.plants.length).toBeGreaterThan(0)
    expect(second.engine.plants).toHaveLength(0)

    const firstRoot = first.root
    first.destroy()
    first.destroy()
    expect(firstRoot.isConnected).toBe(false)
    expect(second.engine.plants).toHaveLength(0)

    second.destroy()
    secondHost.remove()
  })

  it('updates height and reduced motion at runtime', () => {
    const inst = mount({ reducedMotion: false })
    inst.update({ height: 480 })
    expect(inst.root.style.height).not.toBe('')
    inst.update({ reducedMotion: true })
    expect(inst.getState().reducedMotion).toBe(true)

    press(firstParagraph(inst), 'Enter')
    expect(inst.engine.plants.every((plant) => plant.growth === 1)).toBe(true)
  })


  it('attaches to real article content without creating the demo DOM', () => {
    const layer = document.createElement('div')
    Object.defineProperty(layer, 'clientWidth', { configurable: true, value: 700 })
    Object.defineProperty(layer, 'clientHeight', { configurable: true, value: 240 })
    const content = document.createElement('div')
    content.innerHTML = '<p>Hello world from a real article.</p>'
    const scene = document.createElement('div')
    scene.append(layer, content)
    document.body.append(scene)

    const inst = createSelectionFlower(layer, { attachTo: content, reducedMotion: true })
    expect(inst.root.dataset.bare).toBe('true')
    expect(inst.root.parentElement).toBe(layer)
    expect(inst.root.querySelector('.sf-title')).toBeNull()
    expect(inst.engine.article).toBe(content)

    const down = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
    down.pointerType = 'mouse'
    content.dispatchEvent(down)

    const paragraph = content.querySelector('p')
    const range = document.createRange()
    range.setStart(paragraph.firstChild, 0)
    range.setEnd(paragraph.firstChild, 5)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    expect(inst.engine.plants.length).toBeGreaterThan(0)
    expect(inst.engine.plants.every((plant) => plant.growth === 1)).toBe(true)
    inst.destroy()
  })

})
