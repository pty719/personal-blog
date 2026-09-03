# 「友链」friends + 「项目」projects 需求文档

> 项目：小站（Starhiro 复刻版） ｜ 版本：v1.0 ｜ 状态：待开发（Week 1 收尾练手）
> 对应表：`app/models.py` 中 `Friend` / `Project` 表（**表已建好，无需改 models.py**）
> 参照模板：`app/routers/moments.py`（你刚写完的，套路完全一样）

---

## 1. 功能概述

- **友链（friends）**：博客圈的"互挂链接"——每个朋友一个卡片：名字、网址、头像、一句话介绍。对应原站导航栏「友链」栏目。第 3 周「友链监控 Agent」会定时检查每个友链网站是否存活，结果写回 `is_active` / `last_check` 字段。
- **项目（projects）**：作品展示卡片——对应原站「项目」栏目，展示你的 GitHub 项目：名字、简介、演示地址、仓库地址、star 数、技术栈标签。

**一句话需求**：两个功能都是「列表 + 新增 + 删除」，和 moments 完全同构——**你现在已经会写了，这次是巩固练习**。

---

## 2. 本期范围

### ✅ 做
| 编号 | 功能 | 说明 |
|---|---|---|
| F/P-01 | 列表 | 游客可看，无需登录 |
| F/P-02 | 新增 | 需登录，必填字段校验 |
| F/P-03 | 删除 | 需登录，删不存在的 404 |

### ❌ 不做（本期明确砍掉）
- 编辑（PUT）——友链/项目的修改功能 Week 3 由 Agent/后台补
- 友链存活检测（is_active 的真实巡检）——第 3 周友链监控 Agent 做
- 项目 star 自动同步 GitHub API——以后做
- 分页？——**友链/项目量少，本期列表不分页**（返回数组即可，练一次"无分页列表"）

---

## 3. 数据模型（已建好，开发时只读）

### Friend 表（友链）

| 字段 | 类型 | 约束 | 含义 |
|---|---|---|---|
| id | INTEGER | 主键自增 | 友链 ID |
| name | VARCHAR(50) | **非空** | 友链名（必填，1~50 字） |
| url | VARCHAR(200) | **非空** | 友链网址（必填，1~200 字） |
| avatar | VARCHAR(200) | 默认 "" | 头像 URL |
| description | VARCHAR(200) | 默认 "" | 一句话介绍 |
| is_active | BOOLEAN | 默认 True | 存活标记（第 3 周 Agent 更新） |
| last_check | DATETIME | 可空 | 上次检测时间（Agent 更新） |
| created_at | DATETIME | 默认当前时间 | 添加时间 |

### Project 表（项目）

| 字段 | 类型 | 约束 | 含义 |
|---|---|---|---|
| id | INTEGER | 主键自增 | 项目 ID |
| name | VARCHAR(100) | **非空** | 项目名（必填，1~100 字） |
| description | VARCHAR(500) | 默认 "" | 简介 |
| url | VARCHAR(200) | 默认 "" | 演示地址 |
| repo | VARCHAR(200) | 默认 "" | GitHub 仓库地址 |
| stars | INTEGER | 默认 0，**>=0** | star 数（负数没意义） |
| tech_tags | VARCHAR(200) | 默认 "" | 技术栈标签，逗号分隔 |
| created_at | DATETIME | 默认当前时间 | 添加时间 |

---

## 4. 接口规格

### 4.1 友链列表（不分页，返回数组）

```
GET /api/friends
```
- 鉴权：❌ 不需要
- 排序：`is_active` 倒序（活着的在前）+ `created_at` 倒序 + `id` 倒序
- 响应 200：`[FriendOut, FriendOut, ...]`（**数组，不是 {total, items}**——练一次无分页）

### 4.2 新增友链

```
POST /api/friends
Authorization: Bearer <token>
Body: {"name": "小明", "url": "https://xiaoming.blog", "avatar": "", "description": "前端大佬"}
```
- 鉴权：✅ 必须登录，否则 401
- `name` 必填 1~50 字；`url` 必填 1~200 字；空/超长 → **422**
- `avatar` / `description` 可选，默认 ""
- 响应 201：创建成功的 FriendOut

