# 站内 AI 助手开发教程（ReAct + DeepSeek + SSE）

> 项目：小站 ｜ 阶段：Week 3 ｜ 目标：给小站加一个"AI 助手"，能回答问题、能查站内数据
> 意义：**你的第一个真实 Agent**——LLM + 工具 + 循环的完整落地，面试直接讲它

---

## 0. 这个任务为什么是求职核心

智能体开发岗位的面试必问：**"你做过 Agent 吗？它怎么调用工具的？"**

这个任务让你能回答：
- 我实现了 ReAct 循环：LLM 决定调哪个工具 → 执行工具 → 结果喂回 LLM → 生成回答
- 我设计了站内工具（查文章/查说说），用 Function Calling 让模型选择工具
- 我用 SSE 实现了流式输出，体验和大模型网站一样

**一个能"自主搜索、分析、输出"的 Agent——就是你面试要现场构建的东西，先在这练。**

---

## 1. 概念讲解（先看懂，再动手）

### 1.1 Agent = 大模型 + 工具 + 循环

```
普通聊天：用户 → LLM → 回答          （LLM 只会"说"，不会"做"）
Agent：   用户 → LLM → 决定调工具 → 执行工具 → 结果喂回 → 继续 → 回答
                                                    ↑______循环______↑
```

LLM 的局限：它不知道你数据库里有什么（训练数据之外）。**工具 = 给它一双"手"**——查文章、查说说、以后查天气/调 API。

### 1.2 ReAct 循环（核心中的核心）

ReAct = **Re**asoning + **Act**ing（推理 + 行动），每一轮循环：

```
① 把"对话历史 + 工具清单"发给 LLM
② LLM 决定：
   - 直接回答（它觉得信息够了）→ 结束
   - 调用工具（如 search_articles）→ 执行工具拿结果
③ 把工具结果拼进对话，回到 ①
```

例：用户问"小站最近写了什么文章？"
```
LLM: 我需要查一下文章列表 → tool_call: search_articles()
执行: 返回 [{title: "Vue3 实战笔记", ...}]
LLM: 根据查询结果，小站最近的文章有《Vue3 实战笔记》... → 回答 ✅
```

**关键点：工具调用的循环最多 N 次（比如 5 次），防止死循环。**

### 1.3 Function Calling（让 LLM 选工具）

DeepSeek 支持 OpenAI 兼容的 function calling。你给 LLM 一份"工具说明书"：

```json
{
  "type": "function",
  "function": {
    "name": "search_articles",
    "description": "按关键词搜索站内文章列表",
    "parameters": {
      "type": "object",
      "properties": {
        "keyword": {"type": "string", "description": "搜索关键词，可空"}
      }
    }
  }
}
```

请求时带 `tools: [...]`，LLM 如果觉得需要工具，返回里会有：
```json
{"tool_calls": [{"function": {"name": "search_articles", "arguments": "{\"keyword\":\"Vue\"}"}}]}
```
你解析它 → 执行对应函数 → 把结果作为 `role: "tool"` 消息加回对话 → 再问 LLM。

**工具 = 函数 + 说明书（描述+参数）**。写清楚 description 很重要，LLM 靠它判断何时用。

### 1.4 SSE 流式输出（体验）

SSE（Server-Sent Events）：服务器**持续**推送文本，浏览器**边收边显示**，不用等全部生成。

HTTP 格式（每行 `data: 内容`，空行分隔）：
```
data: {"type": "text", "content": "根据查询结果"}

data: {"type": "text", "content": "，小站最近有"}

data: {"type": "done"}
```

FastAPI 返回 SSE 的方式（流式响应）：
```python
from fastapi.responses import StreamingResponse

def event_stream():
    yield 'data: {"type": "text", "content": "你好"}\n\n'
    yield 'data: {"type": "done"}\n\n'

@app.post("/api/assistant/chat")
async def chat(...):
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

前端读取：
```js
const res = await fetch('/api/assistant/chat', {method: 'POST', ...})
const reader = res.body.getReader()   // 逐块读
// 把流拼起来按 \n\n 切分，解析 data: 行
```

---

## 2. 架构设计

```
浏览器（前端页面）
   │ POST /api/assistant/chat（SSE 流）
   ▼
FastAPI 后端
   ├── 工具层：search_articles / get_article / search_moments
   │           （直接调你现有的 SQLAlchemy 查询！）
   └── ReAct 循环：调 DeepSeek API（function calling）→ 执行工具 → 循环
                    │
                    ▼
              DeepSeek API（deepseek-chat，需要 API key）
```

**工具直接复用后端已有的查询逻辑**——你 Week 1 写的 SQLAlchemy 查询，现在变成 Agent 的工具。

---

## 3. 任务书（4 步，一步步来）

### 任务 1：SSE 基础接口（先让"流"跑起来）

**需求**：新建 `app/routers/assistant.py`，做一个 `POST /api/assistant/chat`：
- 请求体：`{"message": "你好"}`
- 响应：SSE 流，先流式吐 3 句固定文案（如"正在思考..."），最后 `data: {"type": "done"}`
- 挂载到 main.py

**验收**：curl 能看到流式输出（每行 `data:`）：
```bash
curl -s -X POST http://127.0.0.1:8000/api/assistant/chat -H "Content-Type: application/json" -d '{"message":"hi"}'
```
输出类似：
```
data: {"type": "text", "content": "正在思考..."}

