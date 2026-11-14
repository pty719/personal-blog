import { describe, expect, it, vi } from 'vitest'
import {
  AsciiSharksEngine,
  DEFAULT_SHARKS,
  SPECIES,
  clamp,
  halfWidthFraction,
  hash3,
  mulberry32,
  smoothstep,
  angleDiff,
} from './AsciiSharksEngine'

function makeCanvas() {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(null)
  return canvas
}

function makeEngine(options = {}) {
  const engine = new AsciiSharksEngine(makeCanvas(), { seed: 7, ...options })
  engine.resize(972, 880)
  return engine
}

function makeFish(overrides = {}) {
  return {
    species: 'sardine',
    x: 400, y: 300,
    homeX: 400, homeY: 300,
    vx: 36, vy: 0,
    dir: 0, turn: 0, depth: 0.8, phase: 0,
    group: 0, millDir: 1, alarm: 0, alive: true, expireAt: Infinity,
    ...overrides,
  }
}

describe('deterministic randomness', () => {
  it('mulberry32 is reproducible and stays in [0,1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 200; i += 1) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('does not touch Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    makeEngine()
    expect(spy).not.toHaveBeenCalled()
  })

  it('hash3 is stable and bounded', () => {
    for (const [x, y, z] of [[1, 2, 3], [-5, 90, 7], [0, 0, 0], [12, 4, 99]]) {
      const value = hash3(x, y, z)
      expect(value).toBe(hash3(x, y, z))
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('math helpers', () => {
  it('clamps and smoothsteps', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-2, 0, 1)).toBe(0)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6)
    expect(smoothstep(2, 2, 2)).toBe(0)
  })

  it('normalizes angle difference into (-π, π]', () => {
    expect(angleDiff(Math.PI * 2, 0)).toBeCloseTo(0, 9)
    expect(angleDiff(-Math.PI * 2, 0)).toBeCloseTo(0, 9)
    expect(Math.abs(angleDiff(3, -3))).toBeLessThanOrEqual(Math.PI)
  })
})

describe('species parameters match the spec', () => {
  it('keeps the five species tables intact', () => {
    expect(SPECIES.sardine).toMatchObject({
      cruise: 36, maxSpeed: 64, minSpeed: 18, weight: 3, group: [18, 28],
      spacingX: 1.8, spacingY: 1.1, align: 1.6, cohesion: 1.6,
      jitter: 40, mill: 70, verticalDrag: 0.5,
    })
    expect(SPECIES.anchovy).toMatchObject({ align: 3.2, cohesion: 0.45, verticalDrag: 1.4 })
    expect(SPECIES.silverside).toMatchObject({ jitter: 35, verticalDrag: 1.6 })
    expect(SPECIES.mackerel).toMatchObject({ group: [5, 9], spacingX: 2.6 })
    expect(SPECIES.goby).toMatchObject({ jitter: 110, mill: 0, verticalDrag: 0.3 })
  })

  it('uses the documented shark hull widths', () => {
    expect(halfWidthFraction('classic', 0)).toBe(0)
    expect(halfWidthFraction('classic', 0.13)).toBeCloseTo(0.09, 6)
    expect(halfWidthFraction('classic', 0.3)).toBeCloseTo(0.106, 6)
    expect(halfWidthFraction('classic', 0.84)).toBeCloseTo(0.019, 6)
    expect(halfWidthFraction('hammerhead', 0)).toBeCloseTo(0.045, 6)
    expect(halfWidthFraction('hammerhead', 0.3)).toBeCloseTo(0.92 * 0.106, 6)
    expect(halfWidthFraction('mako', 0.1)).toBeGreaterThan(0)
    expect(halfWidthFraction('nurse', 0.9)).toBeGreaterThan(0)
  })
})

