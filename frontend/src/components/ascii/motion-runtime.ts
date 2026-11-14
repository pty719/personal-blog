/**
 * motion-runtime.ts — AsciiSharks 的实例生命周期与 DOM 叠加层。
 *
 * 所有框架入口都只做一件事：在挂载后把宿主元素交给 createAsciiSharks，
 * 卸载时调用 controller.destroy()。DOM 只在调用时访问，同页可多实例。
 */
import {
  AsciiSharksEngine,
  DEFAULT_SHARKS,
} from './AsciiSharksEngine.js'

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

const STYLE_ID = 'ascii-sharks-styles'
const styleRegistry = new WeakMap<Document, { el: HTMLStyleElement; count: number }>()

const HISTORY_LIMIT = 8
const MAX_ATTACHMENTS = 3
const MIN_HEIGHT = 480

const CSS = `
.as-root {
  position: relative;
  width: 100%;
  min-height: ${MIN_HEIGHT}px;
  overflow: hidden;
  background: #fff;
  color: #131612;
  font-family: Geist, Inter, Arial, sans-serif;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}
.as-root *, .as-root *::before, .as-root *::after { box-sizing: border-box; }
.as-root[data-theme="dark"] { background: #050606; color: #e8eae4; }
.as-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.as-root[data-theme="light"] .as-canvas { filter: invert(1); }
.as-root[data-variant="thumb"] { background: #f4f4f4; }
.as-root[data-variant="thumb"] .as-canvas { filter: invert(1) brightness(.956862745); }
.as-root[data-variant="thumb"] .as-composer,
.as-root[data-variant="thumb"] .as-fog,
.as-root[data-variant="thumb"] .as-history,
.as-root[data-variant="thumb"] .as-history-panel { display: none; }

.as-fog {
  position: absolute;
  inset: 13% 6%;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse, #eeeee6d9 0%, #eeeeea99 33%, #f4f4ef44 52%, transparent 73%);
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
  -webkit-mask-image: radial-gradient(ellipse, #000 30%, transparent 74%);
  mask-image: radial-gradient(ellipse, #000 30%, transparent 74%);
}
.as-root[data-reduced="true"] .as-fog {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.as-ui {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.as-composer {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(624px, calc(100% - 48px));
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
.as-title {
  margin: 0 0 24px;
  /* 岛标题借用站点衬线：控件仍是岛自己的 sans，标题是它与刊物之间的握手 */
  font-family: var(--font-serif, Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", "SimSun", serif);
  font-size: 50px;
  font-weight: 300;
  line-height: 1.14;
  letter-spacing: -0.025em;
  text-align: center;
  color: inherit;
}
.as-box {
  padding: 12px;
  border: 1px solid #d2d3cd;
  border-radius: 14px;
  background: #edeee8a8;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.as-root[data-theme="dark"] .as-box {
  border-color: #2a2c28;
  background: rgba(24, 26, 24, 0.72);
}
.as-input {
  display: block;
  width: 100%;
  min-height: 34px;
  max-height: 92px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: none;
  overflow-y: auto;
  caret-color: currentColor;
}
.as-input::placeholder { color: rgba(19, 22, 18, 0.68); }
.as-root[data-theme="dark"] .as-input::placeholder { color: rgba(232, 234, 228, 0.55); }
.as-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.as-attachments:empty { display: none; }
.as-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px 4px 2px 8px;
  border: 1px solid rgba(19, 22, 18, 0.18);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
}
.as-root[data-theme="dark"] .as-chip { border-color: rgba(232, 234, 228, 0.18); }
.as-chip-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.as-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  opacity: 0.62;
  cursor: pointer;
}
.as-chip-remove:hover { opacity: 1; background: rgba(19, 22, 18, 0.07); }
.as-root[data-theme="dark"] .as-chip-remove:hover { background: rgba(232, 234, 228, 0.08); }
.as-row {
  display: flex;
  align-items: center;
  height: 32px;
  margin-top: 8px;
  gap: 4px;
}
.as-left { display: flex; align-items: center; gap: 4px; }
.as-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(19, 22, 18, 0.72);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.as-icon-btn:hover:not(:disabled) { background: rgba(19, 22, 18, 0.06); color: #131612; }
.as-icon-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.as-root[data-theme="dark"] .as-icon-btn { color: rgba(232, 234, 228, 0.72); }
.as-root[data-theme="dark"] .as-icon-btn:hover:not(:disabled) { background: rgba(232, 234, 228, 0.08); color: #fff; }
.as-hint {
  margin-left: auto;
  font-family: "Geist Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.01em;
  color: rgba(19, 22, 18, 0.68);
  white-space: nowrap;
}
.as-root[data-theme="dark"] .as-hint { color: rgba(232, 234, 228, 0.68); }
.as-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #e3e4de;
  color: #131612;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}
.as-send:hover:not(:disabled) { background: #d8d9d2; }
.as-send:disabled { opacity: 0.45; cursor: not-allowed; }
.as-root[data-theme="dark"] .as-send { background: #2c2f2b; color: #e8eae4; }
.as-root[data-theme="dark"] .as-send:hover:not(:disabled) { background: #383c37; }

.as-history {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(19, 22, 18, 0.1);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  color: inherit;
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.as-history:hover { background: rgba(255, 255, 255, 0.86); }
.as-root[data-theme="dark"] .as-history {
  border-color: rgba(232, 234, 228, 0.12);
  background: rgba(24, 26, 24, 0.66);
}
.as-root[data-theme="dark"] .as-history:hover { background: rgba(38, 41, 36, 0.82); }
.as-history, .as-history-panel { z-index: 3; }
.as-history-panel {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 250px;
  max-height: 260px;
  overflow: auto;
  padding: 6px;
  border: 1px solid #d2d3cd;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
}
.as-root[data-theme="dark"] .as-history-panel {
  border-color: #2a2c28;
  background: rgba(18, 20, 18, 0.96);
}
.as-history-empty {
  margin: 0;
  padding: 10px 8px;
  font-size: 13px;
  color: rgba(19, 22, 18, 0.55);
}
.as-root[data-theme="dark"] .as-history-empty { color: rgba(232, 234, 228, 0.5); }
.as-history-item {
  display: block;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.as-history-item:hover { background: rgba(19, 22, 18, 0.06); }
.as-root[data-theme="dark"] .as-history-item:hover { background: rgba(232, 234, 228, 0.08); }

.as-root[data-composer="false"] .as-composer,
.as-root[data-composer="false"] .as-fog,
.as-root[data-composer="false"] .as-history,
.as-root[data-composer="false"] .as-history-panel { display: none; }

.as-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.as-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.as-root:focus { outline: none; }
.as-root:focus-visible { outline: 2px solid #131612; outline-offset: -3px; }
.as-root[data-theme="dark"]:focus-visible { outline-color: #e8eae4; }
.as-icon-btn:focus-visible,
.as-send:focus-visible,
.as-history:focus-visible,
.as-history-item:focus-visible,
.as-chip-remove:focus-visible {
  outline: 2px solid #131612;
  outline-offset: 2px;
}
.as-root[data-theme="dark"] .as-icon-btn:focus-visible,
.as-root[data-theme="dark"] .as-send:focus-visible,
.as-root[data-theme="dark"] .as-history:focus-visible,
.as-root[data-theme="dark"] .as-history-item:focus-visible,
.as-root[data-theme="dark"] .as-chip-remove:focus-visible {
  outline-color: #e8eae4;
}

@media (max-width: 560px) {
  .as-composer { width: calc(100% - 32px); }
  .as-title { font-size: clamp(25px, 6.8vw, 38px); }
  .as-hint { font-size: 12px; }
}

@media (pointer: coarse), (max-width: 1023px) {
  .as-history::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: -3px;
    bottom: -3px;
  }
  .as-left { gap: 12px; }
  .as-icon-btn { position: relative; }
  .as-icon-btn::after {
    content: "";
    position: absolute;
    inset: -6px;
  }
  .as-send { position: relative; }
  .as-send::after {
    content: "";
    position: absolute;
    inset: -6px;
  }
}
`

