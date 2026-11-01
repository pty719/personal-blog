import { marked } from 'marked'
import DOMPurify from 'dompurify'

// AI 回答按 Markdown 渲染，但模型输出不可信：只保留安全标签/属性，链接协议由 DOMPurify 过滤
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4',
  'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

export function renderChatMarkdown(text) {
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  })
}
