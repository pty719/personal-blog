import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  ['375', 375, 812],
  ['768', 768, 1024],
  ['1440', 1440, 900],
]

async function articleParagraph(page) {
  const paragraph = page.locator('.selection-flower-content .prose-editorial p').first()
  await paragraph.scrollIntoViewIfNeeded()
  return paragraph
}

async function canvasPixels(page) {
  return page.locator('.selection-flower-layer .sf-canvas').evaluate((canvas) => {
    const ctx = canvas.getContext('2d')
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let painted = 0
    for (let i = 3; i < data.length; i += 4 * 11) {
      if (data[i] > 0) painted += 1
    }
    return painted
  })
}

async function dragAcross(page, paragraph, reverse = false) {
  const box = await paragraph.boundingBox()
  const y = box.y + Math.min(16, box.height / 3)
  const left = box.x + 12
  const right = box.x + Math.min(box.width - 12, 360)
  const from = reverse ? right : left
  const to = reverse ? left : right
  await page.mouse.move(from, y)
  await page.mouse.down()
  await page.mouse.move(to, y, { steps: 16 })
  await page.waitForTimeout(80)
}

test.describe('文章页 · 文字选区开花', () => {
  for (const [name, width, height] of VIEWPORTS) {
    test(`renders without horizontal overflow at ${name}px`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/articles/9')
      const scene = page.locator('.selection-flower-content')
      await expect(scene).toBeVisible()
      await expect(scene.locator('.prose-editorial')).toBeVisible()
      await expect(page.locator('.selection-flower-layer .sf-canvas')).toHaveCount(1)
      await scene.scrollIntoViewIfNeeded()

      const overflow = await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))
      expect(overflow).toBeLessThanOrEqual(0)

      await page.screenshot({ path: `test-results/flower-${name}.png`, fullPage: false })
    })
  }

  test('mouse drag grows flowers and release retracts to an empty canvas', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    await dragAcross(page, paragraph)

    await page.waitForTimeout(120)
    const early = await canvasPixels(page)
    await page.waitForTimeout(520)
    const grown = await canvasPixels(page)
    expect(early).toBeGreaterThan(0)
    expect(grown).toBeGreaterThan(40)

    await page.screenshot({ path: 'test-results/flower-growing.png', fullPage: false })
    await page.mouse.up()
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)
  })

  test('reverse and cross-paragraph selections both plant flowers', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraphs = page.locator('.selection-flower-content .prose-editorial p')
    const first = paragraphs.nth(0)
    await first.scrollIntoViewIfNeeded()

    await dragAcross(page, first, true)
    await page.waitForTimeout(420)
    expect(await canvasPixels(page)).toBeGreaterThan(20)
    await page.mouse.up()
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)

    const firstBox = await first.boundingBox()
    const secondBox = await paragraphs.nth(1).boundingBox()
    await page.mouse.move(firstBox.x + 20, firstBox.y + firstBox.height - 10)
    await page.mouse.down()
    await page.mouse.move(secondBox.x + 260, secondBox.y + 14, { steps: 20 })
    await page.waitForTimeout(420)
    expect(await canvasPixels(page)).toBeGreaterThan(20)
    await page.mouse.up()
  })

  test('Escape clears the article selection and retracts flowers', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    await dragAcross(page, paragraph)
    await page.waitForTimeout(220)
    expect(await canvasPixels(page)).toBeGreaterThan(0)

    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => window.getSelection().rangeCount)).toBe(0)
    await page.mouse.up()
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)
  })

})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows final flowers immediately and clears instantly on release', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    await dragAcross(page, paragraph)
    await page.waitForTimeout(120)
    expect(await canvasPixels(page)).toBeGreaterThan(20)
    await page.mouse.up()
    expect(await canvasPixels(page)).toBe(0)
  })
})

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } })

  test('tap flowers a word and vertical swipe still scrolls', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    const box = await paragraph.boundingBox()
    await page.touchscreen.tap(box.x + 40, box.y + 10)
    await page.waitForTimeout(250)
    expect(await canvasPixels(page)).toBeGreaterThan(5)
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)

    const beforeScroll = await page.evaluate(() => window.scrollY)
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 180, y: 700 }],
    })
    for (const y of [620, 540, 460, 380]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 180, y }],
      })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll)
  })
})

test.describe('pixel compositing', () => {
  test.use({ reducedMotion: 'reduce' })

  test('text and native selection stay pixel-identical when the canvas is cleared beneath them', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    await dragAcross(page, paragraph)
    await page.waitForTimeout(120)

    const rects = await page.evaluate(() => {
      const selection = window.getSelection()
      return [...selection.getRangeAt(0).getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          x: Math.max(0, Math.floor(rect.left)),
          y: Math.max(0, Math.floor(rect.top)),
          width: Math.max(1, Math.ceil(rect.width)),
          height: Math.max(1, Math.ceil(rect.height)),
        }))
    })
    expect(rects.length).toBeGreaterThan(0)

    const before = []
    for (const rect of rects) before.push(await page.screenshot({ clip: rect }))

    await page.evaluate(() => {
      const selection = window.getSelection()
      const canvas = document.querySelector('.selection-flower-layer .sf-canvas')
      const canvasRect = canvas.getBoundingClientRect()
      const dpr = canvas.width / canvasRect.width
      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      for (const rect of selection.getRangeAt(0).getClientRects()) {
        ctx.clearRect(
          (rect.left - canvasRect.left) * dpr,
          (rect.top - canvasRect.top) * dpr,
          rect.width * dpr,
          rect.height * dpr,
        )
      }
      ctx.restore()
    })

    for (let index = 0; index < rects.length; index += 1) {
      const after = await page.screenshot({ clip: rects[index] })
      expect(after.equals(before[index])).toBe(true)
    }
    await page.mouse.up()
  })
})

test.describe('gesture edge cases', () => {
  test('releasing outside the demo still retracts every flower', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    const box = await paragraph.boundingBox()
    await page.mouse.move(box.x + 20, box.y + 12)
    await page.mouse.down()
    await page.mouse.move(box.x + 280, box.y + 12, { steps: 12 })
    await page.waitForTimeout(200)
    expect(await canvasPixels(page)).toBeGreaterThan(0)

    await page.mouse.move(8, 8)
    await page.mouse.up()
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)
  })

  test('a rapid second drag interrupts an in-flight retraction', async ({ page }) => {
    await page.goto('/articles/9')
    const paragraph = await articleParagraph(page)
    await dragAcross(page, paragraph)
    await page.waitForTimeout(150)
    expect(await canvasPixels(page)).toBeGreaterThan(0)

    await page.mouse.up()
    await page.waitForTimeout(100)
    await dragAcross(page, paragraph)
    await page.waitForTimeout(220)
    expect(await canvasPixels(page)).toBeGreaterThan(0)

    await page.mouse.up()
    await expect.poll(() => canvasPixels(page), { timeout: 5000 }).toBe(0)
  })
})
