<!-- 隐私政策：说明 AI 助手处理哪些数据、为什么、保存多久、如何删除。
     内容必须与实际实现一致：对话存入 assistants 表、DeepSeek 生成回答、
     附件只在本机预览不上传、会话可在页面上删除。 -->
<template>
  <div class="page-col privacy-page">
    <header class="privacy-head">
      <p class="privacy-eyebrow font-sans">LEGAL</p>
      <h1 class="privacy-title font-serif font-light">隐私政策</h1>
      <p class="privacy-updated font-sans">最后更新：2026-11-12</p>
    </header>

    <div class="privacy-body">
      <p class="privacy-lead">
        本站是个人博客与作品集，AI 助手用于检索站内文章、说说并生成回答。
        下面说明它会处理哪些数据、为什么处理、保存多久，以及你如何删除。
      </p>

      <section class="privacy-section">
        <h2>1. 处理哪些数据</h2>
        <ul>
          <li><strong>对话内容</strong>：你发送的文字，以及 AI 生成的回答。</li>
          <li><strong>会话标识</strong>：浏览器本地生成的随机 UUID，保存在 localStorage，用于找回和删除同一段对话。</li>
          <li><strong>访问日志</strong>：服务器可能记录 IP 地址、浏览器类型、访问时间和请求路径，用于安全防护和故障排查。</li>
          <li><strong>附件</strong>：输入框支持添加本地文件预览，但这些文件不会上传或保存；发送时只发送文字。</li>
        </ul>
        <p>本站不使用第三方广告或统计 Cookie。</p>
      </section>

      <section class="privacy-section">
        <h2>2. 处理目的</h2>
        <p>生成回答、检索站内内容、维持多轮对话上下文、排查故障、防止滥用。</p>
      </section>

      <section class="privacy-section">
        <h2>3. 保存位置与期限</h2>
        <p>
          对话内容保存在本站服务器的数据库中，保留到你主动删除该对话，
          或本站停止提供 AI 助手服务为止。浏览器里的会话标识保存在 localStorage，
          你可以随时清除浏览器数据。
        </p>
      </section>

      <section class="privacy-section">
        <h2>4. 第三方处理</h2>
        <p>
          为了生成回答，你的对话内容会发送给 DeepSeek（深度求索）的 API 处理。
          DeepSeek 的数据处理规则以其官方政策为准。除生成回答所必需外，
          本站不会向其他第三方提供你的对话内容。
        </p>
      </section>

      <section class="privacy-section">
        <h2>5. 你的权利</h2>
        <p>
          你可以在 AI 助手页面的「最近对话」列表中删除任意一段对话，
          删除会同时移除服务器上的记录。若需要查询、更正或导出，
          请通过下方联系方式联系站长。
        </p>
      </section>

      <section class="privacy-section">
        <h2>6. 未成年人</h2>
        <p>本站不是面向未成年人的服务。未成年人应在监护人同意和指导下使用 AI 助手。</p>
      </section>

      <section class="privacy-section">
        <h2>7. 免责声明</h2>
        <p>
          AI 助手回答由大语言模型生成，仅供参考。请对重要信息自行判断核实，
          不要把回答当作法律、医疗、金融等专业意见。
        </p>
      </section>

      <section class="privacy-section">
        <h2>8. 政策更新与联系</h2>
        <p>
          政策更新后会修改本页的「最后更新」日期。如有疑问，可通过 GitHub
          （<a href="https://github.com/pty719" target="_blank" rel="noopener noreferrer">github.com/pty719</a>）
          联系站长。
        </p>
      </section>
    </div>

    <router-link to="/ai-assistant" class="privacy-back tap-target font-sans">
      ← 返回 AI 助手
    </router-link>
  </div>
</template>

<style scoped>
.privacy-page { padding-bottom: 80px; }

.privacy-head {
  max-width: 42rem;
  padding: 56px 0 28px;
  border-bottom: 1px solid rgba(28, 28, 28, 0.1);
}
.privacy-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.25em;
  color: rgba(28, 28, 28, 0.7);
}
.privacy-title {
  margin-top: 0.75rem;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.1;
  letter-spacing: -0.025em;
}
.privacy-updated {
  margin-top: 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(28, 28, 28, 0.7);
}

.privacy-body { max-width: 42rem; }
.privacy-lead {
  margin-top: 2rem;
  font-size: 1.125rem;
  line-height: 2rem;
  color: rgba(28, 28, 28, 0.9);
}

.privacy-section { margin-top: 2.5rem; }
.privacy-section h2 {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 300;
  line-height: 1.375;
  letter-spacing: -0.01em;
}
.privacy-section p,
.privacy-section li {
  margin-top: 0.75rem;
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.9;
  color: rgba(28, 28, 28, 0.9);
}
.privacy-section ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.privacy-section li { margin-top: 0.5rem; }
.privacy-section a {
  color: var(--color-foreground);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.privacy-back {
  display: inline-block;
  margin-top: 3rem;
  padding-bottom: 2px;
  font-size: 0.875rem;
  letter-spacing: 0.15em;
  border-bottom: 1px solid rgba(28, 28, 28, 0.3);
  transition: border-color 0.15s ease;
}
.privacy-back:hover { border-color: var(--color-foreground); }
</style>
