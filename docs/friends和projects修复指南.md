# friends + projects 验收失败修复指南

> 验收结果：6 通过 / 7 失败（F3、P1~P6）
> 修复方案已隔离验证：**19/19 全过**（含 1 个隐藏 bug 预防）
> 本指南只告诉你**怎么改**，不动你的代码。改完重跑 `test_friends_projects.py` 应全绿。

---

## 0. 一句话总结：3 个根因

| # | 根因 | 影响的用例 | 严重度 |
|---|---|---|---|
| A | `FriendCreate` 把服务器字段声明成了必填 | F3 (422) | 🔴 必须改 |
| B | projects 接口写在 friends.py 里，且 main.py 没挂载 projects | P1~P6 (404) | 🔴 必须改 |
| C | friends.py 里 projects 部分是复制粘贴残留（函数名/查表/返回类型全错） | 隐藏炸弹 | 🔴 必须改 |

---

## 1. 问题 A：FriendCreate 必填字段太多（F3 422）

### 现象
```
[FAIL] F3 登录后新增 -> 201   实际 422 {"detail":[{"type":"missing","loc":["body","is_active"],"msg":"Field required"...
```

### 原因
你的 `schemas.py` 里 `FriendCreate` 写成了：

```python
class FriendCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    url: str = Field(min_length=1, max_length=200)
    avatar: str = ""
    description: str = ""
    is_active: bool          # ❌ 这三个是"服务器管理字段"
    last_check: datetime     # ❌ 不是客户端该传的！
    created_at: datetime     # ❌
```

客户端只提交 `{"name": ..., "url": ...}`，没有 `is_active` → Pydantic 认为缺必填字段 → 422。

### 核心概念（面试点）：Create schema 和 Out schema 的分工

```
FriendCreate = 客户端"能传什么"   → 只有 name/url/avatar/description
FriendOut    = 服务器"返回什么"   → 全部字段（含服务器生成的 id/is_active/created_at）
```

- **Create schema 里只放客户端有资格传的字段**。`is_active`（谁决定的？服务器默认 True）、`last_check`（第 3 周 Agent 才写）、`created_at`（数据库自动生成）都是服务器的事，客户端传了也不该信。
- 这也是安全设计：**客户端传什么，你就只收什么**。如果 Create 里有 `is_active`，黑客就能传 `{"is_active": false}` 把自己的友链标成不活跃——虽然现在无伤大雅，但这是"字段信任边界"的坏习惯。

### 怎么改（schemas.py）

`FriendCreate` 改成：

```python
class FriendCreate(BaseModel):
    """新增友链时客户端提交的字段（只有这 4 个）"""
    name: str = Field(min_length=1, max_length=50)
    url: str = Field(min_length=1, max_length=200)
    avatar: str = ""
    description: str = ""
```

`ProjectCreate` 同理，删掉 `created_at`：

```python
class ProjectCreate(BaseModel):
    """新增项目时客户端提交的字段"""
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    url: str = ""
    repo: str = ""
    stars: int = Field(default=0, ge=0)
    tech_tags: str = ""
```

---

## 2. 问题 B + C：projects 没挂载 + 揉在一个文件里（P1~P6 全部 404）

### 现象
```
[FAIL] P1 GET /api/projects -> 200 且返回数组   实际 404
[FAIL] P2 未登录新增 -> 401                     实际 404
...（P3~P6 全部 404）
```

### 原因
你把 projects 的 4 个接口写在了 `friends.py` 里（第 55~88 行），但没有新建 `projects.py`，`main.py` 里也没有挂载 projects 路由。所以 `/api/projects` **在 FastAPI 里根本不存在** → 404。

而且就算挂载，friends.py 里那套 projects 代码也是**复制粘贴炸弹**，问题一大堆（见第 3 节）。

### 正确结构：一个功能一个文件

```
routers/
├── articles.py    # 文章（前缀 /api/articles）
├── moments.py     # 说说（前缀 /api/moments）
├── friends.py     # 友链（前缀 /api/friends）
└── projects.py    # 项目（前缀 /api/projects）← 必须新建！
```

### 怎么改

**第 1 步**：把 `friends.py` 里第 55~88 行（`list_projects` 到 `delete_moment` 的 projects 部分）**全部删掉**，只留 friends 的 3 个接口。

**第 2 步**：新建 `app/routers/projects.py`，内容见第 4 节的参考代码。

**第 3 步**：`main.py` 加两处：

```python
from .routers import articles, moments, friends, projects   # ① 导入加 projects

app.include_router(friends.router)
app.include_router(projects.router)                          # ② 挂载加这一行
```

---

## 3. 问题 C：friends.py 里 projects 部分的复制粘贴错误清单

对照你自己的代码，逐条检查（这些都是"复制 moments 没改干净"的典型错误）：

