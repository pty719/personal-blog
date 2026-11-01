import { describe, it, expect } from 'vitest'
import { renderChatMarkdown } from './chatMarkdown'

describe('renderChatMarkdown', () => {
  it('renders Markdown', () => {
    const html = renderChatMarkdown('**bold** and `code`')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('removes scripts and executable javascript URLs', () => {
    const html = renderChatMarkdown('<script>alert(1)</script><a href="javascript:alert(1)">x</a>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('href="javascript:')
  })
})
