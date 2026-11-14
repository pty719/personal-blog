import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_PLANTS,
  SelectionFlowerEngine,
  clamp,
  createPlantSpec,
  easeOutBack,
  plantSeedFor,
  shouldPlant,
  xorshift32,
} from './SelectionFlowerEngine'

function makeEngine() {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(null)
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 822, bottom: 720, width: 822, height: 720, x: 0, y: 0, toJSON() {},
  })
  const engine = new SelectionFlowerEngine(canvas)
  engine.resize(822, 720, 1)
  return engine
}

function characters(count, nodeIndex = 0, prefix = 'k') {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}:${index}`,
    nodeIndex,
    offset: index,
    x: 100 + index,
    y: 200,
  }))
}

describe('deterministic randomness', () => {
  it('xorshift32 is reproducible and bounded', () => {
    const a = xorshift32(12345)
    const b = xorshift32(12345)
    for (let i = 0; i < 100; i += 1) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('derives the per-plant seed with the specified XOR formula', () => {
    const expected = (
      99
      ^ Math.imul(3, 73856093)
      ^ Math.imul(6, 19349663)
    ) >>> 0
    expect(plantSeedFor(99, 2, 5)).toBe(expected)
  })

  it('plants roughly 65% of characters', () => {
    let planted = 0
    const total = 12000
    for (let seed = 0; seed < total; seed += 1) {
      if (shouldPlant(seed * 2654435761)) planted += 1
    }
    expect(planted / total).toBeGreaterThan(0.62)
    expect(planted / total).toBeLessThan(0.68)
  })

  it('easeOutBack starts at 0, ends at 1, and overshoots slightly', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6)
    expect(easeOutBack(1)).toBeCloseTo(1, 6)
    expect(easeOutBack(0.7)).toBeGreaterThan(1)
  })
})

describe('plant specification', () => {
  it('is stable for a seed and respects the documented ranges', () => {
    for (let seed = 1; seed < 400; seed += 1) {
      const first = createPlantSpec(seed, 100, 200)
      const second = createPlantSpec(seed, 100, 200)
      expect(first).toEqual(second)
      expect(first.length).toBeGreaterThanOrEqual(16)
      expect(first.length).toBeLessThanOrEqual(56)
      expect(first.bend).toBeGreaterThanOrEqual(-30)
      expect(first.bend).toBeLessThanOrEqual(30)
      expect(first.curve).toBeGreaterThanOrEqual(-12)
      expect(first.curve).toBeLessThanOrEqual(12)
      expect([5, 6, 8, 4, 0]).toContain(first.petalCount)
      expect(first.leaves.length).toBeLessThanOrEqual(2)
      for (const leaf of first.leaves) {
        expect(leaf.length).toBeGreaterThanOrEqual(7)
        expect(leaf.length).toBeLessThanOrEqual(15)
      }
      if (first.budOnly) {
        expect(first.radius).toBeGreaterThanOrEqual(4)
        expect(first.radius).toBeLessThanOrEqual(6)
      } else {
        expect(first.radius).toBeGreaterThanOrEqual(5)
        expect(first.radius).toBeLessThanOrEqual(23)
      }
    }
  })
})

describe('selection sync', () => {
  it('caps a long selection at 160 evenly sampled plants', () => {
    const engine = makeEngine()
    engine.applyCharacters(characters(600), 42)
    expect(engine.plants.length).toBeLessThanOrEqual(MAX_PLANTS)
    expect(engine.plants.length).toBeGreaterThan(100)
  })

  it('is deterministic for the same gesture seed', () => {
    const first = makeEngine()
    const second = makeEngine()
    const keys = characters(80)
    first.applyCharacters(keys, 1234)
    second.applyCharacters(keys, 1234)
    expect(first.plants.map((plant) => plant.key)).toEqual(second.plants.map((plant) => plant.key))
    expect(first.plants.map((plant) => plant.seed)).toEqual(second.plants.map((plant) => plant.seed))
  })

  it('keeps existing plant identity and anchors while expanding a selection', () => {
    const engine = makeEngine()
    const base = characters(30)
    engine.applyCharacters(base, 7)
    expect(engine.plants.length).toBeGreaterThan(0)
    const original = engine.plants[0]
    const key = original.key
    const anchorX = original.anchorX
    const seed = original.seed

    engine.applyCharacters(characters(60), 7)
    const again = engine.plants.find((plant) => plant.key === key)
    expect(again).toBe(original)
    expect(again.anchorX).toBe(anchorX)
    expect(again.seed).toBe(seed)
  })

  it('retracts departing characters and resumes the same object', () => {
    const engine = makeEngine()
    const base = characters(30)
    engine.applyCharacters(base, 11)
    const plant = engine.plants[0]

    engine.applyCharacters(base.slice(0, 20), 11)
    if (plant.key.startsWith('k:2') && Number(plant.key.split(':')[1]) >= 20) {
      expect(plant.target).toBe(0)
    }
    engine.applyCharacters(base, 11)
    expect(engine.plants.find((entry) => entry.key === plant.key)).toBe(plant)
    expect(plant.target).toBe(1)
  })
})

describe('growth and retraction', () => {
  it('grows at 3.3/s and retracts at 2.7/s, removing only at zero', () => {
    const engine = makeEngine()
    engine.applyCharacters(characters(20), 5)
    const plant = engine.plants[0]
    expect(plant.growth).toBe(0)

    engine.advance(0.04)
    expect(plant.growth).toBeCloseTo(3.3 * 0.04, 6)
    for (let i = 0; i < 20; i += 1) engine.advance(0.04)
    expect(plant.growth).toBe(1)

    engine.releaseAll()
    engine.advance(0.04)
    expect(plant.growth).toBeLessThan(1)
    expect(plant.growth).toBeGreaterThan(0)
    expect(engine.plants).toContain(plant)

    for (let i = 0; i < 40; i += 1) engine.advance(0.04)
    expect(plant.growth).toBe(0)
    expect(engine.plants).not.toContain(plant)
  })

  it('shows and clears immediately under reduced motion', () => {
    const engine = makeEngine()
    engine.setReducedMotion(true)
    engine.applyCharacters(characters(12), 3)
    expect(engine.plants.length).toBeGreaterThan(0)
    for (const plant of engine.plants) expect(plant.growth).toBe(1)
    engine.releaseAll()
    expect(engine.plants).toHaveLength(0)
  })

  it('clamps advance time steps to 0.04s', () => {
    const engine = makeEngine()
    engine.applyCharacters(characters(5), 1)
    const plant = engine.plants[0]
    engine.advance(0.5)
    expect(plant.growth).toBeCloseTo(3.3 * 0.04, 6)
  })
})

describe('collectSelection', () => {
  let originalRect

  beforeEach(() => {
    originalRect = Range.prototype.getBoundingClientRect
    Range.prototype.getBoundingClientRect = function getRect() {
      return {
        left: 10, top: 20, right: 18, bottom: 40, width: 8, height: 20, x: 10, y: 20, toJSON() {},
      }
    }
  })

  afterEach(() => {
    if (originalRect) Range.prototype.getBoundingClientRect = originalRect
    else delete Range.prototype.getBoundingClientRect
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  function setup() {
    const article = document.createElement('article')
    const title = document.createElement('h2')
    title.textContent = 'Select any'
    const first = document.createElement('p')
    first.textContent = 'Hello world'
    const second = document.createElement('p')
    second.textContent = 'Second line'
    article.append(title, first, second)
    document.body.appendChild(article)

    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 822, bottom: 720, width: 822, height: 720, x: 0, y: 0, toJSON() {},
    })
    const engine = new SelectionFlowerEngine(canvas)
    engine.setArticle(article)
    engine.resize(822, 720, 1)
    return { article, title, first, second, engine }
  }

  it('collects non-whitespace characters with stable keys and local anchors', () => {
    const { first, second, engine } = setup()
    const range = document.createRange()
    range.setStart(first.firstChild, 6)
    range.setEnd(second.firstChild, 6)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const chars = engine.collectSelection()
    expect(chars.map((char) => char.key)).toEqual([
      '1:6', '1:7', '1:8', '1:9', '1:10',
      '2:0', '2:1', '2:2', '2:3', '2:4', '2:5',
    ])
    for (const char of chars) {
      expect(char.x).toBe(14)
      expect(char.y).toBe(30)
    }
  })

  it('supports selections starting in the title', () => {
    const { title, engine } = setup()
    const range = document.createRange()
    range.setStart(title.firstChild, 0)
    range.setEnd(title.firstChild, 6)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const chars = engine.collectSelection()
    expect(chars.some((char) => char.key.startsWith('0:'))).toBe(true)
  })

  it('ignores selections outside the instance and returns [] when collapsed', () => {
    const { first, engine } = setup()
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    const range = document.createRange()
    range.setStart(outside.firstChild, 0)
    range.setEnd(outside.firstChild, 4)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    expect(engine.collectSelection()).toBeNull()

    const collapsed = document.createRange()
    collapsed.setStart(first.firstChild, 0)
    collapsed.collapse(true)
    selection.removeAllRanges()
    selection.addRange(collapsed)
    expect(engine.collectSelection()).toEqual([])
  })

  it('skips whitespace-only selections', () => {
    const { first, engine } = setup()
    const range = document.createRange()
    range.setStart(first.firstChild, 5)
    range.setEnd(first.firstChild, 6)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    expect(engine.collectSelection()).toEqual([])
  })
})
