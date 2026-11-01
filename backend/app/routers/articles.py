# -*- coding: utf-8 -*-
"""文章 API：列表 / 详情 / 发布 / 编辑 / 删除。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> 本文件

这是"最标准的一套 CRUD"，后面说说/友链/项目接口都是复制这个套路改字段，
所以第一周先把这里吃透，其余表就是机械活。
"""
from click import prompt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..utils.llm import chat_completion
from ..auth import get_current_user
from ..db import get_db
from ..models import Article, User
from ..schemas import ArticleCreate, ArticleDetail, ArticleOut, ArticleUpdate

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.get("", response_model=dict)
def list_articles(page: int = 1, page_size: int = 10, keyword: str = "", db: Session = Depends(get_db)):
    """文章列表（分页，不含正文）。
    - keyword：按标题模糊搜索（空 = 查全部）
    - 排序：created_at 倒序（最新在前）
    返回 {total: 总条数, items: 当前页}，前端翻页用 total 算总页数。
    """
    # 先构造查询对象（不急着执行，搜索条件先挂上去）
    query = db.query(Article)
    if keyword:
        # contains = SQL 的 LIKE '%keyword%'，标题模糊匹配
        query = query.filter(Article.title.contains(keyword))
    # 再数总数（要基于过滤后的条件数，否则分页不准）
    total = query.count()
    # order_by(created_at.desc()) 新的在前；加 id.desc() 作 tiebreaker（同秒多条也稳定）
    items = (
        query
        .order_by(Article.created_at.desc(), Article.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "page_size": page_size,
            "items": [ArticleOut.model_validate(a) for a in items]}


@router.get("/{article_id}/related")
def get_related_articles(article_id: int, limit: int = 3):
    """语义相近的其他文章（RAG 向量检索，供详情页“相关文章”使用）。"""
    from ..services.rag import related_articles
    limit = max(1, min(limit, 10))
    return related_articles(article_id, limit)


@router.get("/{article_id}", response_model=ArticleDetail)
def get_article(article_id: int, db: Session = Depends(get_db)):
    """文章详情：返回全文，并让浏览量 +1（简单统计，够用）"""
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    article.views += 1          # 浏览量自增
    db.commit()                 # 提交到数据库
    db.refresh(article)         # 刷新对象，让 views 取到数据库里最新的值
    return ArticleDetail.model_validate(article)


@router.post("", response_model=ArticleDetail, status_code=201)
def create_article(
    data: ArticleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),   # 发布必须登录
):
    #生成summary摘要
    summary = data.summary
    if not summary and data.content:
        try:
            prompt = f"用50字以内总结这篇文章：\n{data.content[:500]}"
            resp = chat_completion([{"role": "user", "content": prompt}])
            summary = resp["content"].strip()[:100]
        except Exception:
            summary = data.content[:50]


    """发布文章。user 参数不直接用，但写上它就等于"这个接口要登录才能调" """
    article = Article(**data.model_dump(exclude={'summary'}), summary=summary)    # Pydantic 数据直接展开成 ORM 字段
    db.add(article)
    db.commit()
    db.refresh(article)
    return ArticleDetail.model_validate(article)


@router.put("/{article_id}", response_model=ArticleDetail)
def update_article(
    article_id: int,
    data: ArticleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """编辑文章：只更新传了值的字段"""
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    # model_dump(exclude_unset=True)：只拿客户端显式传了的字段，
    # 没传的字段不动，避免"编辑时把摘要覆盖成空"这种事故
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(article, field, value)
    db.commit()
    db.refresh(article)
    return ArticleDetail.model_validate(article)


@router.delete("/{article_id}", status_code=204)
def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除文章。status_code=204 表示"删成功了但没有返回体" """
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    db.delete(article)
    db.commit()
