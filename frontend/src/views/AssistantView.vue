<!-- AI 助手聊天页 v7：字符鲨鱼海洋 + 本地输入浮层 + 流式对话浮层 -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { apiGet } from '../lib/publicApi'
import { renderChatMarkdown } from '../lib/chatMarkdown'
import AsciiSharks from '../components/ascii/AsciiSharks.vue'

// 消息列表：{role: 'user'|'assistant', content, tools: [], sources: [], failed, streaming}
const messages = ref([])
const input = ref('')
const sending = ref(false)
const listEl = ref(null)
const chatInputEl = ref(null)
const lastQuestion = ref('')
let controller = null

// 历史会话只存在浏览器本地；后端只提供“按 UUID 读取/删除”，不提供“列出全部”
const conversations = ref([])
const activeConvId = ref(localStorage.getItem('conv_id') || '')
const historyLoading = ref(false)
const STORAGE_KEY = 'ai_conversations'

const suggestions = [
  '小站里有哪些文章？',
  '介绍一下 RAG 的实现',
  '你记得我们聊过什么吗？',
]

// 复制 AI 回答时始终带上标识，避免内容离开页面后失去来源说明
const AI_COPY_NOTICE = '\n\n（AI 生成内容，请核实重要信息）'

const TOOL_NAMES = {
  search_knowledge: '检索知识库',
  search_moments: '查询说说',
}

const hasMessages = computed(() => messages.value.length > 0)
const heroVisible = computed(() => !hasMessages.value && !historyLoading.value)
const chatVisible = computed(() => hasMessages.value || historyLoading.value)
const activeTitle = computed(() => {
  const conv = conversations.value.find((c) => c.id === activeConvId.value)
  return conv ? conv.title : '新对话'
})

// 舞台高度随视口变化；组件内部会把输入框保持为可操作的真 DOM，不缩成图片
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
const stageHeight = computed(() => Math.max(520, Math.min(880, viewportHeight.value - 260)))
function onWindowResize() {
  viewportHeight.value = window.innerHeight
}

const copyState = ref({ index: -1, status: '' })
let copyTimer = null
async function copyMessage(message, index) {
  let status = '已复制'
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('clipboard unavailable')
    }
    await navigator.clipboard.writeText((message.content || '') + AI_COPY_NOTICE)
  } catch (e) {
    status = '复制失败'
  }
  copyState.value = { index, status }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyState.value = { index: -1, status: '' }
  }, 1600)
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    conversations.value = Array.isArray(parsed) ? parsed : []
  } catch (e) {
    conversations.value = []
  }
}

function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value.slice(0, 30)))
}

function titleFor(text) {
  return text.length > 24 ? text.slice(0, 24) + '…' : text
}

function upsertConversation(id, title, updatedAt = Date.now()) {
  if (!id) return
  const existing = conversations.value.find((c) => c.id === id)
  if (existing) {
    if (title) existing.title = title
    existing.updatedAt = updatedAt
  } else {
    conversations.value.unshift({ id, title: title || '新对话', updatedAt })
  }
  conversations.value.sort((a, b) => b.updatedAt - a.updatedAt)
  conversations.value = conversations.value.slice(0, 30)
  saveConversations()
}

function setActive(id) {
  activeConvId.value = id
  if (id) localStorage.setItem('conv_id', id)
  else localStorage.removeItem('conv_id')
}

function formatDate(ts) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

async function openConversation(id, { silent = false } = {}) {
  if (sending.value) return
  historyLoading.value = true
  try {
    const rows = await apiGet(`/api/assistants/conversations/${id}`)
    messages.value = (rows || [])
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        role: row.role,
        content: row.content,
        tools: [],
        sources: [],
        failed: false,
        streaming: false,
      }))
    setActive(id)
    // 旧会话可能不在本地列表（例如功能上线前创建的），加载后补登记
    if (!conversations.value.find((c) => c.id === id)) {
      const firstUser = (rows || []).find((row) => row.role === 'user')
      const lastRow = (rows || [])[rows.length - 1]
      upsertConversation(
        id,
        firstUser ? titleFor(firstUser.content) : '历史对话',
        lastRow ? new Date(lastRow.created_at).getTime() : Date.now(),
      )
    }
    scrollToBottom()
  } catch (e) {
    if (e.status === 404) {
      conversations.value = conversations.value.filter((c) => c.id !== id)
      saveConversations()
      if (activeConvId.value === id) newChat()
    } else if (silent) {
      // 首次进入时后端不可用：回到海洋空态，不把错误塞进对话
      setActive('')
      messages.value = []
    } else {
      messages.value = [{
        role: 'assistant',
        content: '会话加载失败：' + e.message,
        tools: [],
        sources: [],
        failed: true,
        streaming: false,
      }]
    }
  } finally {
    historyLoading.value = false
  }
}

