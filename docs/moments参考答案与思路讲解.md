# 「说说」moments.py 参考答案与思路讲解

> 版本：v1.0 ｜ 状态：**已隔离验证，13 项测试全部通过**（你的项目目录零改动）
> 用途：你写完自己的版本后对照；或者完全卡住时照此抄写并逐行理解

---

## 0. 你为什么会卡住：两种 SQLAlchemy 风格

你之前的接口用 `session.execute()`，骨架用 `db.query()`——**两种都是 SQLAlchemy，写法不同，效果一样**。你不是不会写，是两种风格混着看懵了。

| 操作 | 你的旧写法（Core 风格） | 骨架/本答案的写法（ORM 风格） |
|---|---|---|
| 查全部 | `db.execute(select(Moment)).scalars().all()` | `db.query(Moment).all()` |
| 按条件查 | `db.execute(select(Moment).where(...))` | `db.query(Moment).filter(...)` |
| 按主键查 | `db.get(Moment, id)`（其实一样） | `db.get(Moment, id)` |
| 计数 | `db.execute(select(func.count()).select_from(Moment)).scalar()` | `db.query(Moment).count()` |
| 插入 | `db.add(obj); db.commit()` | `db.add(obj); db.commit()`（一样） |
| 取结果 | 返回 `Row` 对象，要 `.scalar()/.scalars()` | 返回 ORM 对象，**直接 `.content` 取属性** |

**结论**：`db.query()` 更直观——查出来就是 Python 对象，直接点属性。**项目里保持一种风格最重要**，骨架用 ORM 风格，所以你也用 ORM 风格。

---

## 1. 改 `app/schemas.py`（追加两段，不动原有代码）

先在文件**顶部 import 行**加 `Field`（原本只有 `BaseModel, ConfigDict`）：

```python
from pydantic import BaseModel, ConfigDict, Field
```

再在**文件末尾**追加：

```python
# ---------- 说说 ----------
class MomentCreate(BaseModel):
    """发布说说的请求体：content 必填 1~500 字，images 可选"""
    content: str = Field(min_length=1, max_length=500)
    images: str = ""


class MomentOut(BaseModel):
    """返回给前端的说说对象"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    images: str
    created_at: datetime
```

**为什么这么写**：
- `Field(min_length=1, max_length=500)` —— 校验规则**声明式**写在类型上，FastAPI 自动校验。空字符串/超长直接返回 **422**，你**不需要写任何 if 判断**
- `images: str = ""` —— 可选字段，前端没传就用空字符串
- `model_config = ConfigDict(from_attributes=True)` —— 允许从 ORM 对象直接转（`MomentOut.model_validate(moment)` 的魔法来源）
- `MomentOut` 只声明 4 个字段 —— 序列化时**只暴露这 4 个**，ORM 对象上别的属性不会漏出去

---

## 2. 新建 `app/routers/moments.py`（全文）

```python
# -*- coding: utf-8 -*-
"""说说 API：列表 / 发布 / 删除。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> articles.py -> 本文件
完全照抄 articles.py 的套路：列表=改表名，发布=改字段，删除=改字段。
纯 ORM 风格（db.query / db.get / db.add），不要混用 session.execute。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user      # 登录校验依赖：写上它=这个接口要登录
from ..db import get_db                  # 数据库会话依赖
from ..models import Moment, User        # Moment=说说表，User=当前登录用户类型
from ..schemas import MomentCreate, MomentOut

router = APIRouter(prefix="/api/moments", tags=["moments"])


@router.get("", response_model=dict)
def list_moments(page: int = 1, page_size: int = 10, db: Session = Depends(get_db)):
    """① 说说列表：游客可看，分页 + 时间倒序"""
    # 第一步：数总数（前端翻页要知道总条数）
    total = db.query(Moment).count()

    # 第二步：查当前页。注意排序加 id.desc() 作 tiebreaker——
    # 同一秒发布的多条记录 created_at 相同，光按时间排不稳定，id 越大越新
    items = (
        db.query(Moment)
        .order_by(Moment.created_at.desc(), Moment.id.desc())
        .offset((page - 1) * page_size)   # 跳过前几页
        .limit(page_size)                 # 只取一页
        .all()
    )

    # 第三步：ORM 对象 -> Pydantic -> JSON。列表接口统一返回 total/page/page_size/items
    return {"total": total, "page": page, "page_size": page_size,
            "items": [MomentOut.model_validate(m) for m in items]}


@router.post("", response_model=MomentOut, status_code=201)
def create_moment(
    data: MomentCreate,                      # 请求体：FastAPI 自动校验 content 1~500 字
    db: Session = Depends(get_db),           # 数据库会话
    user: User = Depends(get_current_user),  # 登录校验：没登录直接 401
):
    """② 发布说说：需登录。content 校验由 Pydantic 自动完成"""
    # Pydantic 请求体展开成 ORM 字段：Moment(**{"content": "...", "images": ""})
    moment = Moment(**data.model_dump())
    db.add(moment)      # 加入会话（还没写库）
    db.commit()         # 提交事务（真正写进数据库）
    db.refresh(moment)  # 刷新：让 id / created_at 取到数据库生成的值
    return MomentOut.model_validate(moment)


@router.delete("/{moment_id}", status_code=204)
def delete_moment(
    moment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """③ 删除说说：需登录。删不存在的返回 404，绝不静默成功"""
    moment = db.get(Moment, moment_id)   # 按主键查：查不到返回 None
    if moment is None:
        raise HTTPException(status_code=404, detail="说说不存在")
    db.delete(moment)
    db.commit()
    # 204 表示"删成功但没有返回体"，所以不 return 任何内容
```