data: {"type": "done"}
```

### 任务 2：接入 DeepSeek（非流式先跑通）

**需求**：`config.py` 加 `DEEPSEEK_API_KEY` 配置；chat 接口改为：把用户消息发给 DeepSeek（`https://api.deepseek.com/chat/completions`，model=deepseek-chat），拿到回答返回（先不用流式，直接 `yield` 一次给完）。

**提示**：
- 用 `httpx` 调 DeepSeek（后端 venv 有 httpx）
- 请求头 `Authorization: Bearer <key>`
- body：`{"model": "deepseek-chat", "messages": [{"role": "user", "content": message}]}`
- 本地测试 key 放哪：`backend/.env`（config.py 的 pydantic-settings 会读）

**验收**：问"你好"，返回 DeepSeek 的真实回答。

> 💡 DeepSeek key 你在 py_agent_prj_demo 里填过（llm.py），用同一个；没有就去 platform.deepseek.com 申请。

### 任务 3：ReAct 循环 + 站内工具（核心！）

**需求**：给 chat 接口加两个工具，实现完整循环：
- `search_articles(keyword)`：按标题模糊查文章列表（复用你的 SQLAlchemy 查询）
- `search_moments()`：查最近 10 条说说

**工具说明书**（写进请求的 `tools` 参数）：格式见 1.3 节。

**循环逻辑**（伪代码，照着实现）：
```
messages = [user 消息]
for _ in range(5):                        # 最多 5 轮，防死循环
    resp = 调 DeepSeek(messages, tools)   # 带工具清单
    msg = resp.choices[0].message
    if msg.tool_calls:                    # LLM 想调工具
        把 msg 加进 messages（role=assistant）
        for call in msg.tool_calls:
            result = 执行工具(call.function.name, 解析 arguments)
            把结果加进 messages（role=tool, tool_call_id=call.id）
        continue                           # 回到循环，再问 LLM
    else:
        输出 msg.content，结束
```

**验收**：
- 问"小站有什么文章？"→ 助手先调 search_articles 再回答（内容里能看到文章标题）
- 问"最近说了什么？"→ 调 search_moments
- 问"你好"→ 不调工具直接回答

### 任务 4：前端聊天页面

**需求**：新建 `views/AssistantView.vue`：
- 聊天框：消息列表（用户/助手气泡）+ 底部输入框 + 发送按钮
- 发消息 → POST /api/assistant/chat → 用 `fetch` 的 `ReadableStream` 逐块读 SSE → 边读边把内容追加到气泡
- 导航栏加"AI 助手"菜单（套路你熟：组件 + 路由 + 菜单）

**提示**（SSE 前端解析）：
```js
const res = await fetch('/api/assistant/chat', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ message: msg }),
})
const reader = res.body.getReader()
const decoder = new TextDecoder()
let buf = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += decoder.decode(value, { stream: true })
  // 按空行切分 SSE 事件，解析每行 data: 开头的 JSON
  // {"type":"text","content":"..."} → 追加显示
}
```

**验收**：页面能发消息、AI 回答逐字流出、问文章问题能答出来。

---

## 4. 验收标准（全部做完对照）

- [ ] 任务 1：curl 看到 SSE 流格式
- [ ] 任务 2：DeepSeek 真实回答（本地 .env 配 key）
- [ ] 任务 3：问"有什么文章"会调工具再回答（Network 里能看到两次请求 DeepSeek）
- [ ] 任务 4：前端页面流式显示，体验像真聊天
- [ ] 部署后：http://***REMOVED-ROTATED***/ai-assistant 在线可用（key 配置到服务器 .env）

---

## 5. 提示与坑（先看，少踩）

| 坑 | 说明 |
|---|---|
| tool_calls 里 arguments 是字符串 | 要 `json.loads` 解析，别直接当对象用 |
| 工具结果要带 `role: "tool"` + `tool_call_id` | 格式不对 DeepSeek 会报错 |
| messages 里 assistant 的 tool_calls 必须原样保留 | 不能只加 tool 消息不加 assistant 消息 |
| SSE 的 yield 之间要有 `\n\n` | 空行是事件分隔符，丢了前端解析不出来 |
| 循环记得设上限 | 5 次够了，不然可能无限调工具烧钱 |
| 前端 fetch 流式需要 `getReader()` | 普通 `res.json()` 拿不到流 |

---

## 6. 和你的 30 天计划的关系

这个任务 = 你 30 天计划 **W2 调研 Agent** 的迷你版：
- 工具设计 → 以后做搜索 Agent 的搜索工具
- ReAct 循环 → 面试 Live 构建的核心骨架
- 部署上线 → 可演示的作品

**做完它，你就能在面试时说："我实现过一个带工具调用的 Agent，部署在公网上"——这句话值一个 offer。**

---

## 7. 开始顺序

1. 先读 1.1-1.4 概念，不懂问我
2. 任务 1 → 验收 → 找我 review
3. 任务 2 → 验收（要 key）
4. 任务 3（核心）→ 卡住 20 分钟问我，我给提示不给答案
5. 任务 4 → 前端你熟
6. 全部完成后：部署到服务器 + 生成《第四阶段学习记录》1