function newChat() {
  if (sending.value) return
  messages.value = []
  input.value = ''
  if (chatInputEl.value) chatInputEl.value.style.height = '28px'
  setActive('')
}

async function removeConversation(id) {
  if (sending.value) return
  if (!confirm('删除这段对话？')) return
  try {
    const res = await fetch(`/api/assistants/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error('删除失败')
  } catch (e) {
    return
  }
  conversations.value = conversations.value.filter((c) => c.id !== id)
  saveConversations()
  if (activeConvId.value === id) newChat()
}

// 海洋输入框只提供本地文本；这里把它接到真实的站内对话接口
function handleOceanSubmit(payload) {
  const text = (payload && payload.text ? payload.text : '').trim()
  if (!text || sending.value) return
  input.value = text
  send()
}

function onChatEnter(event) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  send()
}

function autoGrow(event) {
  const el = event.target
  el.style.height = 'auto'
  el.style.height = `${Math.max(28, Math.min(92, el.scrollHeight))}px`
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  lastQuestion.value = text
  messages.value.push({ role: 'user', content: text })
  messages.value.push({
    role: 'assistant',
    content: '',
    tools: [],
    sources: [],
    failed: false,
    streaming: true,
  })
  sending.value = true
  controller = new AbortController()
  scrollToBottom()
  try {
    const body = { content: text }
    if (activeConvId.value) body.conversation_id = activeConvId.value

    const res = await fetch('/api/assistants/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      let detail = '请求失败（' + res.status + '）'
      try {
        const errData = await res.json()
        if (errData.detail) detail = errData.detail
      } catch (e) { /* 响应体不是 JSON 就忽略 */ }
      throw new Error(detail)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const events = buf.split('\n\n')
      buf = events.pop()
      for (const ev of events) {
        if (!ev.startsWith('data:')) continue
        const obj = JSON.parse(ev.replace('data:', '').trim())
        const last = messages.value[messages.value.length - 1]
        if (obj.type === 'text') {
          last.content += obj.content
          scrollToBottom()
        } else if (obj.type === 'tool') {
          const rawName = (obj.content || '').replace('正在调用：', '').trim()
          const label = TOOL_NAMES[rawName] || obj.content
          if (!last.tools.includes(label)) last.tools.push(label)
          scrollToBottom()
        } else if (obj.type === 'sources') {
          // 多次检索可能返回不同来源：按文章 id 合并，避免覆盖
          const merged = new Map((last.sources || []).map((s) => [s.id, s]))
          for (const s of obj.sources || []) merged.set(s.id, s)
          last.sources = [...merged.values()]
          scrollToBottom()
        } else if (obj.type === 'conversation_id') {
          const id = obj.id
          if (!activeConvId.value) {
            setActive(id)
            upsertConversation(id, titleFor(text))
          }
        }
      }
    }
    if (activeConvId.value) upsertConversation(activeConvId.value, null, Date.now())
  } catch (e) {
    const last = messages.value[messages.value.length - 1]
    if (e.name === 'AbortError') {
      last.content = (last.content ? last.content + '\n\n' : '') + '（已停止生成）'
    } else {
      last.failed = true
      last.content = '出错了：' + e.message
    }
  } finally {
    const last = messages.value[messages.value.length - 1]
    if (last) last.streaming = false
    sending.value = false
    controller = null
  }
}

function stop() {
  if (controller) controller.abort()
}

function retry() {
  if (!lastQuestion.value || sending.value) return
  input.value = lastQuestion.value
  send()
}

function useSuggestion(text) {
  if (sending.value) return
  input.value = text
  send()
}

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

onMounted(() => {
  loadConversations()
  window.addEventListener('resize', onWindowResize)
  if (activeConvId.value) openConversation(activeConvId.value, { silent: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  if (copyTimer) clearTimeout(copyTimer)
  if (controller) controller.abort()
})
</script>

<template>
  <section class="assistant-shell">
    <header class="assistant-head">
      <h1 class="assistant-title">AI 助手</h1>
      <p class="assistant-sub">能查站内文章与说说；对话与历史都保存在站内。</p>
    </header>

    <div class="ocean-stage">
      <AsciiSharks
        class="ocean-canvas"
        theme="light"
        :seed="7"
        :height="stageHeight"
        :show-composer="heroVisible"
        :on-submit="handleOceanSubmit"
      />

      <div v-if="chatVisible" class="chat-overlay">
        <div class="chat-panel">
          <div class="chat-panel__bar">
            <div class="chat-panel__meta">
              <span class="chat-panel__eyebrow">CONVERSATION</span>
              <span class="chat-panel__title">{{ activeTitle }}</span>
            </div>
            <button type="button" class="chat-panel__new tap-target" :disabled="sending" @click="newChat">
              新对话
            </button>
          </div>

          <div ref="listEl" class="chat-list" role="log" aria-live="polite" aria-label="对话记录">
            <p v-if="historyLoading" class="chat-loading">加载会话…</p>
            <template v-else>
              <div
                v-for="(m, i) in messages"
                :key="i"
                class="chat-message"
                :class="m.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'"
              >
                <div class="chat-bubble" :class="m.role === 'user' ? 'chat-bubble--user' : ''">
                  <div v-if="m.tools && m.tools.length" class="chat-tools">
                    <p v-for="(t, j) in m.tools" :key="j" class="chat-tool">{{ t }}</p>
                  </div>

                  <template v-if="m.role === 'assistant'">
                    <div
                      v-if="m.content && m.streaming"
                      class="chat-streaming"
                    >{{ m.content }}</div>
                    <div
                      v-else-if="m.content"
                      class="prose-editorial prose-chat"
                      v-html="renderChatMarkdown(m.content)"
                    ></div>
                    <p v-else-if="sending && i === messages.length - 1" class="chat-thinking">
                      思考中…
                    </p>
                  </template>
                  <span v-else class="chat-user-text">{{ m.content }}</span>

                  <div v-if="m.sources && m.sources.length" class="chat-sources">
                    <p class="chat-sources__label">来源</p>
                    <ul class="chat-sources__list">
                      <li v-for="s in m.sources" :key="s.id">
                        <router-link :to="'/articles/' + s.id" class="chat-source-link">
                          {{ s.title }}
                        </router-link>
                      </li>
                    </ul>
                  </div>

                  <div v-if="m.role === 'assistant'" class="chat-actions">
                    <button
                      v-if="m.content && !m.streaming"
                      type="button"
                      class="chat-copy tap-target"
                      @click="copyMessage(m, i)"
                    >
                      {{ copyState.index === i ? copyState.status : '复制' }}
                    </button>
                    <button
                      v-if="m.failed && !sending"
                      type="button"
                      class="chat-copy tap-target"
                      @click="retry"
                    >
                      重试
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <form class="chat-composer" @submit.prevent="send">
            <textarea
              ref="chatInputEl"
              v-model="input"
              rows="1"
              placeholder="继续追问…（Enter 发送，Shift+Enter 换行）"
              :disabled="sending"
              aria-label="继续追问"
              class="chat-input"
              @keydown.enter.exact="onChatEnter"
              @input="autoGrow"
            ></textarea>
            <div class="chat-composer__row">
              <span class="chat-hint">↵ send · ⇧↵ newline</span>
              <button
                v-if="!sending"
                type="submit"
                class="chat-send tap-target"
                :disabled="!input.trim()"
                aria-label="发送"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M7 7h10v10" /><path d="M7 17 17 7" />
                </svg>
              </button>
              <button
                v-else
                type="button"
                class="chat-send chat-send--stop tap-target"
                aria-label="停止生成"
                @click="stop"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
              </button>
            </div>
            <p class="chat-ai-label">AI 生成内容 · 请核实重要信息</p>
          </form>
        </div>
      </div>
    </div>

    <p class="stage-note">
      点击水面惊散鱼群 · 聚焦画布后 Space 暂停 / R 重置 / 方向键移动虚拟指针 / Enter 制造水波
    </p>

    <div class="assistant-under">
      <section class="panel conv-panel">
        <div class="panel-head">
          <h2 class="panel-title">最近对话</h2>
          <button type="button" class="panel-action tap-target" :disabled="sending" @click="newChat">
            新对话
          </button>
        </div>
        <ul v-if="conversations.length" class="conv-list">
          <li v-for="c in conversations" :key="c.id" class="conv-row">
            <button
              type="button"
              class="conv-item"
              :class="{ 'conv-item--active': c.id === activeConvId }"
              :aria-pressed="c.id === activeConvId"
              :disabled="sending"
              @click="openConversation(c.id)"
            >
              <span class="conv-title">{{ c.title }}</span>
              <span class="conv-date">{{ formatDate(c.updatedAt) }}</span>
            </button>
            <button
              type="button"
              class="conv-del"
              :disabled="sending"
              :aria-label="'删除会话：' + c.title"
              @click.stop="removeConversation(c.id)"
            >
              删除
            </button>
          </li>
        </ul>
        <p v-else class="panel-empty">暂无历史会话</p>

        <div class="suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="suggestion"
            :disabled="sending"
            @click="useSuggestion(s)"
          >
            {{ s }}
          </button>
        </div>
      </section>

      <aside class="panel cap-panel">
        <h2 class="panel-title">能力</h2>
        <ul class="cap-list">
          <li><span class="cap-key">检索</span>按语义查找文章片段</li>
          <li><span class="cap-key">查询</span>读取最近的说说</li>
          <li><span class="cap-key">记忆</span>长对话自动压缩摘要</li>
          <li><span class="cap-key">来源</span>回答可点击回到原文</li>
        </ul>
        <p class="cap-note">Enter 发送，Shift+Enter 换行。回答由大模型生成，重要信息请自行核实。</p>
      </aside>
    </div>

    <!-- 生成式 AI 服务合规提示（配合备案要求） -->
    <p class="disclaimer">
      AI 助手回答由大语言模型生成，仅供参考，请对重要信息自行判断核实；为保障服务质量，对话记录会保存在站内。
      <router-link to="/privacy" class="disclaimer-link">隐私政策</router-link>
    </p>
  </section>
</template>

<style scoped>
.assistant-shell {
  max-width: 72rem;
  margin: 0 auto;
}

.assistant-head {
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.assistant-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 300;
  letter-spacing: -0.02em;
}
.assistant-sub {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: rgba(28, 28, 28, 0.7);
}

.ocean-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d2d3cd;
}
.ocean-canvas {
  display: block;
  width: 100%;
}

.chat-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 20px;
  pointer-events: none;
}
.chat-panel {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  width: min(780px, 100%);
  min-height: 0;
  overflow: hidden;
  border: 1px solid #d2d3cd;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.89);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 48px rgba(19, 22, 18, 0.07);
}
.chat-panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 12px 16px;
  border-bottom: 1px solid #d2d3cd;
}
.chat-panel__meta {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  min-width: 0;
}
.chat-panel__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  color: rgba(19, 22, 18, 0.5);
}
.chat-panel__title {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: #131612;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-panel__new {
  flex: 0 0 auto;
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(19, 22, 18, 0.2);
  border-radius: 6px;
  background: transparent;
  color: #131612;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  cursor: pointer;
}
.chat-panel__new:hover:not(:disabled) { border-color: #131612; }
.chat-panel__new:disabled { opacity: 0.45; cursor: not-allowed; }

.chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}
.chat-loading {
  padding: 2.5rem 0;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: rgba(19, 22, 18, 0.6);
}
.chat-message {
  display: flex;
  margin-bottom: 1.2rem;
}
.chat-message--user { justify-content: flex-end; }
.chat-message--assistant { justify-content: flex-start; }
.chat-bubble {
  max-width: 88%;
  color: #131612;
  font-family: var(--font-sans);
}
.chat-bubble--user {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(19, 22, 18, 0.06);
  font-size: 0.9375rem;
  line-height: 1.7;
}
.chat-user-text { white-space: pre-wrap; word-break: break-word; }
.chat-streaming {
  font-size: 1rem;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-thinking {
  font-size: 0.875rem;
  color: rgba(19, 22, 18, 0.6);
}
.chat-tools {
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(19, 22, 18, 0.1);
}
.chat-tool {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  color: rgba(19, 22, 18, 0.58);
}
.chat-sources {
  margin-top: 1rem;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(19, 22, 18, 0.1);
}
.chat-sources__label {
  margin-bottom: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  color: rgba(19, 22, 18, 0.55);
}
.chat-sources__list { list-style: none; }
.chat-source-link {
  font-size: 0.8125rem;
  border-bottom: 1px solid rgba(19, 22, 18, 0.28);
  transition: border-color 0.15s ease;
}
.chat-source-link:hover { border-color: #131612; }
.chat-actions {
  display: flex;
  gap: 0.9rem;
  margin-top: 0.65rem;
}
.chat-copy {
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgba(19, 22, 18, 0.25);
  background: transparent;
  color: rgba(19, 22, 18, 0.6);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.chat-copy:hover { color: #131612; border-color: #131612; }

.chat-composer {
  padding: 10px 12px;
  border-top: 1px solid #d2d3cd;
  background: rgba(255, 255, 255, 0.7);
}
.chat-input {
  display: block;
  width: 100%;
  min-height: 28px;
  max-height: 92px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #131612;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  line-height: 1.5;
  resize: none;
  overflow-y: auto;
}
.chat-input::placeholder { color: rgba(19, 22, 18, 0.62); }
.chat-input:disabled { opacity: 0.55; }
.chat-composer__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 32px;
  margin-top: 6px;
}
.chat-hint {
  margin-right: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(19, 22, 18, 0.68);
}
.chat-ai-label {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(19, 22, 18, 0.62);
}
.chat-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #e3e4de;
  color: #131612;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}
.chat-send:hover:not(:disabled) { background: #d8d9d2; }
.chat-send:disabled { opacity: 0.45; cursor: not-allowed; }
.chat-send--stop { background: #131612; color: #fff; }
.chat-send--stop:hover { background: #2c2f2b; }

.stage-note {
  margin-top: 0.55rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: rgba(28, 28, 28, 0.72);
}

.assistant-under {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.panel {
  border-top: 1px solid rgba(28, 28, 28, 0.12);
  padding-top: 0.9rem;
  min-width: 0;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.panel-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 400;
}
.panel-action {
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgba(28, 28, 28, 0.3);
  background: transparent;
  color: rgba(28, 28, 28, 0.72);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  cursor: pointer;
}
.panel-action:hover:not(:disabled) { color: var(--color-foreground); border-color: currentColor; }
.panel-action:disabled { opacity: 0.45; cursor: not-allowed; }
.panel-empty {
  margin-top: 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: rgba(28, 28, 28, 0.6);
}
.conv-list {
  list-style: none;
  margin-top: 0.6rem;
  max-height: 16rem;
  overflow-y: auto;
}
.conv-row { display: flex; align-items: stretch; gap: 0.25rem; }
.conv-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  border: 0;
  border-bottom: 1px solid rgba(28, 28, 28, 0.08);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.conv-item:disabled { opacity: 0.5; cursor: not-allowed; }
.conv-item--active .conv-title { color: var(--color-primary-ink); }
.conv-title {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: rgba(28, 28, 28, 0.82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-date {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: rgba(28, 28, 28, 0.55);
}
.conv-del {
  padding: 0 0.3rem;
  border: 0;
  background: transparent;
  color: rgba(28, 28, 28, 0.55);
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  cursor: pointer;
}
.conv-del:hover:not(:disabled) { color: var(--color-foreground); }
.conv-del:disabled { opacity: 0.45; cursor: not-allowed; }

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1rem;
}
.suggestion {
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(28, 28, 28, 0.18);
  border-radius: 2px;
  background: transparent;
  color: rgba(28, 28, 28, 0.72);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.suggestion:hover:not(:disabled) { border-color: var(--color-foreground); color: var(--color-foreground); }
.suggestion:disabled { opacity: 0.45; cursor: not-allowed; }

.cap-list { list-style: none; margin-top: 0.6rem; }
.cap-list li {
  display: flex;
  gap: 0.6rem;
  padding: 0.32rem 0;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: rgba(28, 28, 28, 0.78);
}
.cap-key {
  flex: 0 0 2.25rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  color: rgba(28, 28, 28, 0.55);
  padding-top: 0.18rem;
}
.cap-note {
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(28, 28, 28, 0.08);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  line-height: 1.7;
  color: rgba(28, 28, 28, 0.62);
}

.disclaimer {
  margin-top: 1.2rem;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  line-height: 1.7;
  color: rgba(28, 28, 28, 0.7);
}
.disclaimer-link {
  margin-left: 0.35em;
  color: var(--color-foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.disclaimer-link:hover { color: var(--color-primary-ink); }

@media (max-width: 899px) {
  .assistant-under { grid-template-columns: 1fr; gap: 1.25rem; }
  .chat-overlay { padding: 10px; }
  .chat-panel { width: 100%; border-radius: 10px; }
  .chat-list { padding: 14px; }
}

@media (pointer: coarse), (max-width: 1023px) {
  .suggestion {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .conv-item { min-height: 44px; }
  .conv-del {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

@media (max-width: 560px) {
  .assistant-head { gap: 0.5rem; flex-direction: column; align-items: flex-start; }
  .chat-panel__eyebrow { display: none; }
  .chat-bubble { max-width: 94%; }
  .chat-hint { display: none; }
  .stage-note { line-height: 1.6; }
}
</style>
