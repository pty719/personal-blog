<!-- AI 助手聊天页 v6：token 流式 + 来源链接 + 历史会话侧栏 + Markdown 回答 -->
<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { apiGet } from '../lib/publicApi'
import { renderChatMarkdown } from '../lib/chatMarkdown'

// 消息列表：{role: 'user'|'assistant', content, tools: [], sources: [], failed, streaming}
const messages = ref([])
const input = ref('')
const sending = ref(false)
const listEl = ref(null)
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

const TOOL_NAMES = {
  search_knowledge: '检索知识库',
  search_moments: '查询说说',
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    conversations.value = Array.isArray(parsed) ? parsed : []
  } catch {
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
        lastRow ? new Date(lastRow.created_at).getTime() : Date.now()
      )
    }
    scrollToBottom()
  } catch (e) {
    if (e.status === 404) {
      conversations.value = conversations.value.filter((c) => c.id !== id)
      saveConversations()
      if (activeConvId.value === id) newChat()
    } else if (!silent) {
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
  if (activeConvId.value) openConversation(activeConvId.value, { silent: true })
})
</script>

<template>
  <section class="assistant-shell">
    <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">AI 助手</h2>
    <p class="mt-3 font-sans text-sm text-foreground/70">
      能查站内数据的智能助手——试试问“小站有什么文章？”
    </p>

    <div class="assistant-layout mt-6">
      <aside class="chat-sidebar" aria-label="历史会话">
        <button type="button" class="new-chat" :disabled="sending" @click="newChat">新对话</button>
        <ul class="conv-list">
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
        <p v-if="!conversations.length" class="conv-empty">暂无历史会话</p>
      </aside>

      <div class="chat-main border border-foreground/15">
        <div
          ref="listEl"
          class="h-[62vh] overflow-y-auto p-5 md:p-6"
          role="log"
          aria-live="polite"
          aria-label="对话记录"
        >
          <p v-if="historyLoading" class="font-sans text-sm text-foreground/70 text-center py-12">
            加载会话…
          </p>
          <template v-else>
            <div v-if="messages.length === 0" class="py-10 text-center">
              <p class="font-sans text-sm text-foreground/70">问点什么吧～</p>
              <div class="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  v-for="s in suggestions"
                  :key="s"
                  type="button"
                  class="suggestion"
                  @click="useSuggestion(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>

            <div
              v-for="(m, i) in messages"
              :key="i"
              class="mb-6"
              :class="m.role === 'user' ? 'text-right' : 'text-left'"
            >
              <div
                class="inline-block max-w-[85%] text-left"
                :class="m.role === 'user' ? 'bg-foreground/5 px-4 py-3' : ''"
              >
                <div v-if="m.tools && m.tools.length" class="mb-3 pb-2 border-b border-foreground/10">
                  <p
                    v-for="(t, j) in m.tools"
                    :key="j"
                    class="font-sans text-xs tracking-[0.08em] text-foreground/70"
                  >
                    {{ t }}
                  </p>
                </div>

                <template v-if="m.role === 'assistant'">
                  <div
                    v-if="m.content && m.streaming"
                    class="font-sans text-base leading-8 whitespace-pre-wrap break-words"
                  >{{ m.content }}</div>
                  <div
                    v-else-if="m.content"
                    class="prose-editorial prose-chat"
                    v-html="renderChatMarkdown(m.content)"
                  ></div>
                  <p v-else-if="sending && i === messages.length - 1" class="font-sans text-sm text-foreground/70">
                    思考中…
                  </p>
                </template>
                <span v-else class="font-sans text-base leading-8 whitespace-pre-wrap break-words">{{ m.content }}</span>

                <div v-if="m.sources && m.sources.length" class="mt-4 pt-3 border-t border-foreground/10">
                  <p class="font-sans text-xs tracking-[0.12em] text-foreground/70 mb-2">来源</p>
                  <ul class="list-none space-y-1">
                    <li v-for="s in m.sources" :key="s.id">
                      <router-link
                        :to="'/articles/' + s.id"
                        class="font-sans text-sm border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
                      >
                        {{ s.title }}
                      </router-link>
                    </li>
                  </ul>
                </div>

                <button
                  v-if="m.failed && !sending"
                  type="button"
                  class="mt-3 font-sans text-xs tracking-[0.1em] border-b border-foreground/30 hover:border-foreground pb-0.5"
                  @click="retry"
                >
                  重试
                </button>
              </div>
            </div>
          </template>
        </div>

        <form class="border-t border-foreground/15 p-3 md:p-4 flex items-end gap-3" @submit.prevent="send">
          <textarea
            v-model="input"
            rows="2"
            placeholder="输入问题…（Enter 发送，Shift+Enter 换行）"
            :disabled="sending"
            aria-label="输入问题"
            class="input-editorial flex-1 resize-none"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <button
            v-if="!sending"
            type="submit"
            :disabled="!input.trim()"
            class="btn-editorial shrink-0"
          >
            发送
          </button>
          <button v-else type="button" class="btn-editorial shrink-0" @click="stop">
            停止
          </button>
        </form>
      </div>

      <aside class="assistant-aside" aria-label="助手说明">
        <section class="aside-block">
          <h3 class="aside-title">能力</h3>
          <ul class="aside-list">
            <li><span class="aside-key">检索</span>按语义查找文章片段</li>
            <li><span class="aside-key">查询</span>读取最近的说说</li>
            <li><span class="aside-key">记忆</span>长对话自动压缩摘要</li>
            <li><span class="aside-key">来源</span>回答可点击回到原文</li>
          </ul>
        </section>
        <section class="aside-block">
          <h3 class="aside-title">使用提示</h3>
          <p class="aside-note">Enter 发送，Shift+Enter 换行。</p>
          <p class="aside-note">回答由大模型生成，重要信息请自行核实。</p>
        </section>
        <section class="aside-block">
          <h3 class="aside-title">会话</h3>
          <p class="aside-note">对话记录保存在站内；历史列表只存在当前浏览器。</p>
        </section>
      </aside>
    </div>

    <!-- 生成式 AI 服务合规提示（配合备案要求） -->
    <p class="mt-4 font-sans text-xs leading-6 text-foreground/70 text-center">
      AI 助手回答由大语言模型生成，仅供参考，请对重要信息自行判断核实；为保障服务质量，对话记录会保存在站内。
    </p>
  </section>
