/**
 * motion-runtime.ts — SelectionFlower 的实例生命周期与 DOM 交互层。
 *
 * 所有框架入口只做：挂载后把宿主元素交给 createSelectionFlower，
 * 卸载时调用 controller.destroy()。DOM 只在调用时访问，同页可多实例。
 */
import {
  DESIGN,
  SelectionFlowerEngine,
  randomSeed,
} from './SelectionFlowerEngine.js'

export interface SelectionFlowerOptions {
  height?: number
  reducedMotion?: boolean
  /** 把交互挂到已有元素（真实文章）上；不再创建演示 DOM，也不做 822 设计缩放 */
  attachTo?: HTMLElement | null
}

export interface SelectionFlowerController {
  update: (options?: Partial<SelectionFlowerOptions>) => void
  destroy: () => void
  root: HTMLElement
  engine: SelectionFlowerEngine
  getState: () => {
    plants: number
    scale: number
    reducedMotion: boolean
  }
}

const STYLE_ID = 'selection-flower-styles'
const styleRegistry = new WeakMap<Document, { el: HTMLStyleElement; count: number }>()
const MIN_HEIGHT = 240
const RELEASE_DELAY = 1300

const CSS = `
.sf-root {
  position: relative;
  isolation: isolate;
  display: flow-root;
  width: 100%;
  overflow: hidden;
  background: #fff;
  color: #111;
  -webkit-text-size-adjust: 100%;
}
.sf-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.sf-article {
  position: relative;
  z-index: 1;
  background: transparent;
  user-select: text;
  -webkit-user-select: text;
}
.sf-title {
  margin: 0 0 calc(32px * var(--sf-scale, 1));
  font-family: Georgia, "Times New Roman", serif;
  font-size: calc(72px * var(--sf-scale, 1));
  font-weight: 400;
  line-height: calc(80px * var(--sf-scale, 1));
  letter-spacing: calc(-3px * var(--sf-scale, 1));
  color: #111;
}
.sf-p {
  margin: 0 0 calc(24px * var(--sf-scale, 1));
  font-family: "Times New Roman", Times, serif;
  font-size: calc(21.5px * var(--sf-scale, 1));
  font-weight: 400;
  line-height: calc(36px * var(--sf-scale, 1));
  color: #111;
  outline: none;
}
.sf-p:last-child { margin-bottom: 0; }
.sf-p:focus { outline: none; }
.sf-p:focus-visible {
  outline: 2px solid #1c6b34;
  outline-offset: 6px;
}
.sf-root ::selection { background: #15803d; color: #fff; }
.sf-root ::-moz-selection { background: #15803d; color: #fff; }
.sf-sr {
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
.sf-root[data-bare="true"] {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  min-height: 0;
  display: block;
  overflow: visible;
  background: transparent;
  pointer-events: none;
  isolation: auto;
}
`

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

