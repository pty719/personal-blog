/**
 * SelectionFlowerEngine 的类型声明。实现见 SelectionFlowerEngine.js。
 */

export interface DesignSpec {
  width: number
  height: number
  articleWidth: number
  articleLeft: number
  articleTop: number
}

export interface LeafSpec {
  t: number
  start: number
  side: number
  length: number
  swing: number
}

export interface PlantSpec {
  seed: number
  key?: string
  type: number
  budOnly: boolean
  petalCount: number
  downward: boolean
  length: number
  bend: number
  curve: number
  radius: number
  petalColor: string
  centerColor: string
  rotation: number
  leaves: LeafSpec[]
  wobblePhase: number
  wobbleAmp: number
  anchorX: number
  anchorY: number
  growth: number
  target: number
}

export interface SelectedCharacter {
  key: string
  nodeIndex: number
  offset: number
  x: number
  y: number
}

export interface EngineOptions {
  reducedMotion?: boolean
}

export class SelectionFlowerEngine {
  constructor(canvas: HTMLCanvasElement | null, options?: EngineOptions)

  article: HTMLElement | null
  plants: PlantSpec[]
  plantMap: Map<string, PlantSpec>
  scale: number
  dpr: number
  cssWidth: number
  cssHeight: number
  gestureSeed: number
  reducedMotion: boolean
  activeDrag: boolean
  onPlantsChanged: (() => void) | null

  setArticle(element: HTMLElement | null): void
  setReducedMotion(value: boolean): void
  beginGesture(seed?: number): number
  setActiveDrag(value: boolean): void
  hasPlants(): boolean
  collectSelection(): SelectedCharacter[] | null
  applyCharacters(
    characters: SelectedCharacter[],
    seed?: number,
  ): { total: number; created: number }
  releaseAll(): void
  clearPlants(): void
  finishPlants(): void
  advance(dt: number): number
  prune(): number
  resize(cssWidth: number, cssHeight: number, scale?: number): void
  render(timeMs: number): void
  drawPlant(ctx: CanvasRenderingContext2D, plant: PlantSpec, time: number): void
  destroy(): void
}

export const DESIGN: DesignSpec
export const PALETTE: string[]
export const CENTER_COLORS: string[]
export const MAX_PLANTS: number
export const PLANT_CHANCE: number
export const STEM_DARK: string
export const STEM_LIGHT: string
export const LEAF_FILL: string
export const OUTLINE: string
export const TAU: number

export function clamp(value: number, min: number, max: number): number
export function xorshift32(seed: number): () => number
export function randomSeed(): number
export function plantSeedFor(gestureSeed: number, nodeIndex: number, charOffset: number): number
export function shouldPlant(seed: number): boolean
export function easeOutBack(t: number, s?: number): number
export function quadPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number }
export function createPlantSpec(seed: number, anchorX: number, anchorY: number): PlantSpec

export function createSelectionFlower(
  host: HTMLElement,
  options?: { height?: number; reducedMotion?: boolean; attachTo?: HTMLElement | null },
): {
  update: (options?: { height?: number; reducedMotion?: boolean }) => void
  destroy: () => void
  root: HTMLElement
  engine: SelectionFlowerEngine
  getState: () => { plants: number; scale: number; reducedMotion: boolean }
}

export function mountSelectionFlower(
  host: HTMLElement,
  options?: { height?: number; reducedMotion?: boolean; attachTo?: HTMLElement | null },
): ReturnType<typeof createSelectionFlower>

export default createSelectionFlower
