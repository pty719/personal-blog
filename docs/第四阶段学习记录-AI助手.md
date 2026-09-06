# 第四阶段学习记录：站内 AI 助手（Agent 实战）

> 项目：小站 ｜ 周期：Week 3 ｜ 状态：✅ 全部完成并上线
> 线上地址：http://***REMOVED-ROTATED***/ai-assistant（公网可演示）

---

## 1. 阶段总览：从 0 到 1 做出第一个 Agent

| 任务 | 内容 | 状态 |
|---|---|---|
| 任务一 | SSE 流式接口（FastAPI StreamingResponse） | ✅ |
| 任务二 | 接入 DeepSeek（httpx + function calling 前身） | ✅ |
| 任务三 | **ReAct 循环 + 站内工具**（核心） | ✅ |
| 任务四 | 前端聊天页（SSE 流式读取 + 工具透明性） | ✅ |
| 任务 C1 | **会话记忆**（后端存库 + localStorage） | ✅ |
| 部署 | Docker 上线公网（httpx 依赖坑修复） | ✅ |

**能力变化**：小站从"展示数据的网站"变成"能对话、能查数据、能记住上下文的智能体"。

---

## 2. 最终架构（面试画这张图）

```
浏览器（AssistantView.vue）
   │ POST /api/assistants/chat（SSE 流）
   ▼
FastAPI chat 路由
   ├── 会话处理：conversation_id（有则查历史，无则生成）→ 存 user 消息
   ├── event_stream 生成器（SSE 事件流）
   │     ├── conversation_id 事件（首次）
   │     ├── tool 事件（🔧 工具透明性）
   │     └── text 事件（回答）
   └── run_agent 生成器（ReAct 循环 ≤5 轮）
         ├── chat_ds：带 tools 调 DeepSeek
         ├── 有 tool_calls → call_tool（查文章/说说）→ 结果喂回 → 循环
         └── 无 tool_calls → yield answer → 存 assistant 消息
   ▼
DeepSeek API（deepseek-chat + function calling）
```

**数据流**：assistants 表（MySQL/SQLite）存会话消息，前端 localStorage 存 conversation_id。

---

## 3. 核心知识点（每个都是面试考点）

### 3.1 SSE 流式（Server-Sent Events）
- 格式：`data: JSON\n\n`（空行分隔，每条消息）
- 后端：`StreamingResponse(生成器, media_type="text/event-stream")`，生成器 yield 一段段
- 前端：`fetch` + `res.body.getReader()` 逐块读，`TextDecoder` 解码，按 `\n\n` 切事件

### 3.2 ReAct 循环（推理+行动）
```
for _ in range(5):
    msg = chat_ds(messages, TOOLS)       # 带工具清单问 LLM
    if msg.tool_calls:                    # LLM 要调工具
        执行工具 → 结果加回 messages → continue
    else:
        return msg.content                # 直接回答 = 结束
```
- **上限 5 轮**：防死循环烧 token
- messages 三铁律：assistant 的 tool_calls 原样保留 / tool 消息带 tool_call_id / arguments 是 JSON 字符串要解析

### 3.3 工具设计 = 函数 + 说明书
- 函数：`search_articles(keyword)` 返回 JSON 字符串（LLM 靠文本读结果）
- 说明书（TOOLS）：name/description/parameters——description 写清楚，LLM 才知道何时调用
- call_tool 分发器：按 name 路由

### 3.4 会话记忆（Agent 的"记忆力"）
- **LLM 无状态**，上下文要外部管理
- 方案：conversation_id（uuid）+ 数据库存消息 + 前端 localStorage 存 id
- 匿名会话模式：游客免登录，浏览器自动拥有独立会话
- 升级方向：RAG 知识库（已做）、登录后绑定 user_id（后续）；**摘要压缩见 3.4+（已实现）**

### 3.4+ 记忆增强：长对话摘要压缩（C2，已实现并上线）

**动机**：对话到 30 轮历史 60+ 条 → 每次请求全量发 DeepSeek → token 线性膨胀

**设计**：
- 存储：**复用 assistants 表**，摘要 = 一条 `role='summary'` 消息（content 存摘要）——不加列！摘要本质是"要发给 LLM 的对话内容"，和普通消息同构（查询/排序/组装零特殊逻辑）
- 触发：`len(history) > 20` 条 → 压缩
- 压缩：最早 (N-5) 条 + 已有 summary → 调 LLM 压成 120 字摘要 → **滚动更新**（更新已有 summary，不新增）→ 删旧消息
- 顺序：event_stream 组装 messages 前 `history.sort(summary 置顶)`——模型先看摘要再看最近对话
- 兜底：DeepSeek 挂了不压缩，全量发送（压缩是优化不是依赖）

