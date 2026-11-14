/**
 * SelectionFlowerEngine — 框架无关的「文字选区开花」交互与绘制核心。
 *
 * 负责：读取真实 Selection、逐字符取矩形、按稳定键维护植株、确定性生成、
 *       生长/收回归一化、Canvas 绘制。
 * 不负责：DOM 结构、事件生命周期、RAF、观察器（见 motion-runtime.ts）。
 */

export const DESIGN = {
  width: 822,
  height: 720,
  articleWidth: 658,
  articleLeft: 82,
  articleTop: 52,
}

export const PALETTE = [
  '#f21b3f', '#ffb35b', '#f4d64c', '#9bc9ec',
  '#a47bdf', '#f1afd0', '#fff7db',
]
export const CENTER_COLORS = ['#f4d64c', '#ffb35b', '#f1afd0']
export const MAX_PLANTS = 160
export const PLANT_CHANCE = 0.65
export const STEM_DARK = '#2e6b35'
export const STEM_LIGHT = '#67b868'
export const LEAF_FILL = '#67b868'
export const OUTLINE = '#20241b'
export const TAU = Math.PI * 2

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

/** 规格指定的 xorshift32；每次返回 [0,1) */
export function xorshift32(seed) {
  let x = seed | 0
  return function random() {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

export function randomSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return (Math.random() * 4294967296) >>> 0
}

/** 每株的 32 位种子：手势种子 XOR 文本节点序号 XOR 字符偏移 */
export function plantSeedFor(gestureSeed, nodeIndex, charOffset) {
  return (
    (gestureSeed >>> 0)
    ^ Math.imul((nodeIndex + 1) | 0, 73856093)
    ^ Math.imul((charOffset + 1) | 0, 19349663)
  ) >>> 0
}

export function shouldPlant(seed) {
  return xorshift32(seed)() < PLANT_CHANCE
}

export function easeOutBack(t, s = 1.1) {
  const x = clamp(t, 0, 1.2)
  const c3 = s + 1
  return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)
}

export function quadPoint(p0, p1, p2, t) {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

function quadTangent(p0, p1, p2, t) {
  const mt = 1 - t
  let x = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)
  let y = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  const len = Math.hypot(x, y) || 1
  x /= len
  y /= len
  return { x, y }
}

function sampleEvenly(items, count) {
  if (count <= 0) return []
  if (count >= items.length) return items.slice()
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push(items[Math.floor((i * items.length) / count)])
  }
  return out
}

/**
 * 用一株的种子生成全部形态。返回对象里的形态字段在生命周期内绝不改变。
 */
export function createPlantSpec(seed, anchorX, anchorY) {
  const rand = xorshift32(seed)
  const type = Math.floor(rand() * 5)
  const budOnly = type === 4
  const downward = rand() < 0.38
  const length = 16 + rand() * 40
  const bend = -30 + rand() * 60
  const curve = -12 + rand() * 12

  const sizeRoll = rand()
  let radius
  if (budOnly) radius = 4 + rand() * 2
  else if (sizeRoll < 0.35) radius = 5 + rand() * 5
  else if (sizeRoll < 0.8) radius = 10 + rand() * 7
  else radius = 18 + rand() * 5

  const petalCount = [5, 6, 8, 4, 0][type]
  const petalColor = PALETTE[Math.floor(rand() * PALETTE.length)]
  const centerColor = CENTER_COLORS[Math.floor(rand() * CENTER_COLORS.length)]
  const rotation = rand() * TAU

  const leaves = []
  const leafAT = 0.42
  const leafBT = 0.7
  const leafAEnabled = rand() < 0.65
  const leafASide = rand() < 0.5 ? -1 : 1
  const leafALength = 7 + rand() * 8
  const leafASwing = 0.6 + rand() * 0.8
  const leafBEnabled = rand() < 0.35
  const leafBSide = rand() < 0.5 ? -1 : 1
  const leafBLength = 7 + rand() * 8
  const leafBSwing = 0.6 + rand() * 0.8
  if (leafAEnabled) {
    leaves.push({ t: leafAT, start: 0.22, side: leafASide, length: leafALength, swing: leafASwing })
  }
  if (leafBEnabled) {
    leaves.push({ t: leafBT, start: 0.48, side: leafBSide, length: leafBLength, swing: leafBSwing })
  }

  const wobblePhase = rand() * TAU
  const wobbleAmp = 1 + rand()

  return {
    seed,
    type,
    budOnly,
    petalCount,
    downward,
    length,
    bend,
    curve,
    radius,
    petalColor,
    centerColor,
    rotation,
    leaves,
    wobblePhase,
    wobbleAmp,
    anchorX,
    anchorY,
    growth: 0,
    target: 1,
  }
}

