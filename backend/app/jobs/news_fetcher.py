# app/services/news_fetcher.py（新建）
from email.utils import parsedate_to_datetime

import feedparser


from ..db import SessionLocal
from ..models import AiNews

import re

def clean_html(text: str) -> str:
    """去掉 HTML 标签，保留纯文本"""
    text = re.sub(r"<[^>]+>", "", text)      # 去掉 <...> 标签
    text = re.sub(r"\s+", " ", text)         # 多空白合并成单空格
    return text.strip()

def _parse_time(s: str):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except Exception:
        return None
def fetch_ai_news(limit: int = 20) -> int:
    """抓取 AI 新闻 → 存库（url 去重），返回新增条数"""
    feed = feedparser.parse("https://hnrss.org/newest?q=AI")
    db = SessionLocal()
    added = 0
    try:
        for entry in feed.entries[:limit]:
            url = entry.link
            # 去重：库里已有这个 url 就跳过
            exists = db.query(AiNews).filter(AiNews.url == url).first()
            if exists:
                continue
            db.add(AiNews(
                title=entry.title,
                url=url,
                summary=clean_html(entry.get("summary", "")),
                source="Hacker News",
                published_at=_parse_time(entry.get("published", "")),
            ))
            added += 1
        db.commit()
    finally:
        db.close()
    return added
