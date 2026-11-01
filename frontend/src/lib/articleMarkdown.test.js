import { describe, it, expect } from 'vitest'
import { renderArticleMarkdown } from './articleMarkdown'

describe('renderArticleMarkdown', () => {
  it('正常渲染 Markdown 结构', () => {
    const html = renderArticleMarkdown('# 标题\n\n**加粗** 和 `行内代码`\n\n- 一\n- 二')
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<code>行内代码</code>')
    expect(html).toContain('<li>一</li>')
  })

  it('文章配图要保留（img 与 src/alt 在白名单里，否则图片会被静默删掉）', () => {
    const html = renderArticleMarkdown('![封面](https://example.com/a.png)')
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/a.png')
    expect(html).toContain('alt="封面"')
  })

  it('剥掉 <script> 标签', () => {
    const html = renderArticleMarkdown('正文\n\n<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })

  it('剥掉 img 的 onerror 事件属性（XSS 最常见的姿势）', () => {
    const html = renderArticleMarkdown('<img src=x onerror="alert(document.domain)">')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert(')
  })

  it('剥掉 javascript: 协议的链接', () => {
    const html = renderArticleMarkdown('<a href="javascript:alert(1)">点我</a>')
    expect(html).not.toContain('javascript:')
  })

  it('剥掉 iframe 等不在白名单的标签', () => {
    const html = renderArticleMarkdown('<iframe src="https://evil.com"></iframe>')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('evil.com')
  })

  it('空内容返回空字符串（不炸）', () => {
    expect(renderArticleMarkdown('')).toBe('')
    expect(renderArticleMarkdown(null)).toBe('')
    expect(renderArticleMarkdown(undefined)).toBe('')
  })
})
