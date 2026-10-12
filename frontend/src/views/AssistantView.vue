<!-- AI 助手聊天页 v3：工具调用透明 + 会话记忆（conversation_id 存 localStorage） -->
<script setup>
import { ref, nextTick } from 'vue'

// 消息列表：{role: 'user'|'assistant', content, tools: []}
const messages = ref([])
const input = ref('')
const sending = ref(false)
const listEl = ref(null)

// 工具名友好映射（后端事件里是英文工具名，这里显示中文）
const TOOL_NAMES = {
  search_articles: '🔧 搜索文章',
  search_moments: '💬 查询说说',
  search_knowledge: '📚 检索知识库',
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  messages.value.push({ role: 'assistant', content: '', tools: [] })
  sending.value = true
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
          // 解析工具名 → 中文友好名（如 search_knowledge → 📚 检索知识库）
          const rawName = (obj.content || '').replace('正在调用：', '').trim()
          last.tools.push(TOOL_NAMES[rawName] || obj.content)
          scrollToBottom()
        } else if (obj.type === 'conversation_id') {
          // ③ 首次会话：后端生成的 id 存 localStorage（刷新不丢，下次请求带上）
          localStorage.setItem('conv_id', obj.id)
        }
      }
    }
  } catch (e) {
    messages.value[messages.value.length - 1].content = '出错了：' + e.message
  } finally {
    sending.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}
</script>

<template>
  <section class="chat">
    <h2>AI 助手</h2>
    <p class="tip">能查站内数据的智能助手——试试问"小站有什么文章？"</p>
    <div class="chat-box">
      <div ref="listEl" class="msg-list">
        <div v-if="messages.length === 0" class="empty">问点什么吧～</div>
        <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
          <div class="bubble">
            <div v-if="m.tools && m.tools.length" class="tool-line">
              <div v-for="(t, j) in m.tools" :key="j">🔧 {{ t }}</div>
            </div>
            <span class="content">{{ m.content }}</span>
          </div>
        </div>
      </div>
      <div class="input-row">
        <input v-model="input" @keyup.enter="send" placeholder="输入问题..." :disabled="sending" />
        <button @click="send" :disabled="sending || !input.trim()">{{ sending ? '思考中...' : '发送' }}</button>
      </div>
    </div>
    <!-- 生成式 AI 服务合规提示（配合备案要求） -->
    <p class="disclaimer">
      AI 助手回答由大语言模型生成，仅供参考，请对重要信息自行判断核实；为保障服务质量，对话记录会保存在站内。
    </p>
  </section>
</template>

<style scoped>
.chat { max-width: 720px; margin: 0 auto; }
.tip { color: #6b7280; margin-bottom: 12px; }
.chat-box {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  display: flex; flex-direction: column; height: 62vh;
}
.msg-list { flex: 1; overflow-y: auto; padding: 16px; }
.empty { color: #9ca3af; text-align: center; margin-top: 40px; }
.msg { display: flex; margin-bottom: 12px; }
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }
.bubble {
  max-width: 75%; padding: 10px 14px; border-radius: 12px;
  line-height: 1.6; white-space: pre-wrap; word-break: break-word;
}
.msg.user .bubble { background: #2563eb; color: #fff; border-bottom-right-radius: 2px; }
.msg.assistant .bubble { background: #f3f4f6; color: #111827; border-bottom-left-radius: 2px; }
.tool-line {
  color: #9ca3af; font-size: 12px; margin-bottom: 6px;
  border-bottom: 1px dashed #d1d5db; padding-bottom: 6px;
}
/* RAG 回答中的来源引用高亮 */
.cite {
  color: #1d4ed8; background: #eff6ff;
  padding: 1px 6px; border-radius: 4px; font-size: 13px;
}
.input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }
.input-row input {
  flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
}
.input-row button {
  padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px;
  cursor: pointer; white-space: nowrap;
}
.input-row button:disabled { opacity: 0.6; cursor: not-allowed; }
.disclaimer {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.8;
  color: #9a918a;
  text-align: center;
}
</style>