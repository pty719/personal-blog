# 小站（Starhiro 复刻版）

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![Vue3](https://img.shields.io/badge/Vue3-4FC08D?style=flat&logo=vuedotjs)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker)
![DeepSeek](https://img.shields.io/badge/DeepSeek-4D6BFE?style=flat&logo=deepseek)
![RAG](https://img.shields.io/badge/RAG-TF--IDF-FF6B6B?style=flat)
![Status](https://img.shields.io/badge/status-online-brightgreen?style=flat)

个人博客全栈项目 —— 求职作品。**FastAPI + Vue3 + MySQL + Docker**，已具备完整 Agent 能力：ReAct 循环 / RAG 知识库 / 定时巡检 / 会话记忆 / API 防护。

🌐 **线上地址：http://***REMOVED-ROTATED*****（阿里云 80 端口，已上线）

---

## 当前进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Week 1 | 后端：FastAPI + SQLAlchemy + JWT，16 接口 | ✅ 完成（一键脚本验收） |
| Week 2 | 前端：Vue3 展示页 + 管理后台 + 搜索/分页/批量删除 | ✅ 完成 |
| Week 3 | 部署上线（Docker Compose）+ AI 伴侣整合 | ✅ 完成（公网全链路验证） |
| Week 3 | **AI 助手（ReAct + DeepSeek + SSE + 会话记忆）** | ✅ 完成并上线（http://***REMOVED-ROTATED***/ai-assistant） |
| Week 3-4 | **文章 AI 摘要 / 友链监控 Agent / 限流防护 / RAG 知识库** | ✅ 全部完成上线 |

---

## 阶段里程碑（每个阶段的产出与验收）

### ✅ Week 1：后端（8-24 ~ 8-26）
- 分层结构：main/config/db/models/schemas/auth/routers
- 5 张表（users/articles/moments/friends/projects）+ JWT 登录
- 16 个接口，`test_moments.py`（11/11）+ `test_friends_projects.py`（19/19）一键验收
- 踩坑沉淀：路由斜杠 405、Create schema 服务器字段、排序 tiebreaker、可空字段 `| None`

### ✅ Week 2：前端（8-26 ~ 8-27）
- Vue3 + Vite + vue-router + axios + marked，9 个页面组件
- 列表页套路（onMounted + 三状态）、动态路由详情页、管理后台四资源 CRUD
- 文章管理增强：**标题搜索 / 分页 / 批量删除**（后端加 keyword 参数）
- AI 伴侣整合：`/ai-partner` 从 iframe 嵌入改为项目展示页

### ✅ Week 3：部署上线（8-27）
- Docker Compose 三件套（mysql + backend + frontend），本地构建验证 ✅
- 服务器：阿里云 docker-ce 源 + 镜像加速器 + 随机 .env
- **踩过的大坑**：OOM 失联（2G 内存双 MySQL）→ 控制台重启 + AI 伴侣退役 + swap
- 最终：80 端口独占，公网全链路验证通过（首页/API/登录/SPA 路由）
- 线上 admin 密码已改（默认密码已失效，见部署记录）

### ✅ Week 3-4：Agent 能力全家桶（8-28 ~ 8-31）
- **AI 助手**：ReAct 循环（DeepSeek function calling）+ SSE 流式 + 会话记忆（assistants 表 + localStorage 匿名会话）
- **文章 AI 摘要**：发布时自动调 LLM 生成（`utils/llm.py` 公共模块）
- **友链监控 Agent**：APScheduler 每天 8:00 巡检（HEAD 探测 + is_active/last_check）
- **防护三件套**：IP 限流（10 次/分钟 429）+ 会话轮数 + 消息长度 + event_stream 兜底
- **RAG 知识库**：文章切块 + TF-IDF 检索（jieba 分词）+ search_knowledge 工具，回答带来源引用
- 前端：工具名友好映射（📚 检索知识库）+ 429/422 错误提示
- 公网验证：问"微积分讲了什么？"→ 检索增强回答 ✅

---

## 目录结构

```
D:\blog_project\
├── backend\                  # FastAPI 后端
│   ├── app\
│   │   ├── main.py           # 入口：应用实例 + CORS + 路由挂载（第1个读）
│   │   ├── config.py         # 配置：数据库地址/JWT密钥（第2个读）
│   │   ├── db.py             # 数据库引擎 + 会话（第3个读）
│   │   ├── models.py         # 5张表 ORM 模型（第4个读）
│   │   ├── schemas.py        # Pydantic 输入输出契约（第5个读）
│   │   ├── auth.py           # 密码哈希 + JWT + 登录接口（第6个读）
│   │   ├── routers\          # articles/moments/friends/projects/assistants
│   │   ├── services\rag.py     # RAG：切块/TF-IDF 索引/检索
│   │   ├── jobs\friend_monitor.py  # 友链监控（APScheduler）
│   │   └── utils\              # llm.py（DeepSeek 公共调用）/ ratelimit.py（限流）
│   ├── init_db.py            # 建表 + 创建管理员
│   ├── test_moments.py       # 一键验收脚本
│   ├── test_friends_projects.py
│   ├── requirements.txt      # 含 pymysql（生产 MySQL 驱动）
│   └── blog.db               # 本地 SQLite（生产用服务器 MySQL）
├── frontend\                 # Vue3 前端
│   ├── src\
│   │   ├── main.js / App.vue / style.css
│   │   ├── router\index.js   # 路由表（含守卫）
│   │   ├── api\request.js    # axios 封装（拦截器带 token）
│   │   └── views\            # Home/Articles/ArticleDetail/Moments/Friends/
│   │                         # Projects/Login/Admin/AiPartner（+ 待加 Assistant）
│   ├── vite.config.js        # /api 代理 → 8000
│   ├── nginx.conf            # 生产 nginx 配置（SPA 回退 + 反代）
│   └── package.json
├── deploy\                   # 部署包（已在服务器 /opt/blog 运行）
│   ├── docker-compose.yml    # 三服务编排（80 端口）
│   ├── backend\Dockerfile
│   ├── frontend\Dockerfile
│   ├── .env.example
│   ├── install.sh            # 服务器一键安装脚本
│   └── deploy.py             # paramiko 一键部署脚本
└── docs\                     # 需求文档 / 学习记录 / 教程（见文末索引）
```

---

## 本地跑起来

### 后端（8000）
```powershell
cd D:\blog_project\backend
.\.venv\Scripts\python init_db.py        # 建表+管理员（跑过可跳过）
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```
> 本地 SQLite；生产用 MySQL（服务器 .env 里 DATABASE_URL 指向容器内 mysql）

### 前端（5173）
```powershell
cd D:\blog_project\frontend
npm run dev
```
> 浏览器访问 **http://localhost:5173**（Vite 绑定 localhost/IPv6，勿用 127.0.0.1）

### 关闭服务
- 后端/前端都是独立终端跑的：找到窗口 Ctrl+C，或 `netstat -ano | findstr :8000/:5173` 查 PID 后 taskkill

---

## 部署与运维（线上 ***REMOVED-ROTATED***）

| 项 | 说明 |
|---|---|
| 架构 | Docker Compose：blog-mysql + blog-backend + blog-frontend（/opt/blog/deploy） |
| 对外端口 | **80**（AI 伴侣已退役腾出） |
| 访问 | http://***REMOVED-ROTATED*** |
| 登录 | admin（密码已改，非默认值，见部署记录） |
| AI 伴侣 | 已退役（systemctl 停用，数据保留 /var/lib/mysql），小站 /ai-partner 为展示页 |
| 服务器内存 | 2G 偏紧，已加 2G swap；AI 伴侣退役后 available ~660MB |

**重新部署**（改代码后）：
```bash
cd /opt/blog/deploy
docker compose up -d --build    # 增量构建很快
docker compose ps
```

**看日志 / 数据备份**：
```bash
docker compose logs -f backend
docker exec blog-mysql mysqldump -uroot -p<密码> blog > backup_$(date +%Y%m%d).sql
```

---

## 接口一览（当前 17 个）

| 方法 | 路径 | 说明 | 需登录 |
|---|---|---|---|
| GET | /api/health | 健康检查（/health 同义） | 否 |
| POST | /api/auth/login | 登录，拿 JWT | 否 |
| GET | /api/auth/me | 当前用户 | 是 |
| GET | /api/articles | 文章列表（分页 + **keyword 搜索**） | 否 |
| GET | /api/articles/{id} | 文章详情（浏览量+1） | 否 |
| POST | /api/articles | 发布文章 | 是 |
| PUT | /api/articles/{id} | 编辑文章 | 是 |
| DELETE | /api/articles/{id} | 删除文章 | 是 |
| GET | /api/moments | 说说列表（分页） | 否 |
| POST | /api/moments | 发布说说（**可带 images**） | 是 |
| DELETE | /api/moments/{id} | 删除说说 | 是 |
| GET | /api/friends | 友链列表 | 否 |
| POST | /api/friends | 新增友链 | 是 |
| DELETE | /api/friends/{id} | 删除友链 | 是 |
| GET | /api/projects | 项目列表 | 否 |
| POST | /api/projects | 新增项目 | 是 |
| DELETE | /api/projects/{id} | 删除项目 | 是 |
| POST | /api/assistants/chat | **AI 助手（SSE 流式 + ReAct + 会话记忆）** | 否 |

## 数据库设计（5 张表）

users（用户） / articles（文章） / moments（说说） / friends（友链） / projects（项目）

> 表结构见 `app/models.py`；friends 的 is_active/last_check 预留给友链监控 Agent

---

## 文档索引（docs/）

| 文档 | 用途 |
|---|---|
| 小站复刻方案与学习路线.md | 总方案（4 周计划） |
| moments需求文档.md / moments参考答案与思路讲解.md | 说说功能需求 + 参考答案 |
| moments代码Review与Swagger测试教程.md | Review 复盘 + Swagger 教程 |
| friends和projects需求文档.md / friends和projects修复指南.md | 友链/项目需求 + 修复 |
| 前端学习路径.md | Week 2 Vue3/axios 学习计划 |
| Network网络诊断教程.md | F12 排错（看接口返回/字段契约） |
| 第二阶段知识点汇总-管理后台.md | axios/登录/token/守卫 知识点 |
| 前端学习记录.md / 后端学习记录.md | 前后端学习复盘（时间线/踩坑/面试速记） |
| 第三阶段学习记录-管理后台CRUD.md | 表单 CRUD + 与 Agent 工具的关系 |
| **网站部署从零到上线-小白教程.md** | 部署实战复盘（5 个坑 + 术语表） |
| **AI助手开发教程.md** | Week 3 核心：ReAct + DeepSeek + SSE + 4 步任务书 |
| **AI助手开发踩坑记录.md** | AI 助手任务一~三踩坑：role/tool_calls/SSE 格式 + 面试话术 |
| **第五阶段学习记录-生产防护.md** | 友链监控 + 限流 + chat_completion 排查复盘 |
| **第六阶段学习记录-RAG知识库.md** | RAG 五步流程 + TF-IDF 实现 + 工具合并决策 |
| **第四阶段学习记录-AI助手.md** | AI 助手阶段复盘：架构/知识点/坑/面试速记/部署记录 |

---

## 待办（Week 3-4）

- [x] **AI 助手**：SSE + DeepSeek + ReAct + 工具 + 会话记忆，公网 http://***REMOVED-ROTATED***/ai-assistant
- [x] **文章 AI 摘要**：发布时自动生成（LLM 嵌入业务管道）
- [x] **友链监控 Agent**：APScheduler 定时巡检（HEAD 探测 + 失效标记）
- [x] **限流防护**：IP 限流 + 会话轮数 + 消息长度 + event_stream 兜底
- [x] **RAG 知识库"问博主"**：切块 + TF-IDF 检索 + 增强回答
- [ ] AI 助手增强：摘要压缩（>20 条自动压缩，防 token 爆炸）
- [ ] RAG 升级：embedding 模型 + 向量库（替换 TF-IDF）
- [ ] 回答引用链接化（点击跳到原文）
- [ ] 管理后台"修改密码"功能（正规做法，替代手动改库）
- [ ] README 顶部项目徽章/截图美化（求职包装阶段）