const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="m18 6-12 12"/><path d="m6 6 12 12"/>',
}

let uid = 0

function ensureStyles(doc: Document) {
  const existing = styleRegistry.get(doc)
  if (existing) {
    existing.count += 1
    return
  }
  let el = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = doc.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    doc.head.appendChild(el)
  }
  styleRegistry.set(doc, { el, count: 1 })
}

function releaseStyles(doc: Document) {
  const entry = styleRegistry.get(doc)
  if (!entry) return
  entry.count -= 1
  if (entry.count <= 0) {
    entry.el.remove()
    styleRegistry.delete(doc)
  }
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag)
  if (className) el.className = className
  return el
}

function makeIcon(doc: Document, name: keyof typeof ICON_PATHS, size = 19, stroke = 1.6) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', String(stroke))
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = ICON_PATHS[name]
  return svg
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return !!target.closest('input, textarea, select, button, a, [contenteditable="true"]')
}

export function createAsciiSharks(
  host: HTMLElement,
  initialOptions: AsciiSharksOptions = {},
): AsciiSharksController {
  const doc = host.ownerDocument
  const win = doc.defaultView || window
  ensureStyles(doc)

  let opts: AsciiSharksOptions = {
    theme: 'light',
    paused: false,
    speed: 1,
    seed: 7,
    fishCount: null,
    sharks: DEFAULT_SHARKS,
    showComposer: true,
    height: 880,
    variant: 'default',
    ...initialOptions,
  }

  let destroyed = false
  let paused = !!opts.paused
  let inView = true
  let systemReduced = false
  let mediaQuery: MediaQueryList | null = null
  let rafId = 0
  let lastFrame = 0
  let lastW = 0
  let lastH = 0
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  let composing = false
  let attachments: File[] = []
  let localHistory: string[] = []
  let historyOpen = false
  let touchStart: { x: number; y: number; time: number; id: number } | null = null
  let resizeObserver: ResizeObserver | null = null
  let intersectionObserver: IntersectionObserver | null = null

  const root = makeElement(doc, 'div', 'as-root')
  root.dataset.theme = opts.theme === 'dark' ? 'dark' : 'light'
  root.dataset.variant = opts.variant === 'thumb' ? 'thumb' : 'default'
  root.dataset.composer = opts.showComposer === false ? 'false' : 'true'
  root.dataset.reduced = 'false'
  root.tabIndex = 0
  root.setAttribute('role', 'region')
  root.setAttribute('aria-label', 'Interactive ASCII ocean with sharks and fish')

  const canvas = makeElement(doc, 'canvas', 'as-canvas')
  canvas.setAttribute('aria-hidden', 'true')
  root.appendChild(canvas)

  const fog = makeElement(doc, 'div', 'as-fog')
  fog.setAttribute('aria-hidden', 'true')
  root.appendChild(fog)

  const ui = makeElement(doc, 'div', 'as-ui')
  root.appendChild(ui)

  /* ------------------------------ History ------------------------------ */
  const historyId = `as-history-${++uid}`
  const historyBtn = makeElement(doc, 'button', 'as-history')
  historyBtn.type = 'button'
  historyBtn.setAttribute('aria-expanded', 'false')
  historyBtn.setAttribute('aria-controls', historyId)
  historyBtn.appendChild(makeIcon(doc, 'history', 16, 1.7))
  const historyLabel = makeElement(doc, 'span')
  historyLabel.textContent = 'History'
  historyBtn.appendChild(historyLabel)
  historyBtn.appendChild(makeIcon(doc, 'chevronDown', 14, 1.7))
  ui.appendChild(historyBtn)

  const historyPanel = makeElement(doc, 'div', 'as-history-panel')
  historyPanel.id = historyId
  historyPanel.hidden = true
  ui.appendChild(historyPanel)

  /* ------------------------------ Composer ----------------------------- */
  const composer = makeElement(doc, 'div', 'as-composer')
  const title = makeElement(doc, 'h1', 'as-title')
  title.textContent = 'what’s on your mind?'
  composer.appendChild(title)

  const box = makeElement(doc, 'div', 'as-box')
  composer.appendChild(box)

  const input = doc.createElement('textarea')
  input.className = 'as-input'
  input.rows = 1
  input.maxLength = 2000
  input.placeholder = 'Ask anything...'
  input.setAttribute('aria-label', 'Ask anything')
  box.appendChild(input)

  const attachmentList = makeElement(doc, 'ul', 'as-attachments')
  attachmentList.setAttribute('aria-label', 'Attachments')
  box.appendChild(attachmentList)

  const row = makeElement(doc, 'div', 'as-row')
  box.appendChild(row)

  const left = makeElement(doc, 'div', 'as-left')
  row.appendChild(left)

  const plusBtn = makeElement(doc, 'button', 'as-icon-btn as-plus')
  plusBtn.type = 'button'
  plusBtn.title = 'Add attachment'
  plusBtn.setAttribute('aria-label', 'Add attachment')
  plusBtn.appendChild(makeIcon(doc, 'plus'))
  left.appendChild(plusBtn)

  const micBtn = makeElement(doc, 'button', 'as-icon-btn as-mic')
  micBtn.type = 'button'
  micBtn.appendChild(makeIcon(doc, 'mic'))
  left.appendChild(micBtn)

  const hint = makeElement(doc, 'span', 'as-hint')
  hint.textContent = '↵ send · ⇧↵ newline'
  row.appendChild(hint)

  const sendBtn = makeElement(doc, 'button', 'as-send')
  sendBtn.type = 'button'
  sendBtn.setAttribute('aria-label', 'Send')
  sendBtn.appendChild(makeIcon(doc, 'arrowUpRight'))
  row.appendChild(sendBtn)

  ui.appendChild(composer)

  const fileInput = doc.createElement('input')
  fileInput.className = 'as-file'
  fileInput.type = 'file'
  fileInput.multiple = true
  fileInput.hidden = true
  fileInput.tabIndex = -1
  root.appendChild(fileInput)

  const status = makeElement(doc, 'div', 'as-sr')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  root.appendChild(status)

  host.appendChild(root)

  function applyHeight() {
    const height = opts.height
    if (typeof height === 'number') root.style.height = `${Math.max(MIN_HEIGHT, height)}px`
    else if (typeof height === 'string' && height) root.style.height = height
    else root.style.height = '880px'
    root.style.minHeight = `${MIN_HEIGHT}px`
  }
  applyHeight()

  /* ------------------------------- Engine ------------------------------ */
  const engine = new AsciiSharksEngine(canvas, {
    seed: opts.seed ?? 7,
    fishCount: opts.fishCount ?? null,
    sharks: opts.sharks || DEFAULT_SHARKS,
    speed: opts.speed ?? 1,
  })

  engine.onNeedsRender = () => {
    if (!rafId && !shouldAutoRun()) engine.renderOnce(0)
  }

  function effectiveReduced() {
    return opts.reducedMotion === true || (opts.reducedMotion == null && systemReduced)
  }

  function shouldAutoRun() {
    return !destroyed && !paused && !effectiveReduced() && inView && !doc.hidden
  }

  function requestFrame(cb: FrameRequestCallback) {
    if (typeof win.requestAnimationFrame === 'function') return win.requestAnimationFrame(cb)
    return win.setTimeout(() => cb(Date.now()), 16) as unknown as number
  }

  function cancelFrame(id: number) {
    if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(id)
    else win.clearTimeout(id)
  }

  function frame(now: number) {
    rafId = 0
    if (!shouldAutoRun()) return
    const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60
    lastFrame = now
    engine.advance(dt)
    rafId = requestFrame(frame)
  }

  function start() {
    if (rafId || !shouldAutoRun()) return
    lastFrame = 0
    rafId = requestFrame(frame)
  }

  function stop() {
    if (rafId) cancelFrame(rafId)
    rafId = 0
  }

  function syncMotion() {
    const reduced = effectiveReduced()
    root.dataset.reduced = reduced ? 'true' : 'false'
    if (reduced) {
      stop()
      engine.renderOnce(0)
      return
    }
    if (shouldAutoRun()) start()
    else {
      stop()
      if (paused) engine.renderOnce(0)
    }
  }

  function measureAndResize(force = false) {
    if (destroyed) return
    const width = root.clientWidth || 972
    const height = root.clientHeight
      || (typeof opts.height === 'number' ? Math.max(MIN_HEIGHT, opts.height) : 880)
    if (!force && width === lastW && height === lastH) return
    lastW = width
    lastH = height
    engine.resize(width, height)
  }

  /* ------------------------------ Status ------------------------------- */
  function setStatus(message: string) {
    status.textContent = message
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      if (!destroyed) status.textContent = ''
    }, 2400)
  }

  /* ----------------------------- Attachments --------------------------- */
  function renderAttachments() {
    attachmentList.textContent = ''
    attachments.forEach((file, index) => {
      const item = doc.createElement('li')
      item.className = 'as-chip'
      const name = makeElement(doc, 'span', 'as-chip-name')
      name.textContent = file.name
      const remove = makeElement(doc, 'button', 'as-chip-remove')
      remove.type = 'button'
      remove.setAttribute('aria-label', `Remove attachment ${file.name}`)
      remove.appendChild(makeIcon(doc, 'x', 13, 1.8))
      remove.addEventListener('click', () => {
        attachments = attachments.filter((_, i) => i !== index)
        renderAttachments()
        updateSend()
      })
      item.appendChild(name)
      item.appendChild(remove)
      attachmentList.appendChild(item)
    })
  }

  function updateSend() {
    sendBtn.disabled = !input.value.trim() && attachments.length === 0
  }

  function resizeInput() {
    input.style.height = 'auto'
    const next = Math.max(34, Math.min(92, input.scrollHeight))
    input.style.height = `${next}px`
  }

  /* ------------------------------- History ----------------------------- */
  function renderHistory() {
    historyPanel.textContent = ''
    if (!localHistory.length) {
      const empty = makeElement(doc, 'p', 'as-history-empty')
      empty.textContent = 'No messages yet'
      historyPanel.appendChild(empty)
      return
    }
    localHistory.forEach((text) => {
      const item = makeElement(doc, 'button', 'as-history-item')
      item.type = 'button'
      item.textContent = text
      item.title = text
      item.addEventListener('click', () => {
        input.value = text
        resizeInput()
        updateSend()
        openHistory(false)
        input.focus()
      })
      historyPanel.appendChild(item)
    })
  }

  function onDocumentPointerDown(event: Event) {
    if (event.target instanceof Node && !root.contains(event.target)) openHistory(false)
  }

  function openHistory(open: boolean) {
    historyOpen = open
    historyPanel.hidden = !open
    historyBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) {
      renderHistory()
      doc.addEventListener('pointerdown', onDocumentPointerDown, true)
    } else {
      doc.removeEventListener('pointerdown', onDocumentPointerDown, true)
    }
  }

  /* ------------------------------- Submit ------------------------------ */
  function submit() {
    const text = input.value
    if (!text.trim() && attachments.length === 0) return
    const files = attachments.slice()
    input.value = ''
    attachments = []
    renderAttachments()
    resizeInput()
    updateSend()
    if (text.trim()) {
      localHistory = [text, ...localHistory].slice(0, HISTORY_LIMIT)
      if (historyOpen) renderHistory()
    }
    try {
      if (typeof opts.onSubmit === 'function') opts.onSubmit({ text, attachments: files })
    } catch (error) {
      setStatus('Submit failed')
    }
  }

  /* -------------------------------- Voice ------------------------------ */
  function updateVoiceButton() {
    const enabled = typeof opts.onVoiceInput === 'function'
    micBtn.disabled = !enabled
    const label = enabled ? 'Voice input' : 'Voice input is not connected'
    micBtn.title = label
    micBtn.setAttribute('aria-label', label)
  }

  async function handleVoice() {
    if (typeof opts.onVoiceInput !== 'function') return
    try {
      const result = opts.onVoiceInput()
      const text = result && typeof (result as Promise<string>).then === 'function'
        ? await (result as Promise<string>)
        : result
      if (!destroyed && typeof text === 'string' && text) {
        input.value = text
        resizeInput()
        updateSend()
        input.focus()
      }
    } catch (error) {
      if (!destroyed) setStatus('Voice input failed')
    }
  }

  /* ------------------------------- Pointer ----------------------------- */
  function localPoint(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') return
    const point = localPoint(event)
    engine.setPointer(point.x, point.y, true)
  }

  function onPointerLeave() {
    engine.setPointer(0, 0, false)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      const point = localPoint(event)
      touchStart = { x: point.x, y: point.y, time: Date.now(), id: event.pointerId }
      return
    }
    const point = localPoint(event)
    engine.setPointer(point.x, point.y, true)
    engine.splash(point.x, point.y)
    root.focus({ preventScroll: true })
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerType !== 'touch' || !touchStart || event.pointerId !== touchStart.id) return
    const point = localPoint(event)
    const moved = Math.hypot(point.x - touchStart.x, point.y - touchStart.y)
    const elapsed = Date.now() - touchStart.time
    touchStart = null
    if (moved < 12 && elapsed < 500) engine.splash(point.x, point.y)
  }

  function onPointerCancel() {
    touchStart = null
  }

  /* ------------------------------- Keyboard ----------------------------- */
  function onKeyDown(event: KeyboardEvent) {
    // Escape 从任意焦点位置都能收起本地历史
    if (event.key === 'Escape' && historyOpen) {
      event.preventDefault()
      openHistory(false)
      return
    }
    if (isEditableTarget(event.target) || event.defaultPrevented) return
    const step = 48
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      paused = !paused
      opts.paused = paused
      syncMotion()
      return
    }
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      engine.reset()
      if (!shouldAutoRun()) engine.renderOnce(0)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      engine.splashVirtual()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      engine.moveVirtualPointer(-step, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      engine.moveVirtualPointer(step, 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      engine.moveVirtualPointer(0, -step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      engine.moveVirtualPointer(0, step)
    }
  }

  /* ---------------------------- Composer events ------------------------- */
  function onInput() {
    if (input.value.length > 2000) input.value = input.value.slice(0, 2000)
    resizeInput()
    updateSend()
  }

  function onInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (event.isComposing || composing || event.keyCode === 229) return
      event.preventDefault()
      submit()
      return
    }
    if (event.key === 'Escape' && historyOpen) {
      event.preventDefault()
      openHistory(false)
    }
  }

  function onCompositionStart() { composing = true }
  function onCompositionEnd() { composing = false }

  function onPlusClick() { fileInput.click() }

  function onFileChange() {
    const files = Array.from(fileInput.files || [])
    for (const file of files) {
      if (attachments.length >= MAX_ATTACHMENTS) break
      attachments.push(file)
    }
    fileInput.value = ''
    renderAttachments()
    updateSend()
    if (attachments.length >= MAX_ATTACHMENTS) setStatus('Up to 3 attachments')
  }

  function onHistoryClick() {
    openHistory(!historyOpen)
  }

  function onSendClick() { submit() }
  function onMicClick() { handleVoice() }

  function onVisibilityChange() {
    if (doc.hidden) {
      stop()
    } else {
      syncMotion()
    }
  }

  /* ------------------------------ Observers ---------------------------- */
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureAndResize())
    resizeObserver.observe(root)
  } else {
    win.addEventListener('resize', measureAndResize)
  }

  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting)
      syncMotion()
    }, { threshold: 0 })
    intersectionObserver.observe(root)
  }

  if (typeof win.matchMedia === 'function') {
    mediaQuery = win.matchMedia('(prefers-reduced-motion: reduce)')
    systemReduced = mediaQuery.matches
    const onChange = (event: MediaQueryListEvent) => {
      systemReduced = event.matches
      syncMotion()
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
      ;(mediaQuery as MediaQueryList & { __asChange?: (e: MediaQueryListEvent) => void }).__asChange = onChange
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onChange)
      ;(mediaQuery as MediaQueryList & { __asChange?: (e: MediaQueryListEvent) => void }).__asChange = onChange
    }
  }

  historyBtn.addEventListener('click', onHistoryClick)
  input.addEventListener('input', onInput)
  input.addEventListener('keydown', onInputKeyDown)
  input.addEventListener('compositionstart', onCompositionStart)
  input.addEventListener('compositionend', onCompositionEnd)
  plusBtn.addEventListener('click', onPlusClick)
  micBtn.addEventListener('click', onMicClick)
  sendBtn.addEventListener('click', onSendClick)
  fileInput.addEventListener('change', onFileChange)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  root.addEventListener('keydown', onKeyDown)
  doc.addEventListener('visibilitychange', onVisibilityChange)

  updateVoiceButton()
  updateSend()

  measureAndResize(true)
  syncMotion()

  /* ------------------------------- Public API --------------------------- */
  function update(next: Partial<AsciiSharksOptions> = {}) {
    if (destroyed) return
    const rebuild = (next.seed !== undefined && next.seed !== opts.seed)
      || (next.fishCount !== undefined && next.fishCount !== opts.fishCount)
      || (next.sharks !== undefined && JSON.stringify(next.sharks) !== JSON.stringify(opts.sharks))

    opts = { ...opts, ...next }

    if (next.theme !== undefined) root.dataset.theme = opts.theme === 'dark' ? 'dark' : 'light'
    if (next.variant !== undefined) root.dataset.variant = opts.variant === 'thumb' ? 'thumb' : 'default'
    if (next.showComposer !== undefined) {
      root.dataset.composer = opts.showComposer === false ? 'false' : 'true'
      if (opts.showComposer === false) openHistory(false)
    }
    if (next.paused !== undefined) paused = !!opts.paused
    if (next.speed !== undefined) engine.setSpeed(opts.speed ?? 1)
    updateVoiceButton()
    if (next.height !== undefined) {
      applyHeight()
      measureAndResize(true)
    }
    if (rebuild) {
      engine.setOptions({
        seed: opts.seed ?? 7,
        fishCount: opts.fishCount ?? null,
        sharks: opts.sharks || DEFAULT_SHARKS,
      })
      engine.reset()
    }
    syncMotion()
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    stop()
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = null
    openHistory(false)
    if (resizeObserver) resizeObserver.disconnect()
    else win.removeEventListener('resize', measureAndResize)
    if (intersectionObserver) intersectionObserver.disconnect()
    doc.removeEventListener('visibilitychange', onVisibilityChange)
    if (mediaQuery) {
      const change = (mediaQuery as MediaQueryList & { __asChange?: (e: MediaQueryListEvent) => void }).__asChange
      if (change) {
        if (typeof mediaQuery.removeEventListener === 'function') mediaQuery.removeEventListener('change', change)
        else if (typeof mediaQuery.removeListener === 'function') mediaQuery.removeListener(change)
      }
    }
    historyBtn.removeEventListener('click', onHistoryClick)
    input.removeEventListener('input', onInput)
    input.removeEventListener('keydown', onInputKeyDown)
    input.removeEventListener('compositionstart', onCompositionStart)
    input.removeEventListener('compositionend', onCompositionEnd)
    plusBtn.removeEventListener('click', onPlusClick)
    micBtn.removeEventListener('click', onMicClick)
    sendBtn.removeEventListener('click', onSendClick)
    fileInput.removeEventListener('change', onFileChange)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerCancel)
    root.removeEventListener('keydown', onKeyDown)
    engine.destroy()
    root.remove()
    releaseStyles(doc)
    attachments = []
    localHistory = []
  }

  function reset() {
    if (destroyed) return
    engine.reset()
    if (!shouldAutoRun()) engine.renderOnce(0)
  }

  function setPaused(value: boolean) {
    if (destroyed) return
    paused = !!value
    opts.paused = paused
    syncMotion()
  }

  return {
    update,
    destroy,
    reset,
    setPaused,
    root,
    engine,
    getState: () => ({
      paused,
      theme: root.dataset.theme || 'light',
      speed: engine.speed,
      showComposer: root.dataset.composer !== 'false',
      localHistory: localHistory.slice(),
    }),
  }
}

export const mountAsciiSharks = createAsciiSharks
export default createAsciiSharks
