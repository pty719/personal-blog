/**
 * AsciiSharksEngine — 框架无关的「字符鲨鱼与鱼群」海洋引擎。
 *
 * 只依赖 Canvas2D 与 canvas 元素；所有随机、计时、事件都封装在实例里。
 * 负责：网格、鱼群力学、鲨鱼脊柱与捕食、尾迹场、字符绘制。
 * 不负责：DOM 叠加层、输入框、历史、生命周期（见 motion-runtime.ts）。
 */

export const TAU = Math.PI * 2
export const FIXED_STEP = 1 / 60
export const PREWARM_STEPS = 240
export const MAX_FISH = 340
export const MAX_SHARKS = 8

/* -------------------------------------------------------------------------- */
/* 数学与哈希                                                                  */
/* -------------------------------------------------------------------------- */

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

/** t²(3-2t)，t = clamp((x-a)/(b-a), 0, 1) */
export function smoothstep(a, b, x) {
  if (a === b) return 0
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 角差统一到 (-π, π] */
export function angleDiff(a, b) {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d <= -Math.PI) d += TAU
  return d
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

/** 每个实例独立、绝不动全局 Math.random 的 mulberry32 */
export function mulberry32(seed) {
  let s = seed | 0
  return function random() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 稳定纹理哈希 h(x,y,z)，返回 [0,1) */
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/* -------------------------------------------------------------------------- */
/* 物种与鲨鱼参数                                                              */
/* -------------------------------------------------------------------------- */

/** 顺序：[巡航, 最大, 最小速度, 权重, 群体数量范围, 间距x/y, 对齐, 聚合, 抖动, 旋转吸引, 垂直阻尼] */
export const SPECIES = {
  sardine: {
    cruise: 36, maxSpeed: 64, minSpeed: 18, weight: 3, group: [18, 28],
    spacingX: 1.8, spacingY: 1.1, align: 1.6, cohesion: 1.6,
    jitter: 40, mill: 70, verticalDrag: 0.5,
  },
  anchovy: {
    cruise: 46, maxSpeed: 78, minSpeed: 22, weight: 3, group: [20, 32],
    spacingX: 1.5, spacingY: 1, align: 3.2, cohesion: 0.45,
    jitter: 30, mill: 0, verticalDrag: 1.4,
  },
  silverside: {
    cruise: 40, maxSpeed: 70, minSpeed: 20, weight: 3, group: [12, 20],
    spacingX: 2, spacingY: 1.1, align: 2.4, cohesion: 1.1,
    jitter: 35, mill: 0, verticalDrag: 1.6,
  },
  mackerel: {
    cruise: 32, maxSpeed: 60, minSpeed: 16, weight: 2, group: [5, 9],
    spacingX: 2.6, spacingY: 1.3, align: 2, cohesion: 0.9,
    jitter: 25, mill: 0, verticalDrag: 2,
  },
  goby: {
    cruise: 26, maxSpeed: 56, minSpeed: 10, weight: 1, group: [8, 12],
    spacingX: 1.4, spacingY: 1.1, align: 0.35, cohesion: 1.4,
    jitter: 110, mill: 0, verticalDrag: 0.3,
  },
}

export const SPECIES_KEYS = Object.keys(SPECIES)

export const SHARK_KINDS = [
  'classic', 'hammerhead', 'zebra', 'tiger',
  'greathammer', 'mako', 'thresher', 'nurse',
]

export const DEFAULT_SHARKS = [
  { kind: 'hammerhead', size: 1 },
  { kind: 'classic', size: 0.84 },
  { kind: 'zebra', size: 0.77 },
  { kind: 'thresher', size: 0.7 },
]

/**
 * 物种外观参数：
 * pectoral / pelvic = [胸鳍根前, 根后, 尖端纵向, 横向伸展]
 * tailReach = 尾叉伸展（0 表示无叉尾）
 * dorsal1 / dorsal2 = 背鳍纵向范围
 * eye = 眼睛纵向范围（null 表示头翼末端）
 * gill = 鳃部纵向范围
 * rgb = 物种 RGB 乘数
 * wing = [半展, 后掠, 深度, 中凹]（锤头类）
 */
export const SHARK_STYLE = {
  classic: {
    pectoral: [0.15, 0.43, 0.55, 0.26], pelvic: [0.57, 0.65, 0.69, 0.085],
    tailReach: 0.085, dorsal1: [0.33, 0.47], dorsal2: [0.71, 0.76],
    eye: [0.1, 0.14], gill: [0.19, 0.29], rgb: [0.92, 0.97, 1.05],
    falcate: true,
  },
  hammerhead: {
    pectoral: [0.17, 0.4, 0.5, 0.22], pelvic: [0.56, 0.63, 0.67, 0.075],
    tailReach: 0.11, dorsal1: [0.28, 0.44], dorsal2: [0.7, 0.74],
    eye: null, gill: [0.16, 0.26], rgb: [0.96, 0.98, 0.9],
    falcate: true, wing: [0.17, 0.035, 0.09, 0],
  },
  tiger: {
    pectoral: [0.15, 0.42, 0.53, 0.25], pelvic: [0.57, 0.65, 0.69, 0.085],
    tailReach: 0.095, dorsal1: [0.33, 0.46], dorsal2: [0.71, 0.75],
    eye: [0.08, 0.12], gill: [0.19, 0.28], rgb: [1.02, 0.95, 0.84],
    falcate: true,
  },
  zebra: {
    pectoral: [0.12, 0.3, 0.36, 0.19], pelvic: [0.42, 0.48, 0.51, 0.065],
    tailReach: 0, dorsal1: [0.36, 0.44], dorsal2: [0.49, 0.53],
    eye: [0.06, 0.09], gill: [0.13, 0.2], rgb: [1.08, 0.97, 0.74],
    falcate: false,
  },
  greathammer: {
    pectoral: [0.16, 0.38, 0.49, 0.24], pelvic: [0.55, 0.62, 0.67, 0.085],
    tailReach: 0.13, dorsal1: [0.24, 0.45], dorsal2: [0.68, 0.74],
    eye: null, gill: [0.15, 0.25], rgb: [0.86, 0.93, 1.02],
    falcate: true, wing: [0.21, 0.006, 0.085, 0.014],
  },
  mako: {
    pectoral: [0.18, 0.4, 0.5, 0.21], pelvic: [0.58, 0.64, 0.68, 0.06],
    tailReach: 0.13, dorsal1: [0.34, 0.45], dorsal2: [0.76, 0.79],
    eye: [0.11, 0.15], gill: [0.2, 0.3], rgb: [0.78, 0.9, 1.2],
    falcate: true,
  },
  thresher: {
    pectoral: [0.12, 0.27, 0.36, 0.2], pelvic: [0.37, 0.41, 0.44, 0.045],
    tailReach: 0, dorsal1: [0.24, 0.32], dorsal2: [0.45, 0.47],
    eye: [0.05, 0.1], gill: [0.11, 0.18], rgb: [1, 0.9, 1.08],
    falcate: true,
  },
  nurse: {
    pectoral: [0.16, 0.34, 0.4, 0.17], pelvic: [0.45, 0.52, 0.55, 0.075],
    tailReach: 0, dorsal1: [0.5, 0.58], dorsal2: [0.63, 0.69],
    eye: [0.05, 0.075], gill: [0.14, 0.22], rgb: [1.1, 0.96, 0.76],
    falcate: false,
  },
}

export const COLOR_PALETTE = [
  '#e0892c', '#e03a32', '#b44ae0', '#33c8cc',
  '#3cb54a', '#3150e8', '#d9c14a',
]

const BODY_LADDER = ':;t%SX8#@'
const FIN_LADDER = '%;tS:'
const RIDGE_LADDER = '@8%'
const DARK_LADDER = '#%@'
const EDGE_LADDERS = [".',`", ':;']

const FISH_ALPHAS = [0.28, 0.42, 0.58, 0.74, 0.9]

/* -------------------------------------------------------------------------- */
/* 轮廓函数                                                                    */
/* -------------------------------------------------------------------------- */

function baseHalfWidth(s) {
  if (s < 0.13) return 0.09 * Math.pow(Math.sin((s / 0.13) * Math.PI / 2), 0.95)
  if (s < 0.3) return 0.09 + 0.016 * smoothstep(0.13, 0.3, s)
  if (s < 0.84) return 0.019 + 0.087 * Math.pow(1 - (s - 0.3) / 0.54, 1.25)
  const k = (s - 0.84) / 0.16
  return 0.019 * (1 - k) + 0.012 * Math.sin(k * Math.PI)
}

/** 半宽（占 L 的比例），s ∈ [0,1] */
export function halfWidthFraction(kind, sRaw) {
  const s = clamp(sRaw, 0, 1)
  switch (kind) {
    case 'hammerhead':
      if (s < 0.06) return 0.045
      if (s < 0.3) return 0.045 + (0.106 - 0.045) * ((s - 0.06) / 0.24)
      return 0.92 * baseHalfWidth(s)
    case 'greathammer':
      if (s < 0.05) return 0.04
      if (s < 0.3) return 0.04 + (0.11 - 0.04) * ((s - 0.05) / 0.25)
      return 0.95 * baseHalfWidth(s)
    case 'tiger': {
      if (s < 0.13) return 0.1 * Math.pow(Math.sin((s / 0.13) * Math.PI / 2), 0.45)
      if (s < 0.3) return 0.1 + 0.014 * smoothstep(0.13, 0.3, s)
      if (s < 0.84) return 0.019 + 0.095 * Math.pow(1 - (s - 0.3) / 0.54, 1.2)
      return baseHalfWidth(s)
    }
    case 'zebra': {
      if (s < 0.1) return 0.075 * Math.pow(Math.sin((s / 0.1) * Math.PI / 2), 0.7)
      if (s < 0.28) return 0.075 + 0.025 * ((s - 0.1) / 0.18)
      if (s < 0.55) return 0.022 + 0.078 * Math.pow(1 - (s - 0.28) / 0.27, 1.1)
      const k = (s - 0.55) / 0.45
      return 0.022 * (1 - k * k) + 0.012 * Math.sin(k * Math.PI)
    }
    case 'mako': {
      if (s < 0.17) return 0.088 * Math.pow(Math.sin((s / 0.17) * Math.PI / 2), 1.5)
      if (s < 0.32) return 0.088 + 0.012 * ((s - 0.17) / 0.15)
      if (s < 0.86) return 0.014 + 0.086 * Math.pow(1 - (s - 0.32) / 0.54, 1.45)
      const k = (s - 0.86) / 0.14
      return 0.014 * (1 - k) + 0.01 * Math.sin(k * Math.PI)
    }
    case 'thresher': {
      if (s < 0.08) return 0.07 * Math.pow(Math.sin((s / 0.08) * Math.PI / 2), 0.75)
      if (s < 0.2) return 0.07 + 0.02 * ((s - 0.08) / 0.12)
      if (s < 0.48) return 0.012 + 0.078 * Math.pow(1 - (s - 0.2) / 0.28, 1.3)
      const k = (s - 0.48) / 0.52
      return 0.012 * (1 - k) + 0.006 * Math.sin(0.9 * k * Math.PI) + 0.002
    }
    case 'nurse': {
      if (s < 0.08) return 0.085 * Math.pow(Math.sin((s / 0.08) * Math.PI / 2), 0.4)
      if (s < 0.3) return 0.085 + 0.02 * ((s - 0.08) / 0.22)
      if (s < 0.72) return 0.022 + 0.083 * Math.pow(1 - (s - 0.3) / 0.42, 1.1)
      const k = (s - 0.72) / 0.28
      return 0.022 * (1 - k * k) + 0.014 * Math.sin(k * Math.PI)
    }
    default:
      return baseHalfWidth(s)
  }
}

export function inRange(range, value) {
  return !!range && value >= range[0] && value <= range[1]
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/* -------------------------------------------------------------------------- */
/* 引擎                                                                        */
/* -------------------------------------------------------------------------- */

const SAMPLE_POINTS = [
  [0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.72], [0.75, 0.72],
]

function bucketKey(bx, by) {
  return (bx + 1024) * 4096 + (by + 1024)
}

function pickSpecies(random) {
  let total = 0
  for (const key of SPECIES_KEYS) total += SPECIES[key].weight
  let roll = random() * total
  for (const key of SPECIES_KEYS) {
    roll -= SPECIES[key].weight
    if (roll <= 0) return key
  }
  return SPECIES_KEYS[SPECIES_KEYS.length - 1]
}

export class AsciiSharksEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas || null
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null
    this.options = {
      seed: 7,
      fishCount: null,
      sharks: DEFAULT_SHARKS,
      speed: 1,
      ...options,
    }
    this.rand = mulberry32(this.options.seed)
    this.onNeedsRender = null

    this.W = 0
    this.H = 0
    this.dpr = 1
    this.cw = 10
    this.ch = 15
    this.cols = 0
    this.rows = 0
    this.built = false

    this.time = 0
    this.accumulator = 0
    this.speed = clamp(Number(this.options.speed) || 1, 0.25, 2)
    this.fish = []
    this.sharks = []
    this.groups = []
    this.bucketR = 30
    this.hash = new Map()
    this.energy = null
    this.energyNext = null
    this.heat = null
    this.events = []
    this.pointer = { x: 0, y: 0, active: false }
    this.virtualPointer = { x: 0, y: 0, active: false }
    this.gridCanvas = null
    this.expiredSinceSpawn = 0
    this.expireClock = 0
    this.aliveCount = 0
  }

  /* ------------------------------ 尺寸与网格 ------------------------------ */

  resize(width, height) {
    const w = Math.max(1, Math.round(width || 0))
    const h = Math.max(1, Math.round(height || 0))
    if (w < 2 || h < 2) return

    const oldW = this.W
    const oldH = this.H
    const first = !this.built

    this.W = w
    this.H = h
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
    this.dpr = Math.min(2, Math.max(1, dpr))

    this.cw = clamp(Math.round(w / 124), 8, 13)
    this.ch = Math.round(this.cw * 1.45)
    this.cols = Math.ceil(w / this.cw)
    this.rows = Math.ceil(h / this.ch)
    this.bucketR = Math.max(this.ch * 3, this.cw * 5.5)

    if (this.canvas) {
      this.canvas.width = Math.round(w * this.dpr)
      this.canvas.height = Math.round(h * this.dpr)
    }

    const cellCount = this.cols * this.rows
    this.energy = new Float32Array(cellCount)
    this.energyNext = new Float32Array(cellCount)
    this.heat = new Float32Array(cellCount)

    if (first) {
      this.buildGridCache()
      this.reset()
      return
    }

    // 保留同一个 Canvas：按新旧宽高缩放鱼群与鲨鱼脊柱，再继续。
    if (oldW > 1 && oldH > 1) this.scaleOcean(oldW, oldH, w, h)

    this.buildGridCache()
    this.renderOnce(0)
  }

  scaleOcean(oldW, oldH, newW, newH) {
    const sx = newW / oldW
    const sy = newH / oldH
    for (const fish of this.fish) {
      fish.x *= sx
      fish.y *= sy
      fish.homeX *= sx
      fish.homeY *= sy
    }
    const oldBase = clamp(Math.min(oldW, oldH) * 0.44, 170, 430)
    const newBase = clamp(Math.min(newW, newH) * 0.44, 170, 430)
    const ratio = newBase / oldBase
    for (const shark of this.sharks) {
      shark.L *= ratio
      shark.baseL = newBase
      shark.orbitRx *= sx
      shark.orbitRy *= sy
      for (const node of shark.spine) {
        node.x *= sx
        node.y *= sy
      }
    }
    for (const group of this.groups) {
      group.cx *= sx
      group.cy *= sy
    }
  }

  buildGridCache() {
    if (!this.ctx || typeof document === 'undefined') return
    const devW = Math.max(1, Math.round(this.W * this.dpr))
    const devH = Math.max(1, Math.round(this.H * this.dpr))
    const cache = document.createElement('canvas')
    cache.width = devW
    cache.height = devH
    const g = cache.getContext('2d')
    if (!g) return
    g.fillStyle = '#000'
    g.fillRect(0, 0, devW, devH)
    g.fillStyle = 'rgba(255,255,255,.055)'
    for (let c = 0; c <= this.cols; c += 1) {
      const x = clamp(Math.round(c * this.cw * this.dpr), 0, devW - 1)
      g.fillRect(x, 0, 1, devH)
    }
    for (let r = 0; r <= this.rows; r += 1) {
      const y = clamp(Math.round(r * this.ch * this.dpr), 0, devH - 1)
      g.fillRect(0, y, devW, 1)
    }
    this.gridCanvas = cache
  }

  /* ------------------------------- 构建海洋 ------------------------------- */

  reset() {
    if (!this.W || !this.H) return
    this.rand = mulberry32(this.options.seed)
    this.time = 0
    this.accumulator = 0
    this.events = []
    this.expiredSinceSpawn = 0
    this.expireClock = 0
    this.hash = new Map()
    this.pointer.active = false
    this.virtualPointer.active = false
    this.buildFish()
    this.buildSharks()
    this.aliveCount = this.fish.length
    for (let i = 0; i < PREWARM_STEPS; i += 1) this.step(FIXED_STEP)
    this.events = []
    this.expiredSinceSpawn = 0
    this.expireClock = 0
    this.built = true
    this.renderOnce(0)
  }

  buildFish() {
    const rand = this.rand
    this.fish = []
    this.groups = []

    const requested = this.options.fishCount
    const total = requested === null || requested === undefined
      ? clamp(Math.round((this.W * this.H) / 4400), 85, MAX_FISH)
      : clamp(Math.round(Number(requested) || 0), 0, MAX_FISH)

    let remaining = total
    let guard = 0
    while (remaining > 0 && guard < 512) {
      guard += 1
      const speciesKey = pickSpecies(rand)
      const spec = SPECIES[speciesKey]
      const groupMin = spec.group[0]
      const groupMax = spec.group[1]
      let size = Math.round(groupMin + rand() * (groupMax - groupMin))
      if (size > remaining) size = remaining
      if (size <= 0) break

      const cx = this.W * (0.06 + rand() * 0.88)
      const cy = this.H * (0.08 + rand() * 0.84)
      const leftward = rand() < 0.5
      const baseAngle = leftward ? Math.PI : 0
      const groupAngle = baseAngle + (rand() * 2 - 1) * 0.5
      const spreadX = spec.spacingX * this.cw * Math.sqrt(size)
      const spreadY = spec.spacingY * this.ch * Math.sqrt(size) * 0.6
      const millDir = rand() < 0.5 ? 1 : -1
      const groupIndex = this.groups.length
      this.groups.push({ index: groupIndex, cx, cy, species: speciesKey, millDir })

      for (let i = 0; i < size; i += 1) {
        const x = clamp(cx + (rand() * 2 - 1) * spreadX, 0, this.W)
        const y = clamp(cy + (rand() * 2 - 1) * spreadY, 0, this.H)
        const depth = 0.55 + rand() * 0.45
        this.fish.push({
          species: speciesKey,
          x, y,
          homeX: x, homeY: y,
          vx: Math.cos(groupAngle) * spec.cruise,
          vy: Math.sin(groupAngle) * spec.cruise,
          dir: groupAngle,
          turn: 0,
          depth,
          phase: rand() * TAU,
          group: groupIndex,
          millDir,
          alarm: 0,
          alive: true,
          expireAt: Infinity,
        })
      }
      remaining -= size
    }
    this.aliveCount = this.fish.length
  }

  buildSharks() {
    const rand = this.rand
    const configs = Array.isArray(this.options.sharks) && this.options.sharks.length
      ? this.options.sharks.slice(0, MAX_SHARKS)
      : DEFAULT_SHARKS

    this.sharks = []
    const baseL = clamp(Math.min(this.W, this.H) * 0.44, 170, 430)
    const count = configs.length

    configs.forEach((config, index) => {
      const kind = SHARK_KINDS.includes(config && config.kind) ? config.kind : 'classic'
      const size = clamp(Number(config && config.size) || 1, 0.35, 1.25)
      const L = baseL * size
      const orbitR = Math.min(this.W, this.H) * (0.28 + rand() * 0.12)
      const orbitRx = orbitR * 1.12
      const orbitRy = orbitR * 0.82
      const dirSign = index % 2 === 0 ? 1 : -1
      const startAngle = count ? (index / count) * TAU + (rand() * 2 - 1) * 0.4 : rand() * TAU
      const cx = this.W / 2
      const cy = this.H / 2
      const headX = cx + Math.cos(startAngle) * orbitRx
      const headY = cy + Math.sin(startAngle) * orbitRy

      let tx = -Math.sin(startAngle) * orbitRx * dirSign
      let ty = Math.cos(startAngle) * orbitRy * dirSign
      const tl = Math.hypot(tx, ty) || 1
      tx /= tl
      ty /= tl

      const seg = L / 19
      const spine = []
      for (let i = 0; i < 20; i += 1) {
        spine.push({ x: headX - tx * seg * i, y: headY - ty * seg * i })
      }

      this.sharks.push({
        id: index + 1,
        kind,
        size,
        L,
        baseL,
        depth: size,
        orbitRx,
        orbitRy,
        orbitDir: dirSign,
        angle: Math.atan2(ty, tx),
        headingX: tx,
        headingY: ty,
        speed: 30,
        turn: 0,
        phase: rand() * TAU,
        wander: 0,
        hunger: 0.25 + rand() * 0.5,
        target: null,
        targetScore: Infinity,
        searchTimer: rand() * 0.45,
        spine,
      })
    })
  }

  /* ------------------------------- 模拟步进 ------------------------------- */

  advance(realDt) {
    const frameDt = Math.min(0.1, Math.max(0, realDt || 0))
    this.accumulator += frameDt * this.speed
    let steps = 0
    while (this.accumulator >= FIXED_STEP && steps < 4) {
      this.step(FIXED_STEP)
      this.accumulator -= FIXED_STEP
      steps += 1
    }
    if (steps === 4 && this.accumulator >= FIXED_STEP) this.accumulator = 0
    this.renderFrame(frameDt)
  }

  buildHash() {
    const R = this.bucketR
    const hash = new Map()
    for (const fish of this.fish) {
      if (!fish.alive) continue
      const bx = Math.floor(fish.x / R)
      const by = Math.floor(fish.y / R)
      const key = bucketKey(bx, by)
      let list = hash.get(key)
      if (!list) {
        list = []
        hash.set(key, list)
      }
      list.push(fish)
    }
    this.hash = hash
  }

  step(dt) {
    this.time += dt
    this.buildHash()
    this.updateGroupCenters()
    this.updateFish(dt)
    this.updateSharks(dt)
    this.expireFish(dt)
  }

  updateGroupCenters() {
    for (const group of this.groups) {
      group.cx = 0
      group.cy = 0
      group.count = 0
    }
    for (const fish of this.fish) {
      if (!fish.alive) continue
      const group = this.groups[fish.group]
      if (!group) continue
      group.cx += fish.x
      group.cy += fish.y
      group.count += 1
    }
    for (const group of this.groups) {
      if (group.count > 0) {
        group.cx /= group.count
        group.cy /= group.count
      }
    }
  }

  updateFish(dt) {
    const W = this.W
    const H = this.H
    const cw = this.cw
    const ch = this.ch
    const R = this.bucketR
    const time = this.time
    const sharks = this.sharks
    const pointer = this.pointer
    const rand = this.rand

    for (const fish of this.fish) {
      if (!fish.alive) continue
      const spec = SPECIES[fish.species] || SPECIES.sardine
      let ax = 0
      let ay = 0
      let maxNeighborAlarm = 0
      let sameCount = 0
      let alignX = 0
      let alignY = 0
      let cohesionX = 0
      let cohesionY = 0
      const visionX = Math.cos(fish.dir)
      const visionY = Math.sin(fish.dir)
      const bx = Math.floor(fish.x / R)
      const by = Math.floor(fish.y / R)

      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const list = this.hash.get(bucketKey(bx + ox, by + oy))
          if (!list) continue
          for (const other of list) {
            if (other === fish) continue
            const dx = other.x - fish.x
            const dy = other.y - fish.y
            const dist = Math.hypot(dx, dy)
            if (dist >= R || dist <= 1e-6) continue
            if (other.alarm > maxNeighborAlarm) maxNeighborAlarm = other.alarm
            if ((dx * visionX + dy * visionY) / dist <= -0.6) continue

            const sx = dx / (spec.spacingX * cw * (1 + 1.8 * fish.alarm))
            const sy = dy / (spec.spacingY * ch * (1 + 1.8 * fish.alarm))
            const ql = Math.hypot(sx, sy)
            if (ql < 1 && ql > 1e-6) {
              const k = (1 - ql) / ql
              ax += -sx * k * 420
              ay += -sy * k * 420
            }

            if (other.species !== fish.species) {
              const crossRadius = cw * 3
              if (dist < crossRadius) {
                const k = (0.6 * (1 - dist / crossRadius)) / dist
                ax += (dx / dist) * k
                ay += (dy / dist) * k
              }
            } else {
              sameCount += 1
              alignX += other.vx - fish.vx
              alignY += other.vy - fish.vy
              cohesionX += dx
              cohesionY += dy
            }
          }
        }
      }

      if (sameCount > 0) {
        const alignScale = (1.4 * spec.align) / sameCount
        ax += alignX * alignScale
        ay += alignY * alignScale
        const cohesionScale = (spec.cohesion * (1 - 0.8 * fish.alarm)) / sameCount
        ax += cohesionX * cohesionScale
        ay += cohesionY * cohesionScale
      }

      if (spec.mill) {
        const group = this.groups[fish.group]
        if (group) {
          const dx = fish.x - group.cx
          const dy = fish.y - group.cy
          const dl = Math.hypot(dx, dy)
          if (dl > 1e-4) {
            const tangentX = -dy / dl
            const tangentY = dx / dl
            const strength = spec.mill * (1 - fish.alarm)
            ax += tangentX * fish.millDir * strength
            ay += tangentY * fish.millDir * strength
          }
        }
      }

      let fear = 0
      for (const shark of sharks) {
        const fearRadius = 0.6 * shark.L + 60
        let bestDist = Infinity
        let nodeX = 0
        let nodeY = 0
        for (const index of [0, 3, 6, 9, 12]) {
          const node = shark.spine[index]
          const dx = fish.x - node.x
          const dy = fish.y - node.y
          const dist = Math.hypot(dx, dy)
          if (dist < bestDist) {
            bestDist = dist
            nodeX = node.x
            nodeY = node.y
          }
        }
        if (bestDist < fearRadius && bestDist > 1e-4) {
          const w = 1 - bestDist / fearRadius
          const dx = fish.x - nodeX
          const dy = fish.y - nodeY
          const awayX = dx / bestDist
          const awayY = dy / bestDist
          const cross = shark.headingX * dy - shark.headingY * dx
          const side = cross >= 0 ? 1 : -1
          const lateralX = -shark.headingY * side
          const lateralY = shark.headingX * side
          const magnitude = 1100 * w * w
          ax += magnitude * (0.7 * awayX + 0.9 * lateralX)
          ay += magnitude * (0.7 * awayY + 0.9 * lateralY)
          fear = Math.max(fear, w)
        }
      }

      if (pointer.active) {
        const dx = fish.x - pointer.x
        const dy = fish.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < 130 && dist > 1e-4) {
          const q = 1 - dist / 130
          const magnitude = 1100 * q * q
          ax += (dx / dist) * magnitude
          ay += (dy / dist) * magnitude
          fear = Math.max(fear, 0.8 * q)
        }
      }

      let alarm = Math.max(fish.alarm * Math.exp(-0.7 * dt), fear)
      const propagated = maxNeighborAlarm * 0.86
      if (propagated > alarm) {
        alarm += (propagated - alarm) * Math.min(1, 6 * dt)
      }
      fish.alarm = Math.min(1, alarm)

      // 软墙
      const margin = 36
      if (fish.x < margin) ax += (margin - fish.x) * 7
      if (fish.x > W - margin) ax -= (fish.x - (W - margin)) * 7
      if (fish.y < margin) ay += (margin - fish.y) * 7
      if (fish.y > H - margin) ay -= (fish.y - (H - margin)) * 7

      // 旋流
      const a = fish.x / 260 + 0.07 * time
      const b = fish.y / 310 - 0.05 * time
      const c = (fish.x + fish.y) / 190 + 0.11 * time
      const u = (-Math.sin(a) * Math.sin(b) / 310 + (0.5 * Math.cos(c)) / 190) * 3400
      const v = (-Math.cos(a) * Math.cos(b) / 260 - (0.5 * Math.cos(c)) / 190) * 3400
      ax += u * 0.5
      ay += v * 0.5

      // 抖动
      ax += (rand() - 0.5) * spec.jitter
      ay += (rand() - 0.5) * spec.jitter

      // 垂直阻尼
      ay -= fish.vy * spec.verticalDrag * (1 - 0.7 * fish.alarm)

      // 目标速度
      const currentSpeed = Math.hypot(fish.vx, fish.vy)
      const targetSpeed = spec.cruise * (1 + 1.3 * fish.alarm)
      if (currentSpeed > 1e-4) {
        const k = (targetSpeed - currentSpeed) * 1.6
        ax += (fish.vx / currentSpeed) * k
        ay += (fish.vy / currentSpeed) * k
      }

      fish.vx += ax * dt
      fish.vy += ay * dt

      let newSpeed = Math.hypot(fish.vx, fish.vy)
      const maxSpeed = spec.maxSpeed * (1 + 1.8 * fish.alarm)
      if (newSpeed > maxSpeed && newSpeed > 1e-6) {
        fish.vx = (fish.vx / newSpeed) * maxSpeed
        fish.vy = (fish.vy / newSpeed) * maxSpeed
        newSpeed = maxSpeed
      } else if (newSpeed < spec.minSpeed && newSpeed > 1e-6) {
        fish.vx = (fish.vx / newSpeed) * spec.minSpeed
        fish.vy = (fish.vy / newSpeed) * spec.minSpeed
        newSpeed = spec.minSpeed
      } else if (newSpeed <= 1e-6) {
        fish.vx = Math.cos(fish.dir) * spec.cruise
        fish.vy = Math.sin(fish.dir) * spec.cruise
        newSpeed = spec.cruise
      }

      const desired = Math.atan2(fish.vy, fish.vx)
      const diff = angleDiff(desired, fish.dir)
      fish.turn = diff
      fish.dir += diff * Math.min(1, 8 * dt)

      fish.x = clamp(fish.x + fish.vx * dt, -60, W + 60)
      fish.y = clamp(fish.y + fish.vy * dt, -60, H + 60)
      fish.phase += dt * (7 + newSpeed * 0.12)
    }
  }

  searchTarget(shark) {
    const head = shark.spine[0]
    const searchRadius = 0.9 * shark.L + 160
    let best = null
    let bestScore = Infinity

    for (const fish of this.fish) {
      if (!fish.alive) continue
      const dx = fish.x - head.x
      const dy = fish.y - head.y
      const dist = Math.hypot(dx, dy)
      if (dist > searchRadius || dist < 1e-4) continue
      const cos = (dx * shark.headingX + dy * shark.headingY) / dist
      if (cos < 0.2) continue
      const bucket = this.hash.get(bucketKey(Math.floor(fish.x / this.bucketR), Math.floor(fish.y / this.bucketR)))
      const bucketCount = bucket ? bucket.length : 0
      const score = dist * (1 + 0.8 * (1 - cos)) * (1 + 0.07 * bucketCount)
      if (score < bestScore) {
        bestScore = score
        best = fish
      }
    }

    if (best && bestScore < Infinity) {
      if (shark.target && shark.target.alive && shark.targetScore < bestScore * 1.3) return
      shark.target = best
      shark.targetScore = bestScore
    } else if (!shark.target || !shark.target.alive) {
      shark.target = null
      shark.targetScore = Infinity
    }
  }

  updateSharks(dt) {
    const W = this.W
    const H = this.H
    const cx = W / 2
    const cy = H / 2
    const rand = this.rand
    const sharks = this.sharks
    const time = this.time

    for (const shark of sharks) {
      shark.hunger = Math.min(1, shark.hunger + 0.03 * dt)
      shark.searchTimer -= dt
      if (shark.searchTimer <= 0) {
        shark.searchTimer = 0.45
        this.searchTarget(shark)
      }

      const head = shark.spine[0]
      const hunting = shark.hunger > 0.3 && shark.target && shark.target.alive
      let closing = 0

      shark.wander = clamp(shark.wander + (rand() - 0.5) * dt * 3.2, -1.1, 1.1)

      // 头朝向 + 0.45 倍游走
      let steerX = Math.cos(shark.angle + shark.wander * 0.45)
      let steerY = Math.sin(shark.angle + shark.wander * 0.45)

      if (hunting) {
        const target = shark.target
        const px = target.x + target.vx * 0.35
        const py = target.y + target.vy * 0.35
        const dx = px - head.x
        const dy = py - head.y
        const dist = Math.hypot(dx, dy) || 1
        closing = clamp(1 - dist / (0.9 * shark.L), 0, 1)
        const weight = 1.4 + 2.6 * shark.hunger
        steerX += (dx / dist) * weight
        steerY += (dy / dist) * weight
      } else {
        const angle = Math.atan2(head.y - cy, head.x - cx)
        const pulse = 1 + 0.15 * Math.sin(0.05 * time + shark.id)
        const rx = shark.orbitRx * pulse
        const ry = shark.orbitRy * pulse
        const orbitX = cx + Math.cos(angle) * rx
        const orbitY = cy + Math.sin(angle) * ry
        let tx = -Math.sin(angle) * rx * shark.orbitDir
        let ty = Math.cos(angle) * ry * shark.orbitDir
        const tl = Math.hypot(tx, ty) || 1
        tx /= tl
        ty /= tl
        let radialX = orbitX - head.x
        let radialY = orbitY - head.y
        const rl = Math.hypot(radialX, radialY) || 1
        radialX /= rl
        radialY /= rl
        steerX += (tx + 0.9 * radialX) * 0.55
        steerY += (ty + 0.9 * radialY) * 0.55
      }

      // 鲨鱼互避
      for (const other of sharks) {
        if (other === shark) continue
        const range = 0.45 * (shark.L + other.L)
        for (let i = 0; i < 20; i += 4) {
          const a = shark.spine[i]
          for (let j = 0; j < 20; j += 4) {
            const b = other.spine[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist = Math.hypot(dx, dy)
            if (dist < range && dist > 1e-4) {
              const w = 3 * (1 - dist / range)
              steerX += (dx / dist) * w
              steerY += (dy / dist) * w
            }
          }
        }
      }

      // 标题区椭圆避让
      const ex = (head.x - cx) / (0.3 * W)
      const ey = (head.y - cy) / (0.16 * H)
      const nd = Math.hypot(ex, ey)
      if (nd < 1 && nd > 1e-4) {
        const weight = (1 - nd) * (hunting ? 1 : 2.5)
        let gx = ex / (0.3 * W)
        let gy = ey / (0.16 * H)
        const gl = Math.hypot(gx, gy) || 1
        steerX += (gx / gl) * weight
        steerY += (gy / gl) * weight
      }

      // 边界转向：-.05L 至 .3L 平滑过渡
      const edge = Math.min(head.x, head.y, W - head.x, H - head.y)
      const edgeT = clamp((0.3 * shark.L - edge) / (0.35 * shark.L), 0, 1)
      if (edgeT > 0) {
        let dx = cx - head.x
        let dy = cy - head.y
        const dl = Math.hypot(dx, dy) || 1
        dx /= dl
        dy /= dl
        steerX += dx * 3.5 * edgeT
        steerY += dy * 3.5 * edgeT
      }

      const desiredAngle = Math.atan2(steerY, steerX)
      const maxTurn = Math.min(hunting ? 1.7 + closing : 0.8, shark.speed / (0.22 * shark.L))
      const targetTurn = clamp(
        angleDiff(desiredAngle, shark.angle) / Math.max(dt, 1e-4),
        -maxTurn,
        maxTurn,
      )
      shark.turn += (targetTurn - shark.turn) * Math.min(1, 3 * dt)
      shark.angle += shark.turn * dt
      shark.angle = Math.atan2(Math.sin(shark.angle), Math.cos(shark.angle))

      const cruise = 30 + 0.04 * shark.L
      const targetSpeed = cruise * (hunting ? 1.45 + 1.5 * closing : 1)
      shark.speed += (targetSpeed - shark.speed) * Math.min(1, 1.1 * dt)
      shark.phase += dt * (2 + shark.speed / 24)

      shark.headingX = Math.cos(shark.angle)
      shark.headingY = Math.sin(shark.angle)
      head.x += shark.headingX * shark.speed * dt
      head.y += shark.headingY * shark.speed * dt

      // 20 节脊柱，每节精确 L/19，逐节最多偏 ±0.16 弧度
      const seg = shark.L / 19
      const backAngle = Math.atan2(-shark.headingY, -shark.headingX)
      for (let i = 1; i < 20; i += 1) {
        const prev = shark.spine[i - 1]
        const node = shark.spine[i]
        const segAngle = Math.hypot(node.x - prev.x, node.y - prev.y) > 1e-6
          ? Math.atan2(node.y - prev.y, node.x - prev.x)
          : backAngle
        const prevAngle = i >= 2
          ? Math.atan2(shark.spine[i - 1].y - shark.spine[i - 2].y, shark.spine[i - 1].x - shark.spine[i - 2].x)
          : backAngle
        const constrained = prevAngle + clamp(angleDiff(segAngle, prevAngle), -0.16, 0.16)
        node.x = prev.x + Math.cos(constrained) * seg
        node.y = prev.y + Math.sin(constrained) * seg
      }

      // 捕食
      if (shark.hunger > 0.15) {
        const mouthRadius = 0.05 * shark.L + 8
        for (const fish of this.fish) {
          if (!fish.alive) continue
          if (Math.hypot(fish.x - head.x, fish.y - head.y) < mouthRadius) {
            fish.alive = false
            fish.expireAt = this.time + 3 + rand() * 5
            shark.hunger = Math.max(0, shark.hunger - 0.16)
            this.events.push({ type: 'eat', x: fish.x, y: fish.y })
          }
        }
      }
    }
  }

  expireFish(dt) {
    let expiredNow = 0
    if (this.fish.some((fish) => !fish.alive)) {
      const next = []
      for (const fish of this.fish) {
        if (fish.alive) {
          next.push(fish)
        } else if (this.time >= fish.expireAt) {
          expiredNow += 1
        } else {
          next.push(fish)
        }
      }
      if (expiredNow > 0) this.fish = next
    }

    if (expiredNow > 0) {
      this.expiredSinceSpawn += expiredNow
      this.expireClock = 0
    }
    if (this.expiredSinceSpawn > 0) this.expireClock += dt

    if (this.expiredSinceSpawn >= 6 || this.expireClock >= 9) {
      this.spawnSchool()
      this.expiredSinceSpawn = 0
      this.expireClock = 0
    }
    this.aliveCount = this.fish.reduce((count, fish) => count + (fish.alive ? 1 : 0), 0)
  }

  spawnSchool() {
    const rand = this.rand
    const speciesKey = pickSpecies(rand)
    const spec = SPECIES[speciesKey]
    const alive = this.fish.reduce((count, fish) => count + (fish.alive ? 1 : 0), 0)
    const size = Math.min(spec.group[1], Math.max(0, MAX_FISH - alive))
    if (size <= 0) return

    const side = Math.floor(rand() * 4)
    let sx = 0
    let sy = 0
    if (side === 0) {
      sx = rand() * this.W
      sy = -20
    } else if (side === 1) {
      sx = this.W + 20
      sy = rand() * this.H
    } else if (side === 2) {
      sx = rand() * this.W
      sy = this.H + 20
    } else {
      sx = -20
      sy = rand() * this.H
    }

    const baseAngle = Math.atan2(this.H / 2 - sy, this.W / 2 - sx) + (rand() * 2 - 1) * 0.5
    const spreadX = spec.spacingX * this.cw * Math.sqrt(size)
    const spreadY = spec.spacingY * this.ch * Math.sqrt(size) * 0.6
    const millDir = rand() < 0.5 ? 1 : -1
    const groupIndex = this.groups.length
    this.groups.push({ index: groupIndex, cx: sx, cy: sy, species: speciesKey, millDir })

    for (let i = 0; i < size; i += 1) {
      const x = clamp(sx + (rand() * 2 - 1) * spreadX, -60, this.W + 60)
      const y = clamp(sy + (rand() * 2 - 1) * spreadY, -60, this.H + 60)
      this.fish.push({
        species: speciesKey,
        x, y,
        homeX: x, homeY: y,
        vx: Math.cos(baseAngle) * spec.cruise * 1.4,
        vy: Math.sin(baseAngle) * spec.cruise * 1.4,
        dir: baseAngle,
        turn: 0,
        depth: 0.55 + rand() * 0.45,
        phase: rand() * TAU,
        group: groupIndex,
        millDir,
        alarm: 0,
        alive: true,
        expireAt: Infinity,
      })
    }
  }

  /* ------------------------------- 尾迹场 -------------------------------- */

  updateWake(dt) {
    if (!this.energy) return
    const cols = this.cols
    const rows = this.rows
    const energy = this.energy
    const next = this.energyNext
    const heat = this.heat

    if (dt > 0) {
      const decay = Math.exp(-1.5 * dt)
      for (let r = 0; r < rows; r += 1) {
        const rowOffset = r * cols
        for (let c = 0; c < cols; c += 1) {
          const i = rowOffset + c
          const self = energy[i]
          const up = r > 0 ? energy[i - cols] : self
          const down = r < rows - 1 ? energy[i + cols] : self
          const left = c > 0 ? energy[i - 1] : self
          const right = c < cols - 1 ? energy[i + 1] : self
          next[i] = ((4 * self + up + down + left + right) / 8) * decay
        }
      }
      this.energyNext = energy
      this.energy = next
      const heatDecay = Math.exp(-2.2 * dt)
      for (let i = 0; i < heat.length; i += 1) heat[i] *= heatDecay
    }

    const field = this.energy
    for (const fish of this.fish) {
      if (!fish.alive) continue
      const c = clamp(Math.floor(fish.x / this.cw), 0, cols - 1)
      const r = clamp(Math.floor(fish.y / this.ch), 0, rows - 1)
      field[r * cols + c] += 0.012 + 0.03 * fish.alarm
    }
    for (const shark of this.sharks) {
      for (let i = 14; i < 20; i += 1) {
        const node = shark.spine[i]
        const c = clamp(Math.floor(node.x / this.cw), 0, cols - 1)
        const r = clamp(Math.floor(node.y / this.ch), 0, rows - 1)
        field[r * cols + c] += 0.05 + 0.0012 * shark.speed
      }
    }
    if (this.pointer.active) {
      this.stamp(this.energy, this.pointer.x, this.pointer.y, 1, 0.08)
    }

    for (const event of this.events) {
      if (event.type === 'eat') {
        this.stamp(this.heat, event.x, event.y, 2, 1)
        this.stamp(this.energy, event.x, event.y, 3, 0.9)
      } else if (event.type === 'splash') {
        this.stamp(this.energy, event.x, event.y, 6, 1.4)
      }
    }
    this.events = []
  }

  stamp(field, x, y, radius, amount) {
    if (!field) return
    const cols = this.cols
    const rows = this.rows
    const cx = x / this.cw
    const cy = y / this.ch
    const c0 = Math.floor(cx)
    const r0 = Math.floor(cy)
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const col = c0 + dc
        const row = r0 + dr
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue
        const dx = col + 0.5 - cx
        const dy = (row + 0.5 - cy) / 1.4
        const d = Math.hypot(dx, dy)
        if (d >= radius + 1) continue
        const i = row * cols + col
        field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)))
      }
    }
  }

  /* -------------------------------- 交互 --------------------------------- */

  setPointer(x, y, active) {
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.active = !!active
    if (!active && this.onNeedsRender) this.onNeedsRender()
  }

  moveVirtualPointer(dx, dy) {
    this.virtualPointer.x = clamp(this.virtualPointer.x + dx, 0, this.W)
    this.virtualPointer.y = clamp(this.virtualPointer.y + dy, 0, this.H)
    this.virtualPointer.active = true
    if (this.onNeedsRender) this.onNeedsRender()
  }

  splash(x, y) {
    for (const fish of this.fish) {
      if (!fish.alive) continue
      const dx = fish.x - x
      const dy = fish.y - y
      const dist = Math.hypot(dx, dy)
      if (dist < 240 && dist > 1e-4) {
        const boost = (1 - dist / 240) * 260
        fish.vx += (dx / dist) * boost
        fish.vy += (dy / dist) * boost
        fish.alarm = 1
      }
    }
    this.events.push({ type: 'splash', x, y })
    if (this.onNeedsRender) this.onNeedsRender()
  }

  splashVirtual() {
    const point = this.virtualPointer.active
      ? this.virtualPointer
      : { x: this.W / 2, y: this.H / 2 }
    this.splash(point.x, point.y)
  }

  setSpeed(value) {
    this.speed = clamp(Number(value) || 1, 0.25, 2)
  }

  setOptions(partial) {
    if (!partial) return
    if (partial.seed !== undefined) this.options.seed = partial.seed
    if (partial.fishCount !== undefined) this.options.fishCount = partial.fishCount
    if (partial.sharks !== undefined) this.options.sharks = partial.sharks
    if (partial.speed !== undefined) this.setSpeed(partial.speed)
  }

  /* -------------------------------- 渲染 --------------------------------- */

  renderOnce(dt = 0) {
    this.renderFrame(dt)
  }

  renderFrame(dt) {
    const ctx = this.ctx
    if (!ctx || !this.built) return
    this.updateWake(dt)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (this.gridCanvas) {
      ctx.drawImage(this.gridCanvas, 0, 0)
    } else {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.max(8, Math.round(this.ch * 0.74))}px "Geist Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`

    const fishCells = new Map()
    for (const fish of this.fish) {
      if (!fish.alive) continue
      const col = clamp(Math.floor(fish.x / this.cw), 0, this.cols - 1)
      const row = clamp(Math.floor(fish.y / this.ch), 0, this.rows - 1)
      const key = row * this.cols + col
      const current = fishCells.get(key)
      if (!current || current.depth < fish.depth) fishCells.set(key, fish)
    }

    const sortedSharks = this.sharks.slice().sort((a, b) => a.L - b.L)
    const sharkCells = []
    const occupied = new Set(fishCells.keys())
    for (const shark of sortedSharks) {
      const cells = this.buildSharkCells(shark)
      sharkCells.push({ shark, cells })
      for (const cell of cells) occupied.add(cell.row * this.cols + cell.col)
    }

    this.drawTrails(occupied)
    this.drawHeat(occupied)
    this.drawFish(fishCells)
    for (const entry of sharkCells) this.drawShark(entry.shark, entry.cells)
    this.drawPointer()
  }

  drawTrails(occupied) {
    const ctx = this.ctx
    const cols = this.cols
    const rows = this.rows
    const size = Math.max(2, Math.round(this.cw * 0.19)) + 1
    for (let i = 0; i < cols * rows; i += 1) {
      const level = this.energy[i]
      if (level <= 0.45) continue
      if (occupied.has(i)) continue
      const alpha = clamp(Math.floor((level - 0.45) * 5), 0, 5) + 1
      const col = i % cols
      const row = Math.floor(i / cols)
      ctx.fillStyle = `rgba(110,230,255,${alpha / 6})`
      ctx.fillRect(
        (col + 0.66) * this.cw - size / 2,
        (row + 0.64) * this.ch - size / 2,
        size,
        size,
      )
    }
  }

  drawHeat(occupied) {
    const ctx = this.ctx
    const cols = this.cols
    const rows = this.rows
    for (let i = 0; i < cols * rows; i += 1) {
      const level = this.heat[i]
      if (level <= 0.08) continue
      if (occupied.has(i)) continue
      const col = i % cols
      const row = Math.floor(i / cols)
      const alpha = clamp(level * 0.9, 0.12, 1)
      ctx.fillStyle = level > 0.45
        ? `rgba(255,140,40,${alpha})`
        : `rgba(255,90,60,${alpha})`
      ctx.fillText(level > 0.45 ? '*' : '·', (col + 0.5) * this.cw, (row + 0.5) * this.ch + 1)
    }
  }

  drawFish(fishCells) {
    const ctx = this.ctx
    const cols = this.cols
    for (const [key, fish] of fishCells) {
      const col = key % cols
      const row = Math.floor(key / cols)
      const brightness = 0.3
        + 0.4 * clamp((fish.depth - 0.55) / 0.45, 0, 1)
        + 0.3 * Math.max(clamp(Math.abs(fish.turn) / 3.5, 0, 1), fish.alarm)
      const bucket = clamp(Math.floor(brightness * 5), 0, 4)
      ctx.fillStyle = `rgba(230,238,255,${FISH_ALPHAS[bucket]})`
      ctx.fillText('-', (col + 0.5) * this.cw, (row + 0.5) * this.ch + 1)
    }
  }

  drawPointer() {
    const ctx = this.ctx
    const points = []
    if (this.pointer.active) points.push({ x: this.pointer.x, y: this.pointer.y, color: 'rgba(255,255,255,0.34)' })
    if (this.virtualPointer.active) points.push({ x: this.virtualPointer.x, y: this.virtualPointer.y, color: 'rgba(255,255,255,0.62)' })
    for (const point of points) {
      const x = point.x
      const y = point.y
      ctx.strokeStyle = point.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, TAU)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - 14, y)
      ctx.lineTo(x - 5, y)
      ctx.moveTo(x + 5, y)
      ctx.lineTo(x + 14, y)
      ctx.moveTo(x, y - 14)
      ctx.lineTo(x, y - 5)
      ctx.moveTo(x, y + 5)
      ctx.lineTo(x, y + 14)
      ctx.stroke()
    }
  }

  /* ----------------------------- 鲨鱼几何 ------------------------------ */

  buildOutline(shark) {
    const points = []
    const L = shark.L
    for (let k = 0; k < 20; k += 1) {
      const s = k / 19
      const prev = shark.spine[Math.max(0, k - 1)]
      const next = shark.spine[Math.min(19, k + 1)]
      let tx = next.x - prev.x
      let ty = next.y - prev.y
      const len = Math.hypot(tx, ty) || 1
      tx /= len
      ty /= len
      const nx = -ty
      const ny = tx
      const wave = L * 0.05
        * (0.1 + 0.9 * Math.pow(s, 1.8))
        * clamp(shark.speed / 60, 0.4, 1.4)
        * Math.sin(shark.phase - 5.2 * s)
      points.push({ x: shark.spine[k].x + nx * wave, y: shark.spine[k].y + ny * wave })
    }

    const segments = []
    let total = 0
    for (let k = 0; k < points.length - 1; k += 1) {
      const a = points[k]
      const b = points[k + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) continue
      segments.push({ ax: a.x, ay: a.y, tx: dx / len, ty: dy / len, len, start: total })
      total += len
    }
    return { points, segments, total }
  }

  nearestSegment(segments, x, y) {
    let best = null
    let bestDist = Infinity
    for (const seg of segments) {
      let t = ((x - seg.ax) * seg.tx + (y - seg.ay) * seg.ty) / seg.len
      t = clamp(t, 0, 1)
      const qx = seg.ax + seg.tx * seg.len * t
      const qy = seg.ay + seg.ty * seg.len * t
      const dx = x - qx
      const dy = y - qy
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = { seg, t, qx, qy }
      }
    }
    return best
  }

  hitShark(shark, s, v) {
    const style = SHARK_STYLE[shark.kind] || SHARK_STYLE.classic
    const L = shark.L
    const bw = Math.max(0, halfWidthFraction(shark.kind, s) * L)
    const av = Math.abs(v)

    if (bw > 0 && av <= bw) {
      if (!style.wing && style.eye && inRange(style.eye, s) && av >= bw * 0.55 && av <= bw * 0.95) {
        return { hit: 'eye', s, v }
      }
      if (inRange(style.dorsal1, s) && av < bw * 0.35) {
        const rs = (s - style.dorsal1[0]) / Math.max(1e-6, style.dorsal1[1] - style.dorsal1[0])
        if (rs >= 0.35 && rs <= 0.65) return { hit: 'ridge', s, v, ridge: 1 }
      }
      if (inRange(style.dorsal2, s) && av < bw * 0.35) {
        const rs = (s - style.dorsal2[0]) / Math.max(1e-6, style.dorsal2[1] - style.dorsal2[0])
        if (rs >= 0.3 && rs <= 0.7) return { hit: 'ridge', s, v, ridge: 2 }
      }
      return { hit: 'body', s, v }
    }

    if (style.wing) {
      const [span, sweep, depth, notch] = style.wing
      const r = av / Math.max(1e-6, L * span)
      if (r <= 1) {
        const lead = L * (sweep * r * r + notch * Math.max(0, 1 - r / 0.14))
        const thick = L * depth * (1 - 0.2 * r * r * r * r)
        const u = s * L
        if (u >= lead && u <= lead + thick) {
          return { hit: r > 0.84 ? 'eye' : 'wing', s, v }
        }
      }
    }

    const side = v >= 0 ? 1 : -1
    const turnScale = 1 + side * clamp(0.45 * shark.turn, -0.35, 0.35)
    const flutter = 1 + 0.06 * Math.sin(0.5 * shark.phase)

    if (this.hitsFin(style.pectoral, s, v, L, turnScale * flutter, style.falcate)) {
      return { hit: 'fin', s, v }
    }
    if (this.hitsFin(style.pelvic, s, v, L, turnScale * flutter, false)) {
      return { hit: 'fin', s, v }
    }
    if (style.tailReach > 0) {
      const reach = style.tailReach * L
      const u = s * L
      if (pointInTriangle(u, v, 0.86 * L, 0, 0.95 * L, side * reach, L, 0)) {
        return { hit: 'fin', s, v }
      }
    }
    return null
  }

  hitsFin(params, s, v, L, scale, falcate) {
    const [root0, root1, tip, reach] = params
    const side = v >= 0 ? 1 : -1
    const reachWorld = reach * L * scale
    const ax = root0 * L
    const bx = root1 * L
    const cxp = tip * L
    const u = s * L
    if (!pointInTriangle(u, v, ax, 0, bx, 0, cxp, side * reachWorld)) return false
    if (falcate) {
      const notchX = (bx + cxp) / 2 + (ax - bx) * 0.18
      const notchY = side * reachWorld * 0.35
      if (pointInTriangle(u, v, bx, 0, cxp, side * reachWorld, notchX, notchY)) return false
    }
    return true
  }

  buildSharkCells(shark) {
    const outline = this.buildOutline(shark)
    if (!outline.segments.length || outline.total <= 0) return []
    const cells = []
    const pad = shark.L * 0.32 + Math.max(this.cw, this.ch)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const point of outline.points) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad

    const c0 = clamp(Math.floor(minX / this.cw), 0, this.cols - 1)
    const c1 = clamp(Math.ceil(maxX / this.cw), 0, this.cols - 1)
    const r0 = clamp(Math.floor(minY / this.ch), 0, this.rows - 1)
    const r1 = clamp(Math.ceil(maxY / this.ch), 0, this.rows - 1)

    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const px = (col + 0.5) * this.cw
        const py = (row + 0.5) * this.ch
        const near = this.nearestSegment(outline.segments, px, py)
        if (!near) continue
        const baseS = clamp((near.seg.start + near.t * near.seg.len) / outline.total, 0, 1)
        const baseV = near.seg.tx * (py - near.seg.ay) - near.seg.ty * (px - near.seg.ax)

        let hits = 0
        let centerResult = null
        let firstResult = null
        for (let i = 0; i < SAMPLE_POINTS.length; i += 1) {
          const sample = SAMPLE_POINTS[i]
          const sx = col * this.cw + sample[0] * this.cw
          const sy = row * this.ch + sample[1] * this.ch
          const t = clamp(((sx - near.seg.ax) * near.seg.tx + (sy - near.seg.ay) * near.seg.ty) / near.seg.len, 0, 1)
          const s = clamp((near.seg.start + t * near.seg.len) / outline.total, 0, 1)
          const v = near.seg.tx * (sy - near.seg.ay) - near.seg.ty * (sx - near.seg.ax)
          const result = this.hitShark(shark, s, v)
          if (result) {
            hits += 1
            if (i === 0) centerResult = result
            if (!firstResult) firstResult = result
          }
        }

        if (hits === 0) continue
        const solid = hits >= 3 && !!centerResult
        const result = centerResult || firstResult
        cells.push({
          col,
          row,
          solid,
          s: baseS,
          v: baseV,
          tx: near.seg.tx,
          ty: near.seg.ty,
          hit: result ? result.hit : 'body',
          ridge: result ? result.ridge : 0,
        })
      }
    }
    return cells
  }

  drawShark(shark, cells) {
    const ctx = this.ctx
    const style = SHARK_STYLE[shark.kind] || SHARK_STYLE.classic
    const L = shark.L
    const depthMul = 0.7 + 0.3 * shark.depth
    const rgb = style.rgb
    const time = this.time
    const font = Math.max(8, Math.round(this.ch * 0.74))
    ctx.font = `600 ${font}px "Geist Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`

    for (const cell of cells) {
      const s = clamp(cell.s, 0, 1)
      const v = cell.v
      const bw = Math.max(1e-6, halfWidthFraction(shark.kind, s) * L)
      const a = Math.min(1, Math.abs(v) / bw)
      const side = v >= 0 ? 1 : -1
      const nx = -cell.ty * side
      const ny = cell.tx * side
      const lightDot = nx * -0.6 + ny * -0.8
      let shade = clamp(0.58 - 0.42 * a * a + 0.26 * a * lightDot, 0, 1)
      if (s < 0.05) shade = Math.max(shade, 0.7)

      let type = cell.hit
      if (type === 'body' || type === 'fin' || type === 'wing') {
        if (style.gill && inRange(style.gill, s) && a > 0.58) {
          const band = Math.min(4, Math.floor(((s - style.gill[0]) / Math.max(1e-6, style.gill[1] - style.gill[0])) * 5))
          if (band % 2 === 1) shade *= 0.45
        }
        if (shark.kind === 'tiger' && s > 0.2 && s < 0.9 && a < 0.85) {
          const stripe = Math.sin(18 * Math.PI * s + 0.35 * Math.sin(25 * v / L + 5 * s))
          const threshold = 0.65 - 0.5 * smoothstep(0.2, 0.42, s) + 0.4 * smoothstep(0.8, 0.9, s)
          if (stripe > threshold) type = 'dark'
        }
        if (shark.kind === 'zebra' && s > 0.07) {
          const gu = s / 0.06
          const gv = v / (0.045 * L)
          const iu = Math.floor(gu)
          const iv = Math.floor(gv)
          const jx = 0.25 + 0.5 * hash3(iu, iv, shark.id)
          const jy = 0.25 + 0.5 * hash3(iv, iu, shark.id + 17)
          const du = gu - (iu + jx)
          const dv = gv - (iv + jy)
          if (du * du + dv * dv < 0.08) type = 'dark'
        }
      }

      let baseBrightness
      let ladder
      if (type === 'eye') {
        baseBrightness = 12
        ladder = 'o'
      } else if (type === 'ridge') {
        baseBrightness = 226
        shade = cell.ridge === 2 ? Math.max(shade, 0.82) : 1
        ladder = RIDGE_LADDER
      } else if (type === 'fin' || type === 'wing') {
        baseBrightness = 40 + 120 * shade
        ladder = FIN_LADDER
      } else if (type === 'dark') {
        baseBrightness = 24 + 22 * shade
        ladder = DARK_LADDER
      } else {
        baseBrightness = 46 + 160 * shade
        ladder = BODY_LADDER
      }

      const r = clamp(baseBrightness * rgb[0] * depthMul, 0, 255)
      const g = clamp(baseBrightness * rgb[1] * depthMul, 0, 255)
      const b = clamp(baseBrightness * rgb[2] * depthMul + 4, 0, 255)

      const keyInt = (Math.floor(hash3(Math.round(52 * s), Math.round(v / (0.9 * this.cw)), shark.id) * 4294967296)) >>> 0
      const frame = Math.floor(2.4 * time + (keyInt % 997) / 97)
      const colorRoll = hash3(keyInt, frame, 7)
      const charRoll = hash3(keyInt, 11, 13)
      const x = cell.col * this.cw
      const y = cell.row * this.ch

      if (!cell.solid) {
        const edgeLadder = colorRoll < 0.5 ? EDGE_LADDERS[0] : EDGE_LADDERS[1]
        const edgeChar = edgeLadder[Math.min(edgeLadder.length - 1, Math.floor(charRoll * edgeLadder.length))]
        ctx.fillStyle = `rgb(${Math.round(Math.max(52, r))},${Math.round(Math.max(58, g))},${Math.round(Math.max(66, b))})`
        ctx.fillText(edgeChar, x + this.cw / 2, y + this.ch / 2 + 1)
        continue
      }

      ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
      ctx.fillRect(x + 1, y + 1, this.cw - 1, this.ch - 1)

      let char
      if (type === 'eye') {
        char = 'o'
      } else {
        const index = Math.min(ladder.length - 1, Math.floor(charRoll * ladder.length))
        char = ladder[index]
      }

      let charColor
      if (type === 'eye') {
        charColor = '#ffffff'
      } else if (colorRoll < 0.09) {
        charColor = COLOR_PALETTE[Math.floor(hash3(keyInt, frame, 23) * COLOR_PALETTE.length)]
      } else if (colorRoll < 0.13) {
        charColor = '#ffffff'
      } else {
        charColor = baseBrightness > 120 ? '#0e0f13' : '#1b1d24'
      }
      ctx.fillStyle = charColor
      ctx.fillText(char, x + this.cw / 2, y + this.ch / 2 + 1)
    }
  }

  destroy() {
    this.canvas = null
    this.ctx = null
    this.gridCanvas = null
    this.fish = []
    this.sharks = []
    this.groups = []
    this.events = []
    this.hash = new Map()
    this.energy = null
    this.energyNext = null
    this.heat = null
    this.onNeedsRender = null
  }
}

export default AsciiSharksEngine
