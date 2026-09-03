# 「说说」（Moments）功能需求文档

> 项目：小站（Starhiro 复刻版） ｜ 版本：v1.0 ｜ 状态：待开发（练手任务）
> 对应表：`app/models.py` 中 `Moment` 表（**表已建好，无需改 models.py**）
> 参照模板：`app/routers/articles.py`（接口套路完全一致）

---

## 1. 功能概述

「说说」是个人博客里的一类**轻量动态**：一句心情/近况/碎碎念 + 可选配图，像 QQ 空间说说、微博。原站（Starhiro 小站）在导航栏有「说说」入口，首页也有说说动态流。

本需求 = **后端的 3 个接口**，前端展示是 Week 2 的事，但 JSON 契约（字段/结构）现在定死，前端照此开发。

**一句话需求：游客能看说说时间线；登录用户能发布/删除自己的说说；说说按时间倒序排列。**

---

## 2. 本期范围

### ✅ 做
| 编号 | 功能 | 说明 |
|---|---|---|
| M-01 | 说说列表 | 分页、时间倒序、含 total（前端翻页用） |
| M-02 | 发布说说 | 需登录；内容必填，1~500 字；可带多张图片 |
| M-03 | 删除说说 | 需登录；删除不存在的返回 404 |

### ❌ 不做（明确砍掉，防过度设计）
- 点赞 / 评论 / 转发（需要新表，以后做）
- 编辑说说（微信/微博都没这功能，砍）
- 图片上传（图片 URL 前端给，后端只存字符串）
- 敏感词过滤、@ 提及、话题标签

---

## 3. 数据模型（已建好，开发时只读）

表名：`moments`（对应 ORM 类 `Moment`）

| 字段 | 类型 | 约束 | 含义 |
|---|---|---|---|
| id | INTEGER | 主键自增 | 说说 ID |
| content | TEXT | 非空 | 说说正文，1~500 字 |
| images | VARCHAR(500) | 默认 "" | 图片 URL，**多个用英文逗号分隔**，最多 9 张 |
| created_at | DATETIME | 默认当前时间 | 发布时间（排序依据） |

**约定**：
- `images` 为空字符串 = 纯文字说说；`"url1,url2,url3"` = 3 张图（逗号分隔）
- 前端展示时把 `images` 按逗号 `split` 成数组
- 没有 `updated_at` —— 说说不可编辑，所以不需要修改时间

---

## 4. 接口规格（核心）

### 4.1 说说列表

```
GET /api/moments?page=1&page_size=10
```

| 项 | 说明 |
|---|---|
| 鉴权 | ❌ 不需要，游客可见 |
| 查询参数 | `page` 页码（默认 1）、`page_size` 每页条数（默认 10） |
| 排序 | `created_at` **倒序**（新的在前） |
| 响应 200 | `{"total": 总条数, "page": 当前页, "page_size": 每页条数, "items": [MomentOut...]}` |
| MomentOut | `{"id": 1, "content": "今天改了一个bug", "images": "", "created_at": "2026-08-24T19:37:03"}` |

> 与 `GET /api/articles` 完全同构，直接复制套路。

### 4.2 发布说说

```
POST /api/moments
Authorization: Bearer <token>
Body: {"content": "今天改了一个bug", "images": "https://xxx.com/a.jpg,https://xxx.com/b.jpg"}
```

| 项 | 说明 |
|---|---|
| 鉴权 | ✅ 必须登录，否则 **401** |
| content | 必填，**1~500 字**；为空或超长 → **422**（Pydantic 校验失败是 FastAPI 标准响应码） |
| images | 可选，默认 `""`；逗号分隔的图片 URL 字符串 |
| 响应 201 | 创建成功的完整 MomentOut（含 id、created_at） |

**注意**：`content` 的校验写在 `app/schemas.py` 的 `MomentCreate` 里（用 `min_length=1, max_length=500`），不用自己写 if 判断——这就是 Pydantic 的意义。

### 4.3 删除说说

```
DELETE /api/moments/{id}
Authorization: Bearer <token>
```

| 项 | 说明 |
|---|---|
| 鉴权 | ✅ 必须登录，否则 **401** |
| id 不存在 | **404**，提示 `说说不存在` |
| 响应 204 | 删除成功，无返回体（和 articles 删除一致） |

---

## 5. 业务规则汇总（写代码时对照）

1. **排序**：列表永远按 `created_at DESC`，新说的在上面
2. **分页**：`offset((page-1)*page_size).limit(page_size)`，并先 `count()` 总数
3. **校验**：content 1~500 字（Pydantic 管）；images 长度超 VARCHAR(500) 由数据库兜底，前端约定最多 9 张
4. **404 语义**：删除/操作不存在的 id 一律 404，不要静默成功
5. **401 语义**：所有写操作（POST/DELETE）都挂 `Depends(get_current_user)`
6. **返回结构**：列表返回 `{total, page, page_size, items}`；单条操作返回对象本身
7. **时区**：created_at 由数据库 `server_default=func.now()` 生成，不需要代码里手动填

---

## 6. 需要改动的文件（共 3 个）

