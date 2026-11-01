import { test, expect } from '@playwright/test'

test.describe('公开页面冒烟', () => {
  test('首页渲染并可进入文章列表', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('yizhiyu')
    await expect(page.getByRole('heading', { name: '项目' })).toBeVisible()

    await page.getByRole('link', { name: '文章' }).first().click()
    await expect(page).toHaveURL(/\/articles$/)
    await expect(page.getByRole('heading', { name: '文章列表' })).toBeVisible()
  })

  test('文章详情有目录与阅读进度', async ({ page }) => {
    await page.goto('/articles/9')
    await expect(page.locator('.article-title')).toContainText('智能体不是玄学')
    await expect(page.locator('.toc-rail')).toBeVisible()

    const tocCount = await page.locator('.toc-rail a').count()
    expect(tocCount).toBeGreaterThan(0)

    await page.mouse.wheel(0, 1200)
    await expect.poll(async () =>
      page.locator('.reading-progress span').evaluate((el) => getComputedStyle(el).transform),
    ).not.toBe('matrix(0, 0, 0, 1, 0, 0)')
  })

  test('AI 助手显示能力说明与建议问题', async ({ page }) => {
    await page.goto('/ai-assistant')
    await expect(page.getByRole('heading', { name: 'AI 助手' })).toBeVisible()
    await expect(page.locator('.assistant-aside')).toContainText('能力')
    await expect(page.locator('.suggestion').first()).toBeVisible()
  })

  test('登录页有可访问的表单标签', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('用户名')).toBeVisible()
    await expect(page.getByLabel('密码')).toBeVisible()
  })

  test('未知路由显示 404', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible()
  })
})
