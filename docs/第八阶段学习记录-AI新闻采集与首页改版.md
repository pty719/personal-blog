# 第八阶段学习记录：AI 新闻采集 Agent + 首页改版

> 项目：小站 ｜ 周期：Week 4-5 ｜ 状态：✅ 完成并上线
> 公网演示：http://***REMOVED-ROTATED***/ai-news（AI 新闻自动采集，每 6 小时更新）

---

## 1. 阶段总览

| 任务 | 内容 | 状态 |
|---|---|---|
| 首页改版 | Week 2 欢迎页 → 门户页（博主介绍 + AI 助手入口 + 最新文章/说说/新闻） | ✅ |
| 菜单精简 | 去掉「AI 伴侣」「AI 助手」菜单项（路由保留），加「AI 新闻」 | ✅ |
| AI 新闻采集 | RSS 爬取 → 入库 → 接口 → 定时任务（每 6 小时） | ✅ 公网验证 |
| 演讲汇报 | 班级演讲 5 分钟稿 + 3 分钟精简版 + 提问预判 | ✅（docs/班级演讲汇报稿） |

**能力变化**：网站从"博主输出内容"变成"**自动采集内容 + AI 解读**"——第一个纯"信息采集 Agent"上线。

---

## 2. AI 新闻采集：完整技术复盘（本阶段核心）

### 2.1 源选择：RSSHub 不可用 → 实测换源

```
计划：RSSHub 聚合（rsshub.app）
实测：rsshub.app 全挂（000 被墙）、rssforever 503（限流）
换源实测：hnrss.org/newest?q=AI ✅（200，Hacker News 关键词过滤）
         36kr.com/feed ✅（中文）、ifanr.com/feed ✅（中文）
选定：hnrss q=AI（全球 AI 新闻最密集），架构支持多源（source 字段）
```

**决策方法（面试点）**：不猜，**curl 实测每个候选源**（状态码 + 大小），用数据选源。

### 2.2 爬取管线（4 个环节）

```python
# ① 下载 + 解析（feedparser 一步到位）
feed = feedparser.parse("https://hnrss.org/newest?q=AI")

# ② 去重（双保险）
exists = db.query(AiNews).filter(AiNews.url == url).first()   # 代码层
url = Column(String(200), unique=True)                        # 数据库层 unique

# ③ clean_html（RSS summary 是 HTML！）
text = re.sub(r"<[^>]+>", "", text)   # 去 <...> 标签
text = re.sub(r"\s+", " ", text)      # 多空白合并

# ④ 时间解析（RSS 日期格式五花八门）
from email.utils import parsedate_to_datetime
def _parse_time(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)   # "Tue, 03 Sep 2026..." → datetime
    except Exception:
        return None                        # 单条失败不炸整个循环（防御性）
```

### 2.3 接口：response_model 序列化大坑（本阶段最值钱）

**症状**：`/api/ai-news` 返回 500
**日志**：`PydanticSerializationError: Unable to serialize unknown type: AiNews`

**根因**（FastAPI 序列化两种路径）：
| 写法 | 序列化方式 | ORM 对象 |
|---|---|---|
| 无 response_model | jsonable_encoder（宽松） | ✅ 能编码 |
| `response_model=dict` | **pydantic 严格校验** | ❌ 拒绝未知类型 |

**修复（规范）**：建 `AiNewsOut` schema（`from_attributes=True`）+ `response_model=dict[str, list[AiNewsOut]]`

**记忆点**：返回 ORM 对象的接口——**要么建 from_attributes schema，要么别写 response_model**。

### 2.4 定时：interval vs cron

```python
scheduler.add_job(check_all_friends, 'cron', hour=8, minute=0)   # 定点（每天 8:00）
scheduler.add_job(fetch_ai_news, 'interval', hours=6)            # 间隔（每 6 小时）
```

**区别**：cron = 日历式定点触发；interval = 相对间隔触发（应用启动后每 N 单位）。

---

## 3. 本阶段踩坑清单（全部实测）

| # | 坑 | 症状 | 解决 |
|---|---|---|---|
| 1 | RSSHub 公共实例被墙/限流 | 000/503 | curl 实测换源（hnrss/36kr） |
| 2 | 模型 DateTime 列塞字符串 | StatementError | `parsedate_to_datetime` 转换（email.utils 标准库） |
| 3 | response_model=dict 序列化 ORM | 500 PydanticSerializationError | from_attributes schema 或去掉 response_model |
| 4 | prefix 下划线 vs 连字符 | 前端 404 | `/api/ai-news`（连字符）与前端一致 |
| 5 | import 缺 `..`（第 N 次） | ModuleNotFoundError | `from ..db/..models/..schemas` |
| 6 | 排序字段不存在 | AttributeError | AiNews 无 created_at → 按 published_at 排序 |
| 7 | 新依赖忘加 requirements | 容器 ModuleNotFoundError | feedparser 进 requirements（httpx 教训 N 次重现） |
| 8 | 容器重建后 backend 断连 | API 500 | docker compose restart backend |

---

## 4. 首页改版设计（门户页）

```
博主介绍（hero）→ 和 AI 助手聊聊 按钮
→ 最新文章（前 3 篇，调 /api/articles）
→ 最新说说（前 3 条，调 /api/moments）
→ AI 新闻速递（前 3 条，调 /api/ai-news）
接口容错：每个区块独立 try/catch，一个挂了不影响其他
```

**菜单决策**：AI 伴侣/助手从菜单去掉（**入口移到首页大卡片**——功能不丢，界面更干净）；AI 新闻加菜单。

---

## 5. 面试速记（30 秒讲 AI 新闻 Agent）

> "我做了个信息采集 Agent：RSSHub 公共实例不可用，我 curl 实测多个源，选了 Hacker News 的 AI 关键词源。爬取管线：feedparser 解析 → url 去重（代码层 + 数据库 unique 双保险）→ clean_html 去标签 → 时间解析防御（单条失败不炸循环）。APScheduler 每 6 小时自动抓取入库，前端展示。踩过 FastAPI 序列化的坑：response_model 是 pydantic 严格校验，返回 ORM 对象要建 from_attributes schema。"

**加分点**：
- 换源决策用数据说话（实测状态码）
- 防御性编程（时间解析 try/except、单条失败不影响整体）
- 双保险思维（代码层 + 数据库层去重）
- 触发方式选择（cron vs interval 场景差异）

---

## 6. 后续增强（待办）

- [ ] 多源扩展（36kr/爱范儿中文源，source 字段已支持）
- [ ] AI 新闻摘要/分类（LLM 二次加工——把采集 Agent 升级成"采集 + 解读"）
- [ ] 每日预算上线（成本封顶：全站每天 N 次对话）
- [ ] 首页继续迭代（访客视角优化）