**思路拆解（每个接口都是这三步）**：

| 接口 | 第一步：查 | 第二步：写 | 第三步：回 |
|---|---|---|---|
| 列表 | `count()` 总数 | `order_by + offset + limit` 查当前页 | 包成 `{total, page, page_size, items}` |
| 发布 | 无（新增） | `add + commit + refresh` | 返回创建好的对象 |
| 删除 | `db.get` 查存在性 | 不存在就 404，存在就 `delete + commit` | 无返回体（204） |

---

## 3. 改 `app/main.py`（加两行）

```python
from .routers import articles, moments   # 改：把 moments 加进导入

app.include_router(articles.router)
app.include_router(moments.router)       # 加：挂载 moments 路由
```

> 忘了这步 = 接口 404。写完路由**必须**回来挂载，这是最常见的遗漏点。

---

## 4. 常见错误（写的时候对照）

| ❌ 错误 | ✅ 正确 | 原因 |
|---|---|---|
| 校验失败自己 raise 400 | 让 Pydantic 返回 **422** | FastAPI 标准行为，前端统一处理 4xx |
| 只按 `created_at.desc()` 排序 | 加 `id.desc()` 双条件 | 同一秒多条时排序不稳定（实测踩过） |
| 忘了挂载 router | main.py 里 include_router | 不挂载 = 404 |
| `images` 校验写一堆 if | `images: str = ""` 就行 | 约定就是字符串，前端 split 逗号 |
| 返回 ORM 对象本身 | `MomentOut.model_validate(m)` | 直接返回会泄漏未声明字段、格式不受控 |
| 删除不检查存在 | `db.get` 为 None 就 404 | 不检查 = 删除不存在的也"成功"，前端困惑 |

---

## 5. 验收（文档里的代码已验证：13/13 通过）

按 `docs/moments需求文档.md` 第 7 节跑，**注意一处修正**：

> ~~⑤ 空 content → 400~~ → **⑤ 空 content → 422**（Pydantic 校验失败是 FastAPI 标准响应码，不是 400）

验证用例结果（隔离环境实测）：

```
[PASS] ① 空列表 total=0 结构正确
[PASS] ② 未登录 POST -> 401
[PASS] ③ 登录成功
[PASS] ④ 发布 -> 201 且返回 id/created_at
[PASS] ⑤ 空 content -> 422
[PASS] ⑤b 超长 content(501字) -> 422
[PASS] ⑥ 带 images 发布 -> 201
[PASS] ⑦ 列表 total=2
[PASS] ⑦ 时间倒序（新发的在前）
[PASS] ⑧ 删除 -> 204
[PASS] ⑨ 删除不存在 -> 404
[PASS] ⑩ 未登录删除 -> 401
[PASS] ⑪ 删后 total=1
```

---

## 6. 你现在怎么用这份文档

1. **先别抄**：对照你自己的 `moments.py`，找出 3 处和答案不同的地方，想明白为什么
2. 完全卡住（20 分钟没进展）→ 照抄，但**每行都要能说出"干什么、为什么"**
3. 跑验收用例，全过 = 完成
4. 完成后把你自己的版本发我 review，我指出可以改进的点
