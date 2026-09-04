
from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from ..schemas import AiNewsOut
from ..db import get_db
from ..models import AiNews

router = APIRouter(prefix="/api/ai-news", tags=["ainews"])
@router.get("", response_model=dict[str, list[AiNewsOut]])
def list_ai_news(
        db: Session = Depends(get_db)
):
    news = db.query(AiNews).order_by(AiNews.published_at.desc(),AiNews.id.desc()).limit(10).all()
    return {"items": news}
