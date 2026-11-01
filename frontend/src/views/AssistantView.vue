<!-- AI 助手聊天页 v5：Editorial 对话界面 + Markdown 回答 + 来源链接 + 停止/重试 -->
<script setup>
import { ref, nextTick } from 'vue'
import { renderChatMarkdown } from '../lib/chatMarkdown'

// 消息列表：{role: 'user'|'assistant', content, tools: [], sources: [], failed}
const messages = ref([])
const input = ref('')
const sending = ref(false)
const listEl = ref(null)
const lastQuestion = ref('')
let controller = null

const suggestions = [
  '小站里有哪些文章？',
  '介绍一下 RAG 的实现',
  '你记得我们聊过什么吗？',
]

// 工具名友好映射（后端事件里是英文工具名，这里显示中文）
const TOOL_NAMES = {
  search_knowledge: '检索知识库',
  search_moments: '查询说说',
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  lastQuestion.value = text
  messages.value.push({ role: 'user', content: text })
  messages.value.push({ role: 'assistant', content: '', tools: [], sources: [], failed: false })
  sending.value = true
  controller = new AbortController()
  scrollToBottom()
  try {
    // ① 会话记忆：本地有 conversation_id 就带上（没有 = 首次，后端会生成）
    const body = { content: text }
    const convId = localStorage.getItem('conv_id')
    if (convId) body.conversation_id = convId

    const res = await fetch('/api/assistants/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    // ② 非 200：读后端错误信息（429 限流 / 422 校验 / 500 服务器错）
    if (!res.ok) {
      let detail = '请求失败（' + res.status + '）'
      try {
        const errData = await res.json()
        if (errData.detail) detail = errData.detail
      } catch (e) { /* 响应体不是 JSON 就忽略 */ }
      throw new Error(detail)
    }
    // ③ SSE 流式读取
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
          // 解析工具名 → 中文友好名（如 search_knowledge → 检索知识库）
          const rawName = (obj.content || '').replace('正在调用：', '').trim()
          last.tools.push(TOOL_NAMES[rawName] || obj.content)
          scrollToBottom()
        } else if (obj.type === 'sources') {
          last.sources = obj.sources || []
          scrollToBottom()
        } else if (obj.type === 'conversation_id') {
          // ③ 首次会话：后端生成的 id 存 localStorage（刷新不丢，下次请求带上）
          localStorage.setItem('conv_id', obj.id)
        }
      }
    }
  } catch (e) {
    const last = messages.value[messages.value.length - 1]
    if (e.name === 'AbortError') {
      last.content = (last.content ? last.content + '\n\n' : '') + '（已停止生成）'
    } else {
      last.failed = true
      last.content = '出错了：' + e.message
    }
  } finally {
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
</script>

<template>
  <section class="page-col">
    <h2 class="font-serif text-2xl md:text-3xl font-light tracking-tight">AI 助手</h2>
    <p class="mt-3 font-sans text-sm text-foreground/70">
      能查站内数据的智能助手——试试问“小站有什么文章？”
    </p>

    <div class="mt-6 border border-foreground/15">
      <div
        ref="listEl"
        class="h-[62vh] overflow-y-auto p-5 md:p-6"
        role="log"
        aria-live="polite"
        aria-label="对话记录"
      >
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
                v-if="m.content"
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
</style>
