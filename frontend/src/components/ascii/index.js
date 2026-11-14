/**
 * AsciiSharks 公共入口。
 *
 * 框架组件单独导入，避免把 React/Vue/Svelte 依赖带进核心：
 *   Vue     → './AsciiSharks.vue'
 *   React   → './AsciiSharks.tsx'
 *   Svelte  → './AsciiSharks.svelte'
 *   Solid   → './AsciiSharksSolid.jsx'
 *   Preact  → './AsciiSharksPreact.jsx'
 *   Vanilla → './mountAsciiSharks.js'
 */
export {
  createAsciiSharks,
  mountAsciiSharks,
} from './motion-runtime'

export {
  AsciiSharksEngine,
  SPECIES,
  SPECIES_KEYS,
  SHARK_KINDS,
  DEFAULT_SHARKS,
  COLOR_PALETTE,
  TAU,
  FIXED_STEP,
  PREWARM_STEPS,
  MAX_FISH,
  MAX_SHARKS,
  clamp,
  smoothstep,
  angleDiff,
  lerp,
  mulberry32,
  hash3,
  halfWidthFraction,
  inRange,
} from './AsciiSharksEngine.js'