describe('ocean construction', () => {
  it('derives fish count from area, clamped to 85–340', () => {
    const engine = makeEngine()
    engine.buildFish()
    expect(engine.fish).toHaveLength(194)
    engine.options.fishCount = 0
    engine.buildFish()
    expect(engine.fish).toHaveLength(0)
    engine.options.fishCount = 999
    engine.buildFish()
    expect(engine.fish).toHaveLength(340)
  })

  it('creates the four default sharks in order with 20 spine nodes', () => {
    const engine = makeEngine()
    expect(engine.sharks).toHaveLength(4)
    expect(engine.sharks.map((shark) => shark.kind))
      .toEqual(DEFAULT_SHARKS.map((shark) => shark.kind))
    const baseL = clamp(Math.min(972, 880) * 0.44, 170, 430)
    for (const shark of engine.sharks) {
      expect(shark.spine).toHaveLength(20)
      expect(shark.L).toBeCloseTo(baseL * shark.size, 6)
      for (let i = 1; i < 20; i += 1) {
        const a = shark.spine[i - 1]
        const b = shark.spine[i]
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(shark.L / 19, 5)
      }
    }
  })

  it('rebuilds identically with the same seed', () => {
    const first = makeEngine({ seed: 41, fishCount: 120 })
    const second = makeEngine({ seed: 41, fishCount: 120 })
    expect(first.fish.length).toBe(second.fish.length)
    for (let i = 0; i < Math.min(30, first.fish.length); i += 1) {
      expect(first.fish[i].x).toBeCloseTo(second.fish[i].x, 9)
      expect(first.fish[i].y).toBeCloseTo(second.fish[i].y, 9)
      expect(first.fish[i].species).toBe(second.fish[i].species)
    }
    for (let i = 0; i < 4; i += 1) {
      expect(first.sharks[i].spine[0].x).toBeCloseTo(second.sharks[i].spine[0].x, 9)
      expect(first.sharks[i].spine[19].y).toBeCloseTo(second.sharks[i].spine[19].y, 9)
    }
  })

  it('clamps speed into 0.25–2', () => {
    const engine = makeEngine()
    engine.setSpeed(0.1)
    expect(engine.speed).toBe(0.25)
    engine.setSpeed(9)
    expect(engine.speed).toBe(2)
    engine.setSpeed(1.25)
    expect(engine.speed).toBe(1.25)
  })

  it('keeps every spine segment within the ±0.16 rad bend limit', () => {
    const engine = makeEngine({ fishCount: 60 })
    for (let i = 0; i < 60; i += 1) engine.step(1 / 60)
    for (const shark of engine.sharks) {
      for (let i = 2; i < 20; i += 1) {
        const a = Math.atan2(shark.spine[i - 1].y - shark.spine[i - 2].y, shark.spine[i - 1].x - shark.spine[i - 2].x)
        const b = Math.atan2(shark.spine[i].y - shark.spine[i - 1].y, shark.spine[i].x - shark.spine[i - 1].x)
        expect(Math.abs(angleDiff(b, a))).toBeLessThanOrEqual(0.1601)
      }
    }
  })
})

describe('interaction feedback', () => {
  it('splashes fish away and records an event', () => {
    const engine = makeEngine({ fishCount: 0 })
    const fish = makeFish({ x: 100, y: 100 })
    engine.fish = [fish]
    engine.events = []
    engine.splash(150, 100)
    expect(fish.alarm).toBe(1)
    // 速度应与“远离点击点”的方向同向
    const awayX = fish.x - 150
    const awayY = fish.y - 100
    expect(fish.vx * awayX + fish.vy * awayY).toBeGreaterThan(0)
    expect(engine.events.some((event) => event.type === 'splash')).toBe(true)
  })

  it('eats fish inside the mouth and records the event', () => {
    const engine = makeEngine({ fishCount: 0 })
    const shark = engine.sharks[0]
    shark.hunger = 1
    shark.target = null
    const head = shark.spine[0]
    const fish = makeFish({ x: head.x, y: head.y })
    engine.fish = [fish]
    engine.groups = [{ index: 0, cx: head.x, cy: head.y, species: 'sardine', millDir: 1, count: 1 }]
    engine.events = []
    engine.updateSharks(1 / 60)
    expect(fish.alive).toBe(false)
    expect(fish.expireAt).toBeGreaterThan(engine.time + 2.9)
    expect(engine.events.some((event) => event.type === 'eat')).toBe(true)
  })

  it('moves the virtual pointer in 48px steps', () => {
    const engine = makeEngine({ fishCount: 0 })
    engine.moveVirtualPointer(48, -48)
    expect(engine.virtualPointer.x).toBe(48)
    expect(engine.virtualPointer.y).toBe(0)
    expect(engine.virtualPointer.active).toBe(true)
  })
})