### 4.3 删除友链

```
DELETE /api/friends/{friend_id}
Authorization: Bearer <token>
```
- 鉴权：✅ 必须登录
- 不存在 → 404，提示 `友链不存在`；成功 → 204

### 4.4 项目列表

```
GET /api/projects
```
- 鉴权：❌ 不需要
- 排序：`stars` 倒序（star 多的在前，展示效果好）+ `id` 倒序
- 响应 200：`[ProjectOut, ...]`

### 4.5 新增项目

```
POST /api/projects
Authorization: Bearer <token>
Body: {"name": "小站", "description": "全栈博客", "url": "http://my.site", "repo": "https://github.com/me/blog", "stars": 12, "tech_tags": "fastapi,vue3"}
```
- 鉴权：✅ 必须登录
- `name` 必填 1~100 字；`stars` 是 int 且 **>= 0**（负数 → 422，用 `Field(ge=0)`）
- 其余可选，默认 ""
- 响应 201

### 4.6 删除项目

```
DELETE /api/projects/{project_id}
Authorization: Bearer <token>
```
- 不存在 → 404，提示 `项目不存在`；成功 → 204

---

## 5. 业务规则汇总

1. **无分页**：friends/projects 列表返回**纯数组**，接口的 `response_model=list[FriendOut]`（或 `list[ProjectOut]`）
2. **排序**：friends = `is_active desc, created_at desc, id desc`；projects = `stars desc, id desc`
3. **校验**：必填字段用 `Field(min_length=1, max_length=50)` 等；`stars` 用 `Field(default=0, ge=0)`
4. **404/401 语义**：和 moments 完全一样
5. **响应模型**：FriendOut 包含 `id, name, url, avatar, description, is_active, last_check, created_at`；ProjectOut 包含 `id, name, description, url, repo, stars, tech_tags, created_at`

---

## 6. 需要改动的文件（共 4 个）

| 文件 | 改动 |
|---|---|
| `app/schemas.py` | 追加 `FriendCreate` / `FriendOut` / `ProjectCreate` / `ProjectOut` |
| `app/routers/friends.py` | **新建**，3 个接口 |
| `app/routers/projects.py` | **新建**，3 个接口 |
| `app/main.py` | 导入并挂载两个 router |

**开发顺序**：schemas.py → friends.py → projects.py → main.py → 跑验收脚本。

---

## 7. 验收（一键脚本，复制保存直接跑）

把下面的代码保存为 `D:\blog_project\backend\test_friends_projects.py`，然后在 PyCharm 底部 Terminal 运行：

```powershell
cd D:/blog_project/backend
./.venv/Scripts/python test_friends_projects.py
```