</template>

<style scoped>
.suggestion {
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(28, 28, 28, 0.2);
  border-radius: 0;
  background: transparent;
  color: rgba(28, 28, 28, 0.75);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.suggestion:hover {
  border-color: var(--color-foreground);
  color: var(--color-foreground);
}

.assistant-shell { max-width: 72rem; margin: 0 auto; }

.assistant-layout {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 12rem minmax(0, 1fr) 15rem;
  grid-template-areas: "history chat aside";
  align-items: start;
}

.chat-sidebar {
  grid-area: history;
  border-top: 1px solid rgba(28, 28, 28, 0.1);
  padding-top: 0.75rem;
}
.chat-main {
  grid-area: chat;
  min-width: 0;
}

.assistant-aside {
  grid-area: aside;
  border-top: 1px solid rgba(28, 28, 28, 0.1);
  padding-top: 0.75rem;
}
.aside-block + .aside-block {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(28, 28, 28, 0.08);
}
.aside-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 400;
  margin-bottom: 0.6rem;
}
.aside-list { list-style: none; }
.aside-list li {
  display: flex;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: rgba(28, 28, 28, 0.8);
}
.aside-key {
  flex: 0 0 2.5rem;
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  color: rgba(28, 28, 28, 0.7);
}
.aside-note {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  line-height: 1.7;
  color: rgba(28, 28, 28, 0.7);
}
.aside-note + .aside-note { margin-top: 0.5rem; }
.new-chat {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(28, 28, 28, 0.25);
  border-radius: 0;
  background: transparent;
  color: var(--color-foreground);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.new-chat:hover:not(:disabled) { border-color: var(--color-foreground); }
.new-chat:disabled { opacity: 0.45; cursor: not-allowed; }

.conv-list {
  list-style: none;
  margin-top: 0.75rem;
  max-height: 24rem;
  overflow-y: auto;
}
.conv-row {
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
}
.conv-item {
  flex: 1;
  min-width: 0;
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
  display: block;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: rgba(28, 28, 28, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-date {
  display: block;
  margin-top: 0.15rem;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: rgba(28, 28, 28, 0.7);
}
.conv-del {
  border: 0;
  background: transparent;
  color: rgba(28, 28, 28, 0.7);
  cursor: pointer;
  padding: 0 0.25rem;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  letter-spacing: 0.05em;
}
.conv-del:hover:not(:disabled) { color: var(--color-foreground); }
.conv-del:disabled { opacity: 0.45; cursor: not-allowed; }
.conv-empty {
  margin-top: 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: rgba(28, 28, 28, 0.7);
}

@media (max-width: 1100px) {
  .assistant-layout {
    grid-template-columns: 12rem minmax(0, 1fr);
    grid-template-areas: "history chat" "aside aside";
  }
  .assistant-aside {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
    margin-top: 0.5rem;
  }
  .aside-block + .aside-block { margin-top: 0; padding-top: 0; border-top: 0; }
}

@media (max-width: 899px) {
  .assistant-layout { display: block; }
  .chat-sidebar {
    border-top: 0;
    padding-top: 0;
    margin-bottom: 1rem;
  }
  .conv-list {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    max-height: none;
    padding-bottom: 0.25rem;
  }
  .conv-row { flex: 0 0 auto; min-width: 10rem; }
  .new-chat { width: auto; display: inline-block; margin-bottom: 0.5rem; }
  .conv-empty { margin-top: 0; }
  .assistant-aside { display: block; margin-top: 1.5rem; }
  .aside-block + .aside-block {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(28, 28, 28, 0.08);
  }
}
</style>
