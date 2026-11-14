import { test, expect } from '@playwright/test'

async function pseudoHeight(locator, pseudo) {
  return locator.evaluate((el, which) => getComputedStyle(el, which).height, pseudo)
}

async function hitsAt(locator, offsetY) {
  return locator.evaluate((el, dy) => {
    const rect = el.getBoundingClientRect()
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2 + dy,
    )
    return !!target && (target === el || el.contains(target))
  }, offsetY)
}

async function heightOf(locator) {
  return locator.evaluate((el) => Math.round(el.getBoundingClientRect().height))
}

test.describe('mobile touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('editorial links and assistant controls expand to 44px hit areas', async ({ page }) => {
    // Home: nav, section action, hero secondary link, project link
    await page.goto('/')
    const navLink = page.locator('.nav-link').first()
    await expect(navLink).toBeVisible()
    expect(await pseudoHeight(navLink, '::before')).toBe('44px')
    expect(await hitsAt(navLink, -10)).toBe(true)

    const github = page.locator('.nav-github')
    await expect(github).toBeVisible()
    expect(await github.getAttribute('href')).toBe('https://github.com/pty719')
    expect(await github.getAttribute('target')).toBe('_blank')
    expect(await github.getAttribute('rel')).toContain('noopener')
    expect(await pseudoHeight(github, '::before')).toBe('44px')
    expect(await hitsAt(github, -10)).toBe(true)

    const sectionAction = page.locator('.section-action').first()
    await sectionAction.scrollIntoViewIfNeeded()
    expect(await pseudoHeight(sectionAction, '::before')).toBe('44px')
    expect(await hitsAt(sectionAction, -8)).toBe(true)

    const heroLink = page.locator('.hero-link').first()
    await heroLink.scrollIntoViewIfNeeded()
    expect(await pseudoHeight(heroLink, '::before')).toBe('44px')
    expect(await hitsAt(heroLink, -8)).toBe(true)

    const projectLink = page.locator('.project-link').first()
    await projectLink.scrollIntoViewIfNeeded()
    expect(await pseudoHeight(projectLink, '::before')).toBe('44px')
    expect(await hitsAt(projectLink, -8)).toBe(true)

    // Footer is static in index.html; links get a real 44px height
    const footerLinks = page.locator('#site-footer a')
    await footerLinks.first().scrollIntoViewIfNeeded()
    const footerCount = await footerLinks.count()
    for (let i = 0; i < footerCount; i += 1) {
      expect(await heightOf(footerLinks.nth(i))).toBeGreaterThanOrEqual(44)
    }

    // Article: selection hint, TOC summary marker, TOC links, back link
    await page.goto('/articles/9')
    const hint = page.locator('.article-selection-hint')
    await expect(hint).toBeVisible()
    await expect(hint).toHaveText('拖选正文 · 文字会开花')

    const tocSummary = page.locator('.toc-inline summary')
    await tocSummary.scrollIntoViewIfNeeded()
    expect(await heightOf(tocSummary)).toBeGreaterThanOrEqual(44)
    expect(await tocSummary.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"+"')
    await tocSummary.click()
    expect(await tocSummary.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"−"')
    const tocLinks = page.locator('.toc-inline .toc-list a')
    await expect(tocLinks.first()).toBeVisible()
    expect(await heightOf(tocLinks.first())).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)

    const backLink = page.locator('.article-back-link')
    await backLink.scrollIntoViewIfNeeded()
    expect(await pseudoHeight(backLink, '::before')).toBe('44px')
    expect(await hitsAt(backLink, -8)).toBe(true)

    // Assistant: History, plus/mic/send, suggestions, panel action
    await page.goto('/ai-assistant')
    const history = page.locator('.as-history')
    await expect(history).toBeVisible()
    expect(await hitsAt(history, -2)).toBe(true)

    const plus = page.locator('.as-plus')
    expect(await hitsAt(plus, -4)).toBe(true)

    await page.locator('.as-input').fill('touch target probe')
    const send = page.locator('.as-send')
    await expect(send).toBeEnabled()
    expect(await hitsAt(send, -4)).toBe(true)

    const suggestion = page.locator('.suggestion').first()
    await suggestion.scrollIntoViewIfNeeded()
    expect(await heightOf(suggestion)).toBeGreaterThanOrEqual(44)

    const panelAction = page.locator('.panel-action').first()
    await panelAction.scrollIntoViewIfNeeded()
    expect(await pseudoHeight(panelAction, '::before')).toBe('44px')
    expect(await hitsAt(panelAction, -8)).toBe(true)
  })
})