function make(doc: Document, tag: string, className?: string) {
  const el = doc.createElement(tag)
  if (className) el.className = className
  return el
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function isWordChar(char: string) {
  try {
    return /[\p{L}\p{N}'’-]/u.test(char)
  } catch (error) {
    return /[A-Za-z0-9'’-]/.test(char)
  }
}

function textNodesOf(element: HTMLElement) {
  const doc = element.ownerDocument
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

function textLengthOf(element: HTMLElement) {
  return textNodesOf(element).reduce((sum, node) => sum + node.data.length, 0)
}

function offsetWithin(element: HTMLElement, node: Node, offset: number) {
  try {
    const range = element.ownerDocument.createRange()
    range.setStart(element, 0)
    range.setEnd(node, offset)
    return range.toString().length
  } catch (error) {
    return 0
  }
}

function rangeAtOffset(element: HTMLElement, start: number, end: number) {
  const nodes = textNodesOf(element)
  const spans = []
  let total = 0
  for (const node of nodes) {
    spans.push({ node, start: total, end: total + node.data.length })
    total += node.data.length
  }
  const locate = (value: number) => {
    const clamped = Math.max(0, Math.min(total, value))
    for (const span of spans) {
      if (clamped <= span.end) {
        return { node: span.node, offset: Math.max(0, Math.min(span.node.data.length, clamped - span.start)) }
      }
    }
    const last = spans[spans.length - 1]
    if (!last) return { node: element, offset: 0 }
    return { node: last.node, offset: last.node.data.length }
  }
  const startPoint = locate(start)
  const endPoint = locate(Math.max(start, end))
  const range = element.ownerDocument.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  return range
}

export function createSelectionFlower(
  host: HTMLElement,
  initialOptions: SelectionFlowerOptions = {},
): SelectionFlowerController {
  const doc = host.ownerDocument
  const win = doc.defaultView || window
  ensureStyles(doc)

  let opts: SelectionFlowerOptions = {
    height: DESIGN.height,
    reducedMotion: undefined,
    ...initialOptions,
  }

  let destroyed = false
  let designHeight = Math.max(MIN_HEIGHT, Number(opts.height) || DESIGN.height)
  let scale = 1
  let gestureActive = false
  let activeSource: 'pointer' | 'keyboard' | 'touch' | 'tap' | null = null
  let touchDown = false
  let touchStart: { x: number; y: number; time: number; id: number; moved: boolean } | null = null
  let releaseTimer: ReturnType<typeof setTimeout> | null = null
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  let pendingStatus = ''
  let rafId = 0
  let prevFrame = 0
  let inView = true
  let systemReduced = false
  let mediaQuery: MediaQueryList | null = null
  let resizeObserver: ResizeObserver | null = null
  let intersectionObserver: IntersectionObserver | null = null

  const attachTarget = initialOptions.attachTo || null
  const bare = !!attachTarget

  const root = make(doc, 'div', 'sf-root')
  root.dataset.bare = bare ? 'true' : 'false'
  root.dataset.plants = '0'
  if (bare) {
    root.setAttribute('aria-hidden', 'true')
  } else {
    root.setAttribute('role', 'region')
    root.setAttribute('aria-label', '文字选区开花演示')
    root.style.height = `${designHeight}px`
    root.style.setProperty('--sf-scale', '1')
  }

  const canvas = make(doc, 'canvas', 'sf-canvas') as HTMLCanvasElement
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.zIndex = '0'
  root.appendChild(canvas)

  let article: HTMLElement
  const paragraphs: HTMLElement[] = []
  if (bare) {
    article = attachTarget as HTMLElement
  } else {
    article = make(doc, 'article', 'sf-article') as HTMLElement
    article.style.position = 'relative'
    article.style.background = 'transparent'
    article.style.zIndex = '1'
    root.appendChild(article)

    const title = make(doc, 'h2', 'sf-title')
    title.appendChild(doc.createTextNode('Select any of this and'))
    title.appendChild(doc.createElement('br'))
    title.appendChild(doc.createTextNode('watch it flower.'))
    article.appendChild(title)

    const paragraphTexts = [
      'Drag across a line. Every character the selection swallows puts something in the ground behind it — a stem finding its angle, a leaf turning over, a head of petals opening one at a time.',
      'Nothing here is placed by hand. A seeded generator picks the family, the length, the bend of every joint, the side each leaf takes and how far it swings out. The same rules run every time; the results never repeat.',
      'Let go, and it grows backwards. Petals fold into the bud, leaves close along their attachment points, stems retract into the point they came from. Nothing dissolves — it simply un-grows.',
      'Only a highlight plants anything. The cursor can do it too, if you turn it on.',
    ]

    paragraphTexts.forEach((text, index) => {
      const p = make(doc, 'p', 'sf-p') as HTMLElement
      p.tabIndex = 0
      if (index === 2) {
        const em = doc.createElement('em')
        em.textContent = 'Let go, and it grows backwards.'
        p.appendChild(em)
        p.appendChild(doc.createTextNode(text.slice('Let go, and it grows backwards.'.length)))
      } else {
        p.textContent = text
      }
      paragraphs.push(p)
      article.appendChild(p)
    })

    const help = make(doc, 'p', 'sf-sr')
    help.textContent = '拖选文章中的任意文字即可种下花朵，松手后花朵沿原路收回。也可以用键盘：聚焦段落，按 Enter 或空格选择开头 36 个字符并开花；Shift 加左右方向键扩缩选区；Home 选择开头，End 选择整段；Escape 清除选区并收回花朵。触屏轻点段落会选择触点附近的词组并开花。'
    root.appendChild(help)
  }

  const status = make(doc, 'p', 'sf-sr')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  root.appendChild(status)

  host.appendChild(root)

  /* ------------------------------- Engine -------------------------------- */
  const engine = new SelectionFlowerEngine(canvas, { reducedMotion: isReduced() })
  engine.setArticle(article)

  function isReduced() {
    return opts.reducedMotion === true || (opts.reducedMotion == null && systemReduced)
  }

  function announce(text: string, delay = 300) {
    if (bare) return
    pendingStatus = text
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      if (!destroyed && pendingStatus) status.textContent = pendingStatus
    }, delay)
  }

  function layout() {
    if (destroyed) return
    if (bare) {
      scale = 1
      const width = host.clientWidth || 1
      const height = host.clientHeight || 1
      engine.resize(width, height, 1)
      return
    }
    const width = root.clientWidth || DESIGN.width
    const nextScale = Math.min(1, width / DESIGN.width)
    scale = nextScale
    root.style.setProperty('--sf-scale', String(nextScale))
    const frameLeft = Math.max(0, (width - DESIGN.width * nextScale) / 2)
    const top = DESIGN.articleTop * nextScale
    article.style.marginLeft = `${frameLeft + DESIGN.articleLeft * nextScale}px`
    article.style.marginTop = `${top}px`
    article.style.width = `${DESIGN.articleWidth * nextScale}px`
    root.style.height = `${designHeight * nextScale}px`
    const contentHeight = article.getBoundingClientRect().height
    const sceneHeight = Math.max(
      designHeight * nextScale,
      top + contentHeight + 8 * nextScale,
    )
    root.style.height = `${sceneHeight}px`
    engine.resize(width, sceneHeight, nextScale)
  }

  /* ------------------------------ Animation ----------------------------- */
  function requestFrame(callback: FrameRequestCallback) {
    if (typeof win.requestAnimationFrame === 'function') return win.requestAnimationFrame(callback)
    return win.setTimeout(() => callback(nowMs()), 16) as unknown as number
  }

  function cancelFrame(id: number) {
    if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(id)
    else win.clearTimeout(id)
  }

  function shouldAnimate() {
    return !destroyed && !isReduced() && inView && !doc.hidden && engine.hasPlants()
  }

  function stopAnimation() {
    if (rafId) cancelFrame(rafId)
    rafId = 0
  }

  function frame(now: number) {
    rafId = 0
    if (!shouldAnimate()) return
    const dt = prevFrame ? Math.min((now - prevFrame) / 1000, 0.04) : 1 / 60
    prevFrame = now
    const remaining = engine.advance(dt)
    engine.render(now)
    if (remaining > 0) {
      rafId = requestFrame(frame)
    } else {
      announce('花朵已收回。', 0)
    }
  }

  function ensureAnimation() {
    if (destroyed) return
    if (isReduced()) {
      stopAnimation()
      engine.render(nowMs())
      return
    }
    if (!shouldAnimate()) {
      stopAnimation()
      if (engine.hasPlants()) engine.render(nowMs())
      return
    }
    if (!rafId) {
      prevFrame = 0
      rafId = requestFrame(frame)
    }
  }

  engine.onPlantsChanged = () => {
    // 植株增删时只负责 reduced-motion 的一次性重绘；
    // 正常动画的启停由 sync/endGesture/frame 显式控制，避免帧内重复调度 RAF。
    if (destroyed) return
    root.dataset.plants = String(engine.plants.length)
    if (isReduced()) engine.render(nowMs())
  }

  /* ------------------------------ Selection ----------------------------- */
  function selectionInArticle(selection: Selection | null) {
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    return article.contains(range.startContainer) && article.contains(range.endContainer)
  }

  function startGesture(source: 'pointer' | 'keyboard' | 'touch' | 'tap') {
    cancelRelease()
    gestureActive = true
    activeSource = source
    engine.beginGesture(randomSeed())
    engine.setActiveDrag(source === 'pointer' || (source === 'touch' && touchDown))
  }

  function syncCurrentSelection() {
    if (destroyed) return
    const characters = engine.collectSelection()
    if (characters === null) return
    if (characters.length === 0) {
      if (engine.hasPlants()) {
        engine.applyCharacters([])
        engine.releaseAll()
        announce('选区为空。', 400)
        if (isReduced()) engine.render(nowMs())
        else ensureAnimation()
      }
      return
    }
    const result = engine.applyCharacters(characters)
    announce(`已种下 ${result.total} 株花。`, 300)
    if (isReduced()) engine.render(nowMs())
    else ensureAnimation()
  }

  function onSelectionChange() {
    if (destroyed) return
    const selection = win.getSelection ? win.getSelection() : null
    if (!selectionInArticle(selection)) return
    if (!gestureActive) {
      if (touchDown && selection && !selection.isCollapsed) {
        startGesture('touch')
      } else {
        return
      }
    }
    syncCurrentSelection()
  }

  function endGesture() {
    if (!gestureActive && engine.hasPlants() === false) return
    gestureActive = false
    activeSource = null
    engine.setActiveDrag(false)
    engine.releaseAll()
    announce('花朵正在收回。', 0)
    if (isReduced()) {
      engine.render(nowMs())
      announce('花朵已收回。', 0)
    } else {
      ensureAnimation()
    }
  }

  function cancelRelease() {
    if (releaseTimer) clearTimeout(releaseTimer)
    releaseTimer = null
  }

  function scheduleRelease() {
    cancelRelease()
    releaseTimer = setTimeout(() => {
      releaseTimer = null
      if (!destroyed) endGesture()
    }, RELEASE_DELAY)
  }

  /* -------------------------------- Pointer ----------------------------- */
  function onArticlePointerDown(event: PointerEvent) {
    if (destroyed) return
    if (event.pointerType !== 'touch' && event.button !== 0) return
    if (event.pointerType === 'touch') {
      touchDown = true
      touchStart = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
        id: event.pointerId,
        moved: false,
      }
      return
    }
    // 鼠标按下时先清掉旧选区：浏览器否则可能把“在旧选区内部按下并移动”
    // 解释为拖动已选文字，从而不产生新的 selectionchange。
    const selection = win.getSelection ? win.getSelection() : null
    if (selection && !selection.isCollapsed) selection.removeAllRanges()
    startGesture('pointer')
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (!touchDown || !touchStart || event.pointerId !== touchStart.id) return
    if (Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 12) {
      touchStart.moved = true
    }
  }

  function selectWordAt(x: number, y: number) {
    let range: Range | null = null
    if (typeof doc.caretRangeFromPoint === 'function') {
      range = doc.caretRangeFromPoint(x, y)
    } else if (typeof doc.caretPositionFromPoint === 'function') {
      const position = doc.caretPositionFromPoint(x, y)
      if (position) {
        range = doc.createRange()
        range.setStart(position.offsetNode, position.offset)
        range.collapse(true)
      }
    }
    if (!range || !article.contains(range.startContainer)) return false
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return false
    const text = (node as Text).data || ''
    const offset = range.startOffset
    if (!text) return false
    let start = offset
    let end = offset
    while (start > 0 && isWordChar(text[start - 1])) start -= 1
    while (end < text.length && isWordChar(text[end])) end += 1
    if (start === end) {
      start = Math.min(offset, Math.max(0, text.length - 1))
      end = Math.min(text.length, start + 1)
    }
    const selection = win.getSelection()
    if (!selection) return false
    selection.removeAllRanges()
    const wordRange = doc.createRange()
    wordRange.setStart(node, start)
    wordRange.setEnd(node, end)
    selection.addRange(wordRange)
    return true
  }

  function onWindowPointerUp(event: PointerEvent) {
    if (destroyed) return
    if (event.pointerType === 'touch') {
      const start = touchStart
      const wasTouch = touchDown
      touchDown = false
      touchStart = null
      if (gestureActive && activeSource === 'touch') {
        endGesture()
        return
      }
      if (wasTouch && start && !start.moved && Date.now() - start.time < 500) {
        if (selectWordAt(event.clientX, event.clientY)) {
          cancelRelease()
          startGesture('tap')
          engine.setActiveDrag(false)
          syncCurrentSelection()
          scheduleRelease()
        }
      }
      return
    }
    if (gestureActive) endGesture()
  }

  function onWindowPointerCancel() {
    touchDown = false
    touchStart = null
    if (gestureActive) endGesture()
  }

  function onWindowBlur() {
    touchDown = false
    touchStart = null
    if (gestureActive) endGesture()
  }

  function onDocumentPointerDown(event: PointerEvent) {
    if (destroyed) return
    if (event.target instanceof Node && article.contains(event.target)) return
    if (gestureActive) endGesture()
  }

  /* -------------------------------- Keyboard ----------------------------- */
  function setSelectionRange(range: Range) {
    const selection = win.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function flowerFirstChars(paragraph: HTMLElement) {
    startGesture('keyboard')
    engine.setActiveDrag(false)
    const length = textLengthOf(paragraph)
    setSelectionRange(rangeAtOffset(paragraph, 0, Math.min(36, length)))
    syncCurrentSelection()
    scheduleRelease()
  }

  function flowerWholeParagraph(paragraph: HTMLElement) {
    startGesture('keyboard')
    engine.setActiveDrag(false)
    setSelectionRange(rangeAtOffset(paragraph, 0, textLengthOf(paragraph)))
    syncCurrentSelection()
    scheduleRelease()
  }

  function extendKeyboardSelection(paragraph: HTMLElement, direction: number) {
    if (!gestureActive || activeSource !== 'keyboard') startGesture('keyboard')
    else cancelRelease()
    engine.setActiveDrag(false)
    const length = textLengthOf(paragraph)
    const selection = win.getSelection()
    let start = 0
    let end = 0
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    if (
      range
      && selectionInArticle(selection)
      && paragraph.contains(range.startContainer)
      && paragraph.contains(range.endContainer)
    ) {
      start = offsetWithin(paragraph, range.startContainer, range.startOffset)
      end = offsetWithin(paragraph, range.endContainer, range.endOffset)
    } else {
      start = direction > 0 ? 0 : length
      end = start
    }
    if (direction > 0) {
      end = Math.min(length, end + 1)
    } else if (end > start) {
      end -= 1
    } else if (start > 0) {
      end = start
      start -= 1
    }
    setSelectionRange(rangeAtOffset(paragraph, start, end))
    syncCurrentSelection()
    scheduleRelease()
  }

  function onParagraphKeyDown(event: KeyboardEvent) {
    if (destroyed) return
    const paragraph = event.currentTarget as HTMLElement
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      flowerFirstChars(paragraph)
      return
    }
    if (event.shiftKey && event.key === 'ArrowRight') {
      event.preventDefault()
      extendKeyboardSelection(paragraph, 1)
      return
    }
    if (event.shiftKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      extendKeyboardSelection(paragraph, -1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      flowerFirstChars(paragraph)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      flowerWholeParagraph(paragraph)
    }
  }

  function onDocumentKeyDown(event: KeyboardEvent) {
    if (destroyed || event.key !== 'Escape') return
    const selection = win.getSelection ? win.getSelection() : null
    if (!selectionInArticle(selection)) return
    event.preventDefault()
    cancelRelease()
    gestureActive = false
    activeSource = null
    engine.setActiveDrag(false)
    if (selection) selection.removeAllRanges()
    engine.releaseAll()
    if (isReduced()) {
      engine.clearPlants()
      engine.render(nowMs())
      announce('选区已清除，花朵已收回。', 0)
    } else {
      const hadPlants = engine.hasPlants()
      announce(hadPlants ? '选区已清除，花朵正在收回。' : '选区已清除。', 0)
      ensureAnimation()
    }
  }

  /* -------------------------------- Observers ---------------------------- */
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => layout())
    resizeObserver.observe(root)
  } else {
    win.addEventListener('resize', layout)
  }

  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting)
      if (isReduced()) return
      if (inView) ensureAnimation()
      else stopAnimation()
    }, { threshold: 0 })
    intersectionObserver.observe(root)
  }

  if (typeof win.matchMedia === 'function') {
    mediaQuery = win.matchMedia('(prefers-reduced-motion: reduce)')
    systemReduced = mediaQuery.matches
    const onChange = (event: MediaQueryListEvent) => {
      systemReduced = event.matches
      applyReducedMotion()
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
      ;(mediaQuery as MediaQueryList & { __sfChange?: (e: MediaQueryListEvent) => void }).__sfChange = onChange
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onChange)
      ;(mediaQuery as MediaQueryList & { __sfChange?: (e: MediaQueryListEvent) => void }).__sfChange = onChange
    }
  }

  // 挂载时系统就可能已开启减少动态效果：创建引擎后再同步一次初始状态
  engine.setReducedMotion(isReduced())

  function onVisibilityChange() {
    if (doc.hidden) stopAnimation()
    else if (!isReduced()) ensureAnimation()
  }

  function applyReducedMotion() {
    if (destroyed) return
    const reduced = isReduced()
    engine.setReducedMotion(reduced)
    if (reduced) {
      stopAnimation()
      engine.finishPlants()
      engine.render(nowMs())
    } else {
      ensureAnimation()
    }
  }

  /* -------------------------------- Listeners ---------------------------- */
  article.addEventListener('pointerdown', onArticlePointerDown)
  paragraphs.forEach((paragraph) => paragraph.addEventListener('keydown', onParagraphKeyDown))
  doc.addEventListener('selectionchange', onSelectionChange)
  doc.addEventListener('pointerdown', onDocumentPointerDown)
  doc.addEventListener('keydown', onDocumentKeyDown)
  win.addEventListener('pointermove', onWindowPointerMove)
  win.addEventListener('pointerup', onWindowPointerUp)
  win.addEventListener('pointercancel', onWindowPointerCancel)
  win.addEventListener('blur', onWindowBlur)
  doc.addEventListener('visibilitychange', onVisibilityChange)

  layout()
  if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
    doc.fonts.ready.then(() => {
      if (!destroyed) layout()
    }).catch(() => {})
  }

  /* -------------------------------- Public API --------------------------- */
  function update(next: Partial<SelectionFlowerOptions> = {}) {
    if (destroyed) return
    if (next.height !== undefined) {
      designHeight = Math.max(MIN_HEIGHT, Number(next.height) || DESIGN.height)
      layout()
    }
    if (next.reducedMotion !== undefined) {
      opts.reducedMotion = next.reducedMotion
      applyReducedMotion()
    }
    opts = { ...opts, ...next }
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    stopAnimation()
    cancelRelease()
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = null

    // 只清除属于本实例的浏览器选区
    const selection = win.getSelection ? win.getSelection() : null
    if (selectionInArticle(selection)) selection?.removeAllRanges()

    if (resizeObserver) resizeObserver.disconnect()
    else win.removeEventListener('resize', layout)
    if (intersectionObserver) intersectionObserver.disconnect()

    if (mediaQuery) {
      const change = (mediaQuery as MediaQueryList & { __sfChange?: (e: MediaQueryListEvent) => void }).__sfChange
      if (change) {
        if (typeof mediaQuery.removeEventListener === 'function') mediaQuery.removeEventListener('change', change)
        else if (typeof mediaQuery.removeListener === 'function') mediaQuery.removeListener(change)
      }
    }

    article.removeEventListener('pointerdown', onArticlePointerDown)
    paragraphs.forEach((paragraph) => paragraph.removeEventListener('keydown', onParagraphKeyDown))
    doc.removeEventListener('selectionchange', onSelectionChange)
    doc.removeEventListener('pointerdown', onDocumentPointerDown)
    doc.removeEventListener('keydown', onDocumentKeyDown)
    win.removeEventListener('pointermove', onWindowPointerMove)
    win.removeEventListener('pointerup', onWindowPointerUp)
    win.removeEventListener('pointercancel', onWindowPointerCancel)
    win.removeEventListener('blur', onWindowBlur)
    doc.removeEventListener('visibilitychange', onVisibilityChange)

    engine.destroy()
    root.remove()
    releaseStyles(doc)
  }

  return {
    update,
    destroy,
    root,
    engine,
    getState: () => ({
      plants: engine.plants.length,
      scale,
      reducedMotion: isReduced(),
    }),
  }
}

export const mountSelectionFlower = createSelectionFlower
export default createSelectionFlower
