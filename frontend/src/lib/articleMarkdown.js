import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 文章正文是 Markdown（后台用 textarea 编辑），渲染成 HTML 后用 v-html 插进页面。
//
// ⚠️ 为什么必须有这一层：
//   marked 从 v8 起【不再做任何 HTML 消毒】（官方要求调用方自己净化），
//   它会把 <script>、<img onerror=...>、href="javascript:..." 原样透传。
//   本站后台 token 存在 localStorage，一旦 XSS 执行就能被读走 → 后台直接沦陷。
//   所以 v-html 的内容必须先过 DOMPurify 白名单。
//
// 与 lib/chatMarkdown.js 的区别：文章需要配图（img）和 h5/h6，
// 聊天消息不需要 —— 两套内容给两套白名单，别为了省事共用一套。
const ARTICLE_TAGS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

// 属性白名单：只放行"展示要用"的属性。
// 特别注意没有 on*（事件属性）—— onerror / onclick 这类不在白名单里，
// DOMPurify 会把整个属性剥掉，就算标签本身被保留也执行不了脚本。
const ARTICLE_ATTR = ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'loading']

/**
 * Markdown 正文 → 安全 HTML
 * @param {string} text 文章 content 字段（Markdown 原文）
 * @returns {string} 可直接交给 v-html 的 HTML 字符串
 */
export function renderArticleMarkdown(text) {
  if (!text) return ''
  // 1) Markdown → HTML
  const html = marked.parse(text)
  // 2) HTML → 只保留白名单内的标签/属性。
  //    DOMPurify 额外会拦掉 javascript: / vbscript: 等危险协议、<script>、<iframe>、事件属性。
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ARTICLE_TAGS,
    ALLOWED_ATTR: ARTICLE_ATTR,
  })
}