| 行 | 你写的 | 应该是 | 后果 |
|---|---|---|---|
| 31 | `def create_moment(` | `def create_friend(` | 函数名错乱，日志难排查 |
| 43 | `def delete_moment(` | `def delete_friend(` | 同上 |
| 50 | `detail="说说不存在"` | `detail="友链不存在"` | 前端提示错误文案 |
| 56 | `@router.get("",...)` 和 19 行重复 | 应该删掉（挪到 projects.py） | 同路径路由遮蔽，第二个永不生效 |
| 76 | `return FriendOut.model_validate(project)` | `return ProjectOut.model_validate(project)` | **类型错误**：Project 没有 is_active 字段，序列化直接炸 |
| 84 | `db.get(Friend, project_id)` | `db.get(Project, project_id)` | **查错表**：删"项目"删的是友链表的数据！ |
| 86 | `detail="说说不存在"` | `detail="项目不存在"` | 文案错误 |

> 这些就是**复制粘贴不检查**的代价。以后每次复制代码后，对照检查这 4 样：函数名、查的表、返回的 schema、提示文案。

---

## 4. 修改后的参考代码（已隔离验证 19/19 全过）

### 4.1 `app/routers/friends.py`（最终版，替换整个文件）

```python
# -*- coding: utf-8 -*-
"""友链 API：列表 / 新增 / 删除。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import User, get_current_user
from ..db import get_db
from ..models import Friend
from ..schemas import FriendCreate, FriendOut

router = APIRouter(prefix="/api/friends", tags=["friends"])


@router.get("", response_model=list[FriendOut])
def list_friends(db: Session = Depends(get_db)):
    """友链列表：活的在前，其次新的在前"""
    items = (
        db.query(Friend)
        .order_by(Friend.is_active.desc(), Friend.created_at.desc(), Friend.id.desc())
        .all()
    )
    return [FriendOut.model_validate(f) for f in items]


@router.post("", response_model=FriendOut, status_code=201)
def create_friend(
    data: FriendCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """新增友链：is_active 默认 True 由数据库兜底，不用客户端传"""
    friend = Friend(**data.model_dump())
    db.add(friend)
    db.commit()
    db.refresh(friend)
    return FriendOut.model_validate(friend)


@router.delete("/{friend_id}", status_code=204)
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    friend = db.get(Friend, friend_id)
    if friend is None:
        raise HTTPException(status_code=404, detail="友链不存在")
    db.delete(friend)
    db.commit()
```

### 4.2 `app/routers/projects.py`（新建，完整内容）

```python
# -*- coding: utf-8 -*-
"""项目 API：列表 / 新增 / 删除。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import User, get_current_user
from ..db import get_db
from ..models import Project
from ..schemas import ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    """项目列表：star 多的在前"""
    items = (
        db.query(Project)
        .order_by(Project.stars.desc(), Project.id.desc())
        .all()
    )
    return [ProjectOut.model_validate(p) for p in items]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    db.delete(project)
    db.commit()
```

### 4.3 `app/schemas.py`（改 3 处）

**FriendCreate**（删 3 行）：
```python
class FriendCreate(BaseModel):
    """新增友链时客户端提交的字段（只有这 4 个）"""
    name: str = Field(min_length=1, max_length=50)
    url: str = Field(min_length=1, max_length=200)
    avatar: str = ""
    description: str = ""
```

**FriendOut**（1 行改动，防隐藏 bug）：
```python
class FriendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str
    avatar: str
    description: str
    is_active: bool
    last_check: datetime | None = None    # ← 必须是"可空"！新友链还没有检测时间，数据库里是 NULL
    created_at: datetime
```

> ⚠️ **这是隐藏 bug**：如果 `last_check: datetime`（非可空），而数据库里 last_check 是 NULL，`FriendOut.model_validate(friend)` 会**序列化失败**——现在表是空的测不出来，等你有第一条友链 GET /api/friends 就崩。`| None` 就解决了。

**ProjectCreate**（删 1 行）：
```python
class ProjectCreate(BaseModel):
    """新增项目时客户端提交的字段"""
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    url: str = ""
    repo: str = ""
    stars: int = Field(default=0, ge=0)
    tech_tags: str = ""
```

### 4.4 `app/main.py`（加 2 处）

```python
from .routers import articles, moments, friends, projects    # ①

app.include_router(friends.router)
app.include_router(projects.router)                           # ②
```

---

## 5. 改完怎么验证

1. 服务带 `--reload` 会自动重启（没带就手动重启）
2. 重跑验收脚本：

```powershell
cd D:/blog_project/backend
./.venv/Scripts/python test_friends_projects.py
```

3. 期望输出：**18 通过 / 0 失败**
4. 全过之后顺便跑一下 `test_moments.py`，确认没改坏别的（应该还是 11/11）

---

## 6. 本次踩坑总结（记到本子上）

1. **Create schema 只放客户端能传的字段**，服务器字段（id/created_at/is_active 等）绝不进 Create
2. **一个功能一个文件**，router 前缀一一对应；新功能 = 新文件 + main.py 挂载，忘了挂载就是 404
3. **复制代码必须检查 4 样**：函数名、查的表、返回的 schema、提示文案
4. **可空字段必须写 `| None`**，否则数据库 NULL 一出现就崩
5. **跑一遍验收脚本再提交**——18 条用例就是你的"自动检查清单"
