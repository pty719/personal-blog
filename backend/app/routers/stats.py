from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import User, get_current_user
from ..db import get_db
from ..models import Article, Moment, Friend, Project, Assistant, AiNews

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """后台概览：内容数量、总浏览量、活跃友链、会话数与 Top 文章。"""
    articles = db.query(func.count(Article.id)).scalar() or 0
    moments = db.query(func.count(Moment.id)).scalar() or 0
    friends = db.query(func.count(Friend.id)).scalar() or 0
    active_friends = (
        db.query(func.count(Friend.id)).filter(Friend.is_active.is_(True)).scalar() or 0
    )
    projects = db.query(func.count(Project.id)).scalar() or 0
    news = db.query(func.count(AiNews.id)).scalar() or 0
    conversations = (
        db.query(func.count(func.distinct(Assistant.conversation_id))).scalar() or 0
    )
    total_views = db.query(func.coalesce(func.sum(Article.views), 0)).scalar() or 0
    top_articles = (
        db.query(Article)
        .order_by(Article.views.desc(), Article.id.desc())
        .limit(5)
        .all()
    )
    return {
        "articles": articles,
        "moments": moments,
        "friends": friends,
        "active_friends": active_friends,
        "projects": projects,
        "ai_news": news,
        "conversations": conversations,
        "total_views": int(total_views),
        "top_articles": [
            {"id": article.id, "title": article.title, "views": article.views}
            for article in top_articles
        ],
    }
