/**
 * AsciiSharksEngine 的类型声明。
 * 实现见 AsciiSharksEngine.js；运行时不依赖 TypeScript。
 */

export interface AsciiSharkConfig {
  kind: string
  size?: number
}

export interface AsciiSharksSubmitPayload {
  text: string
  attachments: File[]
}

export interface AsciiSharksOptions {
  theme?: 'light' | 'dark'
  paused?: boolean
  speed?: number
  seed?: number
  fishCount?: number | null
  sharks?: AsciiSharkConfig[]
  showComposer?: boolean
  height?: number | string
  reducedMotion?: boolean
  variant?: 'default' | 'thumb'
  onSubmit?: (payload: AsciiSharksSubmitPayload) => void
  onVoiceInput?: (() => string | Promise<string> | void) | null
}

export interface AsciiSharksController {
  update: (options?: Partial<AsciiSharksOptions>) => void
  destroy: () => void
  reset: () => void
  setPaused: (paused: boolean) => void
  root: HTMLElement
  engine: AsciiSharksEngine
  getState: () => {
    paused: boolean
    theme: string
    speed: number
    showComposer: boolean
    localHistory: string[]
  }
}

export interface EngineOptions {
  seed?: number
  fishCount?: number | null
  sharks?: AsciiSharkConfig[]
  speed?: number
}

export class AsciiSharksEngine {
  constructor(canvas: HTMLCanvasElement | null, options?: EngineOptions)

  W: number
  H: number
  dpr: number
  cw: number
  ch: number
  cols: number
  rows: number
  time: number
  speed: number
  built: boolean
  fish: unknown[]
  sharks: unknown[]
  groups: unknown[]
  events: unknown[]
  onNeedsRender: (() => void) | null

  resize(width: number, height: number): void
  reset(): void
  advance(realDt: number): void
  step(dt: number): void
  renderOnce(dt?: number): void
  renderFrame(dt: number): void
  setPointer(x: number, y: number, active: boolean): void
  moveVirtualPointer(dx: number, dy: number): void
  splash(x: number, y: number): void
  splashVirtual(): void
  setSpeed(value: number): void
  setOptions(partial: EngineOptions): void
  destroy(): void
}

export function mulberry32(seed: number): () => number
export function hash3(x: number, y: number, z: number): number
export function clamp(value: number, min: number, max: number): number
export function smoothstep(a: number, b: number, x: number): number
export function angleDiff(a: number, b: number): number
export function lerp(a: number, b: number, t: number): number
export function halfWidthFraction(kind: string, s: number): number
export function inRange(range: [number, number] | null | undefined, value: number): boolean

export const TAU: number
export const FIXED_STEP: number
export const PREWARM_STEPS: number
export const MAX_FISH: number
export const MAX_SHARKS: number
export const SHARK_KINDS: string[]
export const DEFAULT_SHARKS: AsciiSharkConfig[]
export const COLOR_PALETTE: string[]
export const SPECIES: Record<string, {
  cruise: number
  maxSpeed: number
  minSpeed: number
  weight: number
  group: [number, number]
  spacingX: number
  spacingY: number
  align: number
  cohesion: number
  jitter: number
  mill: number
  verticalDrag: number
}>

export function createAsciiSharks(
  host: HTMLElement,
  options?: AsciiSharksOptions,
): AsciiSharksController

export function mountAsciiSharks(
  host: HTMLElement,
  options?: AsciiSharksOptions,
): AsciiSharksController

export default createAsciiSharks