export class SelectionFlowerEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas || null
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null
    this.article = null
    this.plants = []
    this.plantMap = new Map()
    this.scale = 1
    this.dpr = 1
    this.cssWidth = 0
    this.cssHeight = 0
    this.gestureSeed = 0
    this.reducedMotion = !!options.reducedMotion
    this.activeDrag = false
    this.onPlantsChanged = null
  }

  setArticle(element) {
    this.article = element || null
  }

  setReducedMotion(value) {
    const next = !!value
    if (next === this.reducedMotion) return
    this.reducedMotion = next
    if (next) this.finishPlants()
  }

  /** 新一次手势的 32 位种子；同一次拖选内不要重复调用 */
  beginGesture(seed) {
    this.gestureSeed = (seed === undefined ? randomSeed() : seed) >>> 0
    return this.gestureSeed
  }

  setActiveDrag(value) {
    this.activeDrag = !!value
  }

  hasPlants() {
    return this.plants.length > 0
  }

  /**
   * 读取当前浏览器 Selection。返回 null 表示选区不属于本实例；
   * 返回 [] 表示属于本实例但为空/折叠/没有可用字符。
   */
  collectSelection() {
    if (typeof window === 'undefined' || !this.article || !this.canvas) return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!this.article.contains(range.startContainer) || !this.article.contains(range.endContainer)) {
      return null
    }
    if (selection.isCollapsed) return []

    const canvasRect = this.canvas.getBoundingClientRect()
    const scale = this.scale || 1
    const walker = document.createTreeWalker(this.article, NodeFilter.SHOW_TEXT)
    const characters = []
    const charRange = document.createRange()
    let nodeIndex = 0
    let node = walker.nextNode()

    while (node) {
      const index = nodeIndex
      nodeIndex += 1
      if (range.intersectsNode(node)) {
        const text = node.data || ''
        let start = 0
        let end = text.length
        if (node === range.startContainer) start = clamp(range.startOffset, 0, text.length)
        if (node === range.endContainer) end = clamp(range.endOffset, start, text.length)
        for (let offset = start; offset < end; offset += 1) {
          if (/\s/.test(text[offset])) continue
          charRange.setStart(node, offset)
          charRange.setEnd(node, offset + 1)
          const rect = charRange.getBoundingClientRect()
          if (!rect || rect.width <= 0 || rect.height <= 0) continue
          characters.push({
            key: `${index}:${offset}`,
            nodeIndex: index,
            offset,
            x: (rect.left + rect.width / 2 - canvasRect.left) / scale,
            y: (rect.top + rect.height / 2 - canvasRect.top) / scale,
          })
        }
      }
      node = walker.nextNode()
    }
    return characters
  }

  /**
   * 当前选中的字符与已有植株同步：
   * - 已存在的键保持身份与形态，只改目标；
   * - 新键按 65% 概率种植，超过上限时均匀采样；
   * - 离开选区的植株目标归 0。
   */
  applyCharacters(characters, seed = this.gestureSeed) {
    const selected = new Set(characters.map((character) => character.key))
    for (const plant of this.plants) {
      plant.target = selected.has(plant.key) ? 1 : 0
    }

    const candidates = []
    for (const character of characters) {
      if (this.plantMap.has(character.key)) continue
      const plantSeed = plantSeedFor(seed, character.nodeIndex, character.offset)
      if (!shouldPlant(plantSeed)) continue
      candidates.push({ character, plantSeed })
    }

    const capacity = Math.max(0, MAX_PLANTS - this.plants.length)
    const picked = sampleEvenly(candidates, capacity)

    for (const entry of picked) {
      const plant = createPlantSpec(entry.plantSeed, entry.character.x, entry.character.y)
      plant.key = entry.character.key
      plant.growth = this.reducedMotion ? 1 : 0
      plant.target = 1
      this.plants.push(plant)
      this.plantMap.set(plant.key, plant)
    }

    if (this.reducedMotion) {
      for (const plant of this.plants) {
        if (plant.target === 1) plant.growth = 1
      }
      this.plants = this.plants.filter((plant) => {
        if (plant.target === 0) {
          this.plantMap.delete(plant.key)
          return false
        }
        return true
      })
    }

    if (this.onPlantsChanged) this.onPlantsChanged()
    return { total: this.plants.length, created: picked.length }
  }

  /** 松手/失焦：所有植株反向生长；减少动态效果时立即清空 */
  releaseAll() {
    for (const plant of this.plants) plant.target = 0
    if (this.reducedMotion) this.clearPlants()
  }

  clearPlants() {
    this.plants = []
    this.plantMap.clear()
    if (this.onPlantsChanged) this.onPlantsChanged()
  }

  /** 运行时切换减少动态效果：目标为 1 的立即到最终形态，目标为 0 的立即移除 */
  finishPlants() {
    for (const plant of this.plants) {
      if (plant.target === 1) plant.growth = 1
    }
    const before = this.plants.length
    this.plants = this.plants.filter((plant) => {
      if (plant.target === 0) {
        this.plantMap.delete(plant.key)
        return false
      }
      return true
    })
    if (before !== this.plants.length && this.onPlantsChanged) this.onPlantsChanged()
    this.render(typeof performance !== 'undefined' ? performance.now() : 0)
  }

  /**
   * 推进生长/收回。返回剩余植株数；调用方据此停止 RAF。
   */
  advance(dt) {
    if (this.reducedMotion) {
      for (const plant of this.plants) {
        plant.growth = plant.target
      }
      return this.prune()
    }
    const step = Math.min(0.04, Math.max(0, dt))
    for (const plant of this.plants) {
      if (plant.growth < plant.target) {
        plant.growth = Math.min(plant.target, plant.growth + 3.3 * step)
      } else if (plant.growth > plant.target) {
        plant.growth = Math.max(plant.target, plant.growth - 2.7 * step)
      }
    }
    return this.prune()
  }

  prune() {
    const before = this.plants.length
    this.plants = this.plants.filter((plant) => {
      if (plant.target === 0 && plant.growth <= 0) {
        this.plantMap.delete(plant.key)
        return false
      }
      return true
    })
    if (this.plants.length !== before && this.onPlantsChanged) this.onPlantsChanged()
    return this.plants.length
  }

  resize(cssWidth, cssHeight, scale = 1) {
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.scale = scale > 0 ? scale : 1
    const device = typeof window !== 'undefined' && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1
    this.dpr = Math.min(2, Math.max(1, device))
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(this.cssWidth * this.dpr))
      this.canvas.height = Math.max(1, Math.round(this.cssHeight * this.dpr))
    }
    this.render(typeof performance !== 'undefined' ? performance.now() : 0)
  }

  render(timeMs) {
    const ctx = this.ctx
    if (!ctx || !this.canvas) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const k = this.dpr * this.scale
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const time = (timeMs || 0) / 1000
    for (const plant of this.plants) this.drawPlant(ctx, plant, time)
  }

  drawPlant(ctx, plant, time) {
    const growth = clamp(plant.growth, 0, 1)
    if (growth <= 0) return
    const direction = plant.downward ? 1 : -1
    const p0 = { x: plant.anchorX, y: plant.anchorY }
    const p1 = {
      x: plant.anchorX + plant.bend * 0.35 + plant.curve,
      y: plant.anchorY + direction * plant.length * 0.48,
    }
    const p2 = {
      x: plant.anchorX + plant.bend,
      y: plant.anchorY + direction * plant.length,
    }
    const stemS = clamp(growth / 0.62, 0, 1)

    if (stemS > 0) {
      const points = []
      const samples = 28
      for (let i = 0; i <= samples; i += 1) {
        points.push(quadPoint(p0, p1, p2, (stemS * i) / samples))
      }
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
      ctx.strokeStyle = STEM_DARK
      ctx.lineWidth = 2.4
      ctx.stroke()
      ctx.strokeStyle = STEM_LIGHT
      ctx.lineWidth = 1.1
      ctx.stroke()
    }

    for (const leaf of plant.leaves) {
      if (stemS < leaf.t - 0.002) continue
      const progress = clamp((growth - leaf.start) / 0.2, 0, 1)
      if (progress <= 0) continue
      const base = quadPoint(p0, p1, p2, leaf.t)
      const tangent = quadTangent(p0, p1, p2, leaf.t)
      const normalX = -tangent.y * leaf.side
      const normalY = tangent.x * leaf.side
      const len = leaf.length * progress
      const out = len * leaf.swing
      const tipX = base.x + normalX * out + tangent.x * len * 0.25
      const tipY = base.y + normalY * out + tangent.y * len * 0.25
      const c1x = base.x + normalX * out * 0.55 + tangent.x * len * 0.05
      const c1y = base.y + normalY * out * 0.55 + tangent.y * len * 0.05
      const c2x = tipX - normalX * out * 0.4 + tangent.x * len * 0.1
      const c2y = tipY - normalY * out * 0.4 + tangent.y * len * 0.1

      ctx.beginPath()
      ctx.moveTo(base.x, base.y)
      ctx.quadraticCurveTo(c1x, c1y, tipX, tipY)
      ctx.quadraticCurveTo(c2x, c2y, base.x, base.y)
      ctx.closePath()
      ctx.fillStyle = LEAF_FILL
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 0.9
      ctx.stroke()
    }

    const stemTip = quadPoint(p0, p1, p2, stemS)
    const tipTangent = quadTangent(p0, p1, p2, stemS)
    let headX = stemTip.x
    let headY = stemTip.y
    if (this.activeDrag && !this.reducedMotion && plant.target > 0 && growth > 0.3) {
      const wobble = Math.sin(time * TAU * 1.5 + plant.wobblePhase) * plant.wobbleAmp
      headX += -tipTangent.y * wobble
      headY += tipTangent.x * wobble
    }

    const budProgress = clamp((growth - 0.25) / 0.22, 0, 1)
    const budRadius = budProgress * Math.min(plant.radius * 0.24, 3.5)
    if (budRadius > 0.05) {
      ctx.beginPath()
      ctx.ellipse(headX, headY, budRadius, budRadius * 1.25, 0, 0, TAU)
      ctx.fillStyle = plant.petalColor
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.1
      ctx.stroke()
    }

    if (!plant.budOnly && plant.petalCount > 0) {
      const minorScale = plant.type === 2 ? 0.28 : 0.46
      for (let k = 0; k < plant.petalCount; k += 1) {
        const progress = clamp((growth - 0.42 - k * 0.027) / 0.32, 0, 1)
        if (progress <= 0) continue
        const eased = easeOutBack(progress, 1.1)
        const angle = (TAU * k) / plant.petalCount + plant.rotation
        const distance = plant.radius * 0.6 * Math.min(1, eased)
        const px = headX + Math.cos(angle) * distance
        const py = headY + Math.sin(angle) * distance
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.ellipse(0, 0, plant.radius * 0.64 * eased, plant.radius * minorScale * eased, 0, 0, TAU)
        ctx.fillStyle = plant.petalColor
        ctx.fill()
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1.1
        ctx.stroke()
        ctx.restore()
      }

      const centerProgress = clamp((growth - 0.54) / 0.3, 0, 1)
      if (centerProgress > 0) {
        ctx.beginPath()
        ctx.arc(headX, headY, plant.radius * 0.25 * centerProgress, 0, TAU)
        ctx.fillStyle = plant.centerColor
        ctx.fill()
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1.1
        ctx.stroke()
      }
    }
  }

  destroy() {
    if (this.ctx && this.canvas) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
    this.plants = []
    this.plantMap.clear()
    this.article = null
    this.canvas = null
    this.ctx = null
    this.onPlantsChanged = null
  }
}

export default SelectionFlowerEngine