```python
# -*- coding: utf-8 -*-
"""friends + projects 一键验收脚本：自动登录、测 18 条用例、自动清理。
保存到 backend/ 目录后运行： ./.venv/Scripts/python test_friends_projects.py
"""
import sys
import httpx

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0


def report(name: str, ok: bool, extra: str = ""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        print(f"[FAIL] {name}   {extra}")


def main():
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        assert r.json().get("status") == "ok"
    except Exception as e:
        print("[服务未启动] 先运行: ./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000")
        print(f"  检测: {e}")
        sys.exit(1)

    r = httpx.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"})
    report("登录 -> 200", r.status_code == 200, f"实际 {r.status_code}")
    if r.status_code != 200:
        sys.exit(1)
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}

    # ---------- friends ----------
    r = httpx.get(f"{BASE}/api/friends")
    report("F1 GET /api/friends -> 200 且返回数组",
           r.status_code == 200 and isinstance(r.json(), list), f"实际 {r.status_code}")
    report("F2 未登录新增 -> 401",
           httpx.post(f"{BASE}/api/friends", json={"name": "x", "url": "https://x.com"}).status_code == 401, "")

    r = httpx.post(f"{BASE}/api/friends", headers=H,
                   json={"name": "小明", "url": "https://xiaoming.blog", "description": "前端大佬"})
    report("F3 登录后新增 -> 201", r.status_code == 201, f"实际 {r.status_code} {r.text[:80]}")
    fid = r.json().get("id") if r.status_code == 201 else None
    report("F4 name 为空 -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "", "url": "https://x.com"}).status_code == 422, "")
    report("F5 url 为空 -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "x", "url": ""}).status_code == 422, "")
    report("F6 name 超长(51字) -> 422",
           httpx.post(f"{BASE}/api/friends", headers=H, json={"name": "长" * 51, "url": "https://x.com"}).status_code == 422, "")

    if fid:
        report("F7 删除 -> 204",
               httpx.delete(f"{BASE}/api/friends/{fid}", headers=H).status_code == 204, "")
        report("F8 删不存在 -> 404",
               httpx.delete(f"{BASE}/api/friends/{fid}", headers=H).status_code == 404, "")
        report("F9 未登录删除 -> 401",
               httpx.delete(f"{BASE}/api/friends/{fid}").status_code == 401, "")

    # ---------- projects ----------
    r = httpx.get(f"{BASE}/api/projects")
    report("P1 GET /api/projects -> 200 且返回数组",
           r.status_code == 200 and isinstance(r.json(), list), f"实际 {r.status_code}")
    report("P2 未登录新增 -> 401",
           httpx.post(f"{BASE}/api/projects", json={"name": "x"}).status_code == 401, "")

    r = httpx.post(f"{BASE}/api/projects", headers=H,
                   json={"name": "小站", "description": "全栈博客", "repo": "https://github.com/me/blog",
                         "stars": 12, "tech_tags": "fastapi,vue3"})
    report("P3 登录后新增 -> 201", r.status_code == 201, f"实际 {r.status_code} {r.text[:80]}")
    pid = r.json().get("id") if r.status_code == 201 else None
    report("P4 name 为空 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": ""}).status_code == 422, "")
    report("P5 stars 为负数 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": "x", "stars": -1}).status_code == 422, "")
    report("P6 stars 非数字 -> 422",
           httpx.post(f"{BASE}/api/projects", headers=H, json={"name": "x", "stars": "abc"}).status_code == 422, "")

    if pid:
        report("P7 删除 -> 204",
               httpx.delete(f"{BASE}/api/projects/{pid}", headers=H).status_code == 204, "")
        report("P8 删不存在 -> 404",
               httpx.delete(f"{BASE}/api/projects/{pid}", headers=H).status_code == 404, "")
        report("P9 未登录删除 -> 401",
               httpx.delete(f"{BASE}/api/projects/{pid}").status_code == 401, "")

    print(f"\n结果: {PASS} 通过 / {FAIL} 失败 / 共 {PASS + FAIL} 项")
    if FAIL == 0:
        print("🎉 全部通过！friends + projects 开发完成，Week 1 后端全部收工")
    else:
        print("有失败项 → 把 [FAIL] 行截图发给助手")


if __name__ == "__main__":
    main()
```

**18 条用例**：friends 9 条（F1~F9）+ projects 9 条（P1~P9），全过 = 完成。

---

## 8. 扩展预留（第 3~4 周才做）

- **友链监控 Agent**：定时 `GET` 每个友链的 url → 能访问则 `is_active=True`，否则 False → 更新 `last_check`。所以 `is_active`/`last_check` 字段本期只建不用
- **项目 star 同步**：调 GitHub API 拉 repo 的 star 数更新 `stars` 字段
- 这两个都是"Agent 数据落点"，设计字段时已经留好了

---

## 9. 开发者提示

1. 打开你写好的 `app/routers/moments.py` 当模板，先复制一份改名为 friends.py 再改——比从零写快 3 倍
2. 唯一的新知识点：**列表不分页**——接口签名里没有 `page`/`page_size`，返回 `[FriendOut.model_validate(f) for f in items]` 纯数组
3. `schemas.py` 里 `last_check: datetime | None` 记得允许空（`Optional[datetime]`）
4. 写完后先跑验收脚本再找我 review

**预计工作量：40~60 分钟。卡住 20 分钟以上 → 截图问我。**
