/**
 * SelectionFlower 公共入口。框架组件单独导入，避免把框架依赖带进核心：
 *   Vue     → './SelectionFlower.vue'
 *   React   → './SelectionFlower.tsx'
 *   Svelte  → './SelectionFlower.svelte'
 *   Solid   → './SelectionFlowerSolid.jsx'
 *   Preact  → './SelectionFlowerPreact.jsx'
 *   Vanilla → './mountSelectionFlower.js'
 */
export {
  createSelectionFlower,
  mountSelectionFlower,
} from './motion-runtime'

export {
  SelectionFlowerEngine,
  DESIGN,
  PALETTE,
  CENTER_COLORS,
  MAX_PLANTS,
  PLANT_CHANCE,
  TAU,
  clamp,
  xorshift32,
  randomSeed,
  plantSeedFor,
  shouldPlant,
  easeOutBack,
  quadPoint,
  createPlantSpec,
} from './SelectionFlowerEngine.js'
