import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  ['375', 375, 812],
  ['768', 768, 1024],
  ['1440', 1440, 900],
]

test.describe('AI 助手 · 字符鲨鱼海洋', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  for (const [name, width, height] of VIEWPORTS) {
    test(`renders and stays inside ${name}px without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/ai-assistant')

      const root = page.locator('.as-root')
      await expect(root).toBeVisible()
      await expect(page.locator('.as-title')).toHaveText('what’s on your mind?')

      const input = page.locator('.as-input')
      await expect(input).toBeVisible()
      const inputBox = await input.boundingBox()
      expect(inputBox.width).toBeGreaterThan(180)

      const sendBox = await page.locator('.as-send').boundingBox()
      expect(sendBox.width).toBeGreaterThanOrEqual(32)
      expect(sendBox.height).toBeGreaterThanOrEqual(32)

      // Canvas 真的画出了字符：采样里应出现比网格线更亮的像素
      const stats = await page.locator('.as-canvas').evaluate((canvas) => {
        const ctx = canvas.getContext('2d')
        const { width: cw, height: ch } = canvas
        const data = ctx.getImageData(0, 0, cw, ch).data
        let bright = 0
        const stride = 4 * 53
        for (let i = 0; i < data.length; i += stride) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r > 90 || g > 90 || b > 90) bright += 1
        }
        return { bright, width: cw, height: ch }
      })
      expect(stats.width).toBeGreaterThan(100)
      expect(stats.bright).toBeGreaterThan(30)

      const overflow = await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))
      expect(overflow).toBeLessThanOrEqual(0)

      await page.screenshot({ path: `test-results/ascii-${name}.png`, fullPage: false })
    })
  }

  test('composer, local history, keyboard and ocean clicks stay independent', async ({ page }) => {
    await page.goto('/ai-assistant')
    const root = page.locator('.as-root')
    const input = page.locator('.as-input')

    await input.fill('小站里有哪些文章？')
    await expect(page.locator('.as-send')).toBeEnabled()

    // Shift+Enter 换行，不提交
    await input.press('Shift+Enter')
    await expect(input).toHaveValue('小站里有哪些文章？\n')

    // 展开 History：还没有提交记录；Escape 收起
    await page.locator('.as-history').click()
    await expect(page.locator('.as-history-panel')).toContainText('No messages yet')
    await page.keyboard.press('Escape')
    await expect(page.locator('.as-history-panel')).toBeHidden()

    // 空白处点击惊散鱼群；聚焦画布后用空格暂停、R 重置、方向键与 Enter
    await page.locator('.as-canvas').click({ position: { x: 28, y: 28 } })
    await root.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.keyboard.press('r')
    await expect(root).toBeVisible()

    // 输入框里的空格 / R 不会控制海洋，也不会触发提交
    await input.fill('a b c')
    await input.press('r')
    await input.press('Space')
    await expect(input).toHaveValue('a b cr ')
    await expect(page.locator('.chat-panel')).toHaveCount(0)
  })

  test('attachments cap at three and can be removed locally', async ({ page }) => {
    await page.goto('/ai-assistant')
    const fileInput = page.locator('.as-file')
    const files = [0, 1, 2, 3].map((i) => ({
      name: `note-${i}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`note ${i}`),
    }))
    await fileInput.setInputFiles(files)

    await expect(page.locator('.as-chip')).toHaveCount(3)
    await expect(page.locator('.as-chip').first()).toContainText('note-0.txt')
    await expect(page.locator('.as-send')).toBeEnabled()

    await page.locator('.as-chip-remove').first().click()
    await expect(page.locator('.as-chip')).toHaveCount(2)
    await expect(page.locator('.as-chip').first()).toContainText('note-1.txt')
  })

  test('submitting routes the message into the conversation overlay', async ({ page }) => {
    await page.route('**/api/assistants/chat', async (route) => {
      const body = [
        'data: {"type":"text","content":"小站里有 **文章**、说说和项目。"}',
        '',
        'data: {"type":"tool","content":"正在调用：search_knowledge"}',
        '',
        'data: {"type":"sources","sources":[{"id":9,"title":"智能体不是玄学"}]}',
        '',
        'data: {"type":"conversation_id","id":"e2e-conversation"}',
        '',
        '',
      ].join('\n')
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body,
      })
    })

    await page.goto('/ai-assistant')
    await page.locator('.as-input').fill('小站里有哪些文章？')
    await page.locator('.as-input').press('Enter')

    await expect(page.locator('.chat-panel')).toBeVisible()
    await expect(page.locator('.chat-list')).toContainText('小站里有 文章、说说和项目。')
    await expect(page.locator('.chat-list')).toContainText('智能体不是玄学')
    await expect(page.locator('.chat-panel__title')).not.toHaveText('新对话')
    // AI 生成标识在对话进行中始终可见
    await expect(page.locator('.chat-ai-label')).toHaveText('AI 生成内容 · 请核实重要信息')
    // 海洋保留为背景，输入层隐藏
    await expect(page.locator('.as-root')).toHaveAttribute('data-composer', 'false')

    await page.locator('.chat-copy').first().click()
    await expect(page.locator('.chat-copy').first()).toHaveText('已复制')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('AI 生成内容，请核实重要信息')

    await page.screenshot({ path: 'test-results/ascii-conversation-1440.png', fullPage: false })
  })

  test('shows error feedback and a retry action when the request fails', async ({ page }) => {
    await page.route('**/api/assistants/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '模型暂时不可用' }),
      })
    })

    await page.goto('/ai-assistant')
    await page.locator('.as-input').fill('测试一下错误反馈')
    await page.locator('.as-input').press('Enter')

    await expect(page.locator('.chat-list')).toContainText('出错了：模型暂时不可用')
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
  })
  test('falls back to the ocean hero when the initial conversation load fails', async ({ page }) => {
    await page.route('**/api/assistants/conversations/*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'temporarily unavailable' }),
      })
    })
    await page.addInitScript(() => localStorage.setItem('conv_id', 'stale-conversation'))
    await page.goto('/ai-assistant')

    await expect(page.locator('.as-root')).toHaveAttribute('data-composer', 'true')
    await expect(page.locator('.as-title')).toBeVisible()
    await expect(page.locator('.chat-panel')).toHaveCount(0)
  })

  test('stop button interrupts a pending answer', async ({ page }) => {
    await page.route('**/api/assistants/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"type":"text","content":"late answer"}',
      }).catch(() => {})
    })

    await page.goto('/ai-assistant')
    await page.locator('.as-input').fill('请慢慢回答')
    await page.locator('.as-input').press('Enter')
    await expect(page.getByRole('button', { name: '停止生成' })).toBeVisible()
    await page.getByRole('button', { name: '停止生成' }).click()
    await expect(page.locator('.chat-list')).toContainText('（已停止生成）')
  })

  test.describe('touch', () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 812 } })

    test('tap scatters and vertical swipe still scrolls the page', async ({ page }) => {
      await page.goto('/ai-assistant')
      const canvas = page.locator('.as-canvas')
      const box = await canvas.boundingBox()
      await page.touchscreen.tap(box.x + 20, box.y + 20)

      const client = await page.context().newCDPSession(page)
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 20, y: 650 }],
      })
      for (const y of [580, 500, 420, 340]) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 20, y }],
        })
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(250)

      const scrollY = await page.evaluate(() => window.scrollY)
      expect(scrollY).toBeGreaterThan(0)
      await expect(page.locator('.as-root')).toBeVisible()
    })
  })
})