**验收**（本地实测）：25 条 → 压缩后 6 条（summary 1 条）；再 20 条 → 第二次压缩 summary 仍 1 条（滚动）✅

**踩坑**：
1. **ORM 模型 ≠ 数据库表**：加列后 create_all 不会给已存在表加列 → `no such column` 500（要 ALTER TABLE 迁移）
2. f-string 塞 ORM 对象（输出 `<object at 0x...>`）——要 `.content`
3. messages 列表混 str/dict → DeepSeek 400——必须全 dict
4. summary 别当普通消息删——先分离 role='summary'
5. 压缩后要**重新查 history**（库里已删旧消息）——否则本轮请求还是旧历史

**面试话术**："长对话做摘要压缩：>20 条触发，最早消息 LLM 压成 role=summary 滚动更新，请求历史 = 摘要 + 最近几条，token 基本恒定；失败降级全量——LangChain Summary Memory 同思路。"

### 3.5 FastAPI 依赖注入 vs SessionLocal
| | 路由函数 | 普通函数 |
|---|---|---|
| 数据库会话 | `db: Session = Depends(get_db)`（自动关） | `SessionLocal()`（自己 finally close） |
| 原因 | 在请求生命周期内 | 无注入可用（如工具函数） |

---

## 4. 踩坑清单（本阶段新增）

| # | 坑 | 症状 | 解决 |
|---|---|---|---|
| 1 | **requirements 缺 httpx** | 容器 `ModuleNotFoundError`，本地没事 | 容器是全新环境，依赖必须全列在 requirements.txt（本地能跑≠容器能跑！） |
| 2 | `db.add(conversation_id=...)` | TypeError: Session.add() got an unexpected keyword | `db.add(Assistant(...))`——add 收的是**对象**，不是字段 |
| 3 | db 依赖写错 | `db : Depends(SessionLocal)` | 三件套：`: Session = Depends(get_db)` |
| 4 | 历史又包一层 user | content 变列表，LLM 报错 | run_agent 直接传 messages 列表 |
| 5 | history desc 排序 | 模型倒着读对话 | `order_by(created_at)` 升序 |
| 6 | role 写成 type | DeepSeek 400 | OpenAI 协议字段是 role |
| 7 | SSE 格式丢失 | 前端解析失败 | yield 必须是 `data: json\n\n` |
| 8 | answer 后无 return | 重复回答 | yield 后显式 return 结束生成器 |
| 9 | Article.contains | AttributeError | 列的 `.title.contains` |
| 10 | 本地能跑 ≠ 服务器能跑 | 部署才暴露 | 部署后必须公网验证全链路 |

---

## 5. 面试速记（30 秒讲清这个 Agent）

> "我给博客做了 AI 助手：FastAPI 实现 ReAct 循环，把站内查询封装成工具（Function Calling 让 DeepSeek 决定何时调用），工具结果喂回模型生成回答，SSE 流式输出到前端；支持匿名会话记忆（conversation_id 存库 + localStorage），部署在公网可演示。"

**加分细节**：
- 循环 5 轮上限防死循环 / tool_call_id 必须对应 / 生成器事件流设计（tool 事件透明性）
- 会话记忆的取舍：为什么用"存后端 + localStorage"，游客免登录的匿名会话模式
- 部署踩坑：httpx 依赖缺失（本地能跑≠容器能跑）——体现工程经验

---

## 6. 部署记录（本次上线）

| 项 | 值 |
|---|---|
| 线上地址 | http://***REMOVED-ROTATED***/ai-assistant |
| 部署方式 | docker compose 重建 backend/frontend 镜像 |
| 建表 | 容器启动 init_db.py 自动 create_all（幂等，老表不动） |
| 依赖坑 | requirements.txt 加 httpx>=0.27（当时缺失导致 502） |
| 种子数据 | 本地 SQLite → 服务器 API 导入（文章2/说说6/友链3/项目3） |

---

## 7. 待办（后续增强）

- [x] 任务 C2：摘要压缩（>20 条自动压缩早期对话，防 token 爆炸）
- [x] 文章 AI 摘要（发布时自动生成）
- [x] 友链监控 Agent（APScheduler 定时巡检 friends 表）
- [x] RAG 知识库"问博主"（30 天计划 W3）
- [ ] 会话历史列表 UI（像 ChatGPT 左侧栏）