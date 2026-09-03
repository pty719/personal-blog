# AI 助手开发踩坑记录（任务一 ~ 任务三）

> 阶段：Week 3 ｜ 内容：SSE 流式接口 → 接入 DeepSeek → ReAct 循环 + 站内工具
> 状态：✅ 任务一/二/三全部验收通过（问"有什么文章"能调工具回答真实数据）

---

## 1. 本阶段做了什么（架构回顾）

```
浏览器 → POST /api/assistants/chat（SSE 流）
              → event_stream 生成器
                  → run_agent（ReAct 循环，最多 5 轮）
                      → chat_ds（带 tools 调 DeepSeek）
                          → 有 tool_calls？→ call_tool → 工具结果喂回 messages → 循环
                          → 没有 → 返回最终回答
```

最终代码结构（每个函数一个职责）：
| 函数 | 职责 |
|---|---|
| `search_articles(keyword)` / `search_moments()` | 工具：查站内数据，返回 JSON 字符串 |
| `TOOLS` | 工具说明书（name/description/parameters） |
| `chat_ds(messages, tools)` | 调 DeepSeek，返回整个 message 对象 |
| `call_tool(name, args)` | 按名字分发执行工具 |
| `run_agent(messages)` | ReAct 主循环（核心） |
| `event_stream(message)` | SSE 生成器 |

---

## 2. 踩坑清单（全部实测踩过）

### 任务一：SSE 基础

| # | 坑 | 症状 | 原因 | 解决 |
|---|---|---|---|---|
| 1 | 把任务当完整功能做 | 写了 models/schemas 建表存库 | 任务一只需 SSE 回显，不需要数据库 | 先看清任务边界：纯接口先不建表 |
| 2 | import 漏 `..` | ImportError 启动失败 | `from schemas` 应为 `from ..schemas` | 包内相对导入必须 `..` |
| 3 | SSE 结尾只有一个 `\n` | 前端解析不出消息 | SSE 协议要求空行分隔（`\n\n`） | 每条 yield 结尾 `\n\n` |
| 4 | `data = AssistantCreate` | 请求体没注入 | 等号是赋值，不是类型注解 | `data: AssistantCreate`（冒号） |
| 5 | 表字段 nullable=False 没给值 | NOT NULL constraint failed | type/content 必填但没赋值 | 要么全填，要么先不存库 |

### 任务二：接 DeepSeek

基本顺利（httpx + Bearer + payload 标准写法）。要点：key 放 `config.py`（pydantic-settings 读 .env），别写死在路由里。

### 任务三：ReAct 循环 + 工具（坑最多）

| # | 坑 | 症状 | 原因 | 解决 |
|---|---|---|---|---|
| 6 | **role 写成 type** | SSE 流中断（curl exit 18），DeepSeek 400 | `{"type": "user"}` 应为 `{"role": "user"}` | OpenAI 协议消息字段是 **role** |
| 7 | **chat_ds 不透传历史** | 工具结果喂不回 LLM，循环失效 | 参数是 `message: str`，把 messages 列表塞进 content | 参数改 `messages: list`，payload 直接透传 |
| 8 | `Article.contains` | AttributeError | contains 是**列**的方法（`.title.contains`），不是类的 | `Article.title.contains(keyword)` |
| 9 | keyword 空时返回 None | 工具结果 None，LLM 报错 | items/return 缩进在 `if keyword:` 里面 | 移出 if，空关键词查全部 |
| 10 | datetime 无法序列化 | TypeError: datetime is not JSON serializable | json.dumps 不认 datetime | `str(a.created_at)[:10]` 转字符串 |
| 11 | `args["keyword"]` KeyError | LLM 可能不传可选参数 | 直接下标访问不存在 | `args.get("keyword", "")` |
| 12 | 说明书与函数签名不一致 | LLM 传多余参数/行为怪 | search_moments 无参却在 parameters 里写 keyword | 说明书参数与函数签名严格一致 |
| 13 | 测试文案残留 | 回答里混入"这只是一个测试" | 任务一的 yield 没删 | 交付前清理调试文案 |

---

## 3. 核心知识点沉淀（本阶段真正学会的）

### 3.1 SSE 格式（一次记牢）

```
data: {...}\n\n     ← 每条消息：data: + JSON + 空行
```

- 后端：`yield 'data: {...}\n\n'`（生成器）
- 前端：`getReader()` 逐块读，按空行切事件

### 3.2 DeepSeek/OpenAI 的 messages 结构（ReAct 的关键）

```
messages = [
  {"role": "user", "content": "小站有什么文章？"},
  {"role": "assistant", "content": None, "tool_calls": [...call1...]},   ← 原样保留！
  {"role": "tool", "tool_call_id": "call_xxx", "content": "工具结果"},
  ...
]
```

**三个铁律**：
1. 消息字段是 `role`（不是 type）
2. assistant 的 tool_calls 消息必须 append 进历史
3. tool 消息必须带 `tool_call_id` 对应 call["id"]

### 3.3 tool_calls 的解析链

```
msg["tool_calls"] → call["function"]["name"]（工具名）
                  → call["function"]["arguments"]（JSON 字符串！）
                  → call["id"]（tool_call_id）
```

`arguments` 是**字符串**，要 `json.loads` 后再传参。

### 3.4 工具设计 = 函数 + 说明书

| 部分 | 作用 |
|---|---|
| 函数（search_articles） | 真实执行，返回 JSON 字符串 |
| 说明书（TOOLS 里的 JSON） | 告诉 LLM"有什么工具、何时用、参数是什么" |
| call_tool 分发器 | 按 name 路由到对应函数 |

**description 写清楚 = LLM 判断何时调用的依据**（写模糊它会乱调或不调）。

---

## 4. 面试怎么讲这个 Agent（30 秒版本）

> "我给博客做了一个 AI 助手：后端实现 ReAct 循环，把站内查询封装成工具（查文章/查说说），用 Function Calling 让 DeepSeek 决定何时调工具，工具结果喂回模型生成最终回答，通过 SSE 流式输出到前端。用户问'小站有什么文章'，模型会先调 search_articles 拿到真实数据再回答——不是瞎编。"

**加分细节**（都是你踩坑换来的）：
- "工具调用循环设了 5 轮上限，防止死循环烧 token"
- "arguments 是 JSON 字符串需要解析，tool 消息要带 tool_call_id"
- "messages 历史要保留 assistant 的 tool_calls 消息"

---

## 5. 待办（任务四）

- [ ] 前端聊天页面：消息气泡 + SSE 流式显示（`getReader` 逐块读）
- [ ] 导航栏加"AI 助手"入口
- [ ] 部署到服务器（key 配到服务器 .env）
- [ ] 流式体验优化（逐字显示、加载状态）