| 文件 | 改动 | 说明 |
|---|---|---|
| `app/schemas.py` | 加 `MomentCreate`、`MomentOut` | 输入输出契约 |
| `app/routers/moments.py` | **新建**，写 3 个接口 | 照抄 articles.py 套路 |
| `app/main.py` | 导入并挂载 `moments.router` | 最后一步，别忘了 |

不需要动：`models.py`（表已建好）、`init_db.py`。

**开发顺序**：schemas.py → moments.py → main.py → curl 验证（第 7 节）。

---

## 7. 验收标准（写完必须全过）

> 先启动服务：`cd D:\blog_project\backend && .\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`
> PowerShell 里 JSON body 用 `--data-binary @文件` 方式（直接 -d 内嵌 JSON 会炸，见项目经验）。

### 7.1 手动 curl 用例

```powershell
cd D:\blog_project\backend
$base = "http://127.0.0.1:8000"

# ① 空列表
curl.exe -s "$base/api/moments?page=1&page_size=5"
#   期望: {"total":0,"page":1,"page_size":5,"items":[]}

# ② 未登录发布 -> 401
curl.exe -s -X POST $base/api/moments -H "Content-Type: application/json" -d "{}"
#   期望: 401

# ③ 登录拿 token
$login = curl.exe -s -X POST $base/api/auth/login -H "Content-Type: application/json" --data-binary "@$env:TEMP\login.json"
$token = ($login | ConvertFrom-Json).access_token
```

发布/删除的 JSON body 用 Python 写文件再发（避免 PowerShell 转义坑）：

```powershell
python3 -c "import json; json.dump({'content':'今天改了一个bug'}, open(r'$env:TEMP\m1.json','w',encoding='utf-8'), ensure_ascii=False)"

# ④ 发布 -> 201
curl.exe -s -X POST $base/api/moments -H "Content-Type: application/json" -H "Authorization: Bearer $token" --data-binary "@$env:TEMP\m1.json"

# ⑤ 空 content -> 422
python3 -c "import json; json.dump({'content':''}, open(r'$env:TEMP\m2.json','w',encoding='utf-8'), ensure_ascii=False)"
curl.exe -s -X POST $base/api/moments -H "Content-Type: application/json" -H "Authorization: Bearer $token" --data-binary "@$env:TEMP\m2.json"
#   期望: 422（Pydantic 校验失败的标准响应码）

# ⑥ 再发一条带图的 -> 201
python3 -c "import json; json.dump({'content':'第二条，配图','images':'https://example.com/a.jpg,https://example.com/b.jpg'}, open(r'$env:TEMP\m3.json','w',encoding='utf-8'), ensure_ascii=False)"
curl.exe -s -X POST $base/api/moments -H "Content-Type: application/json" -H "Authorization: Bearer $token" --data-binary "@$env:TEMP\m3.json"

# ⑦ 列表 -> total=2，且"第二条"在前（时间倒序验证）
curl.exe -s "$base/api/moments?page=1&page_size=5"

# ⑧ 删除 -> 204（id 换成实际值）
curl.exe -s -o NUL -w "%{http_code}" -X DELETE $base/api/moments/1 -H "Authorization: Bearer $token"
#   期望: 204

# ⑨ 删除不存在的 -> 404
curl.exe -s -o NUL -w "%{http_code}" -X DELETE $base/api/moments/999 -H "Authorization: Bearer $token"
#   期望: 404
```

### 7.2 判定清单（逐条打勾）

- [ ] ① 空列表返回 total=0，结构正确
- [ ] ② 未登录 POST → 401
- [ ] ③ 登录成功拿到 token
- [ ] ④ 发布成功 → 201，返回带 id 和 created_at
- [ ] ⑤ 空 content → 422
- [ ] ⑥ 带 images 发布成功
- [ ] ⑦ 列表 total=2 且时间倒序（新发的在前面）
- [ ] ⑧ 删除 → 204
- [ ] ⑨ 删不存在的 → 404

---

## 8. 扩展预留（第 3~4 周才做，现在不用管）

- **说说情绪/标签**：发布时调用 LLM 自动给说说打情绪标签（快乐/吐槽/日常...）→ 需求是在 `moments` 表加一列 `mood`，接口加个字段
- **暗号解锁**：原站"输入暗号探索更多"→ 某些说说标记 `hidden=true`，输入正确暗号才显示 → 接口加 `?secret=xxx` 参数
- **说说时间线聚合**：首页只显示最近 N 条，全部在说说页

> 这些决定了 `Moment` 表设计要"留有余地"，但**本期绝不实现**——先把 3 个接口写干净。

---

## 9. 开发者提示（怎么下手）

1. 打开 `app/routers/articles.py` 全文读一遍，它就是标准答案模板
2. `schemas.py` 里照 `ArticleCreate/ArticleOut` 的样子写 `MomentCreate/MomentOut`（字段少一半，更简单）
3. `moments.py` 里：列表接口复制 `list_articles`（改表名/字段）；发布复制 `create_article`；删除复制 `delete_article`
4. `main.py` 里加两行：`from .routers import articles, moments` 和 `app.include_router(moments.router)`
5. 跑第 7 节验收，9 条全过 = 完成

**预计工作量：30~45 分钟。写不出来/卡住 20 分钟以上 → 截图问我，别硬耗。**
