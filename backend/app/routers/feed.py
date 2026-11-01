from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from html import escape

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Article

router = APIRouter(tags=["feed"])
SITE = settings.SITE_URL.rstrip("/")
CST = timezone(timedelta(hours=8))


def _rfc822(value: datetime | None) -> str:
    """数据库里是本地朴素时间；按中国时区输出 RFC 822。"""
    if value is None:
        value = datetime.now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=CST)
    return format_datetime(value)


@router.get("/feed.xml")
def feed(db: Session = Depends(get_db)):
    """文章 RSS：最近 20 篇。"""
    articles = (
        db.query(Article)
        .order_by(Article.created_at.desc(), Article.id.desc())
        .limit(20)
        .all()
    )
    items = []
    for article in articles:
        link = f"{SITE}/articles/{article.id}"
        items.append(
            "<item>"
            f"<title>{escape(article.title)}</title>"
            f"<link>{link}</link>"
            f'<guid isPermaLink="true">{link}</guid>'
            f"<pubDate>{_rfc822(article.created_at)}</pubDate>"
            f"<description>{escape(article.summary or '')}</description>"
            "</item>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0"><channel>'
        "<title>yizhiyu的小站</title>"
        f"<link>{SITE}/</link>"
        "<description>智能体应用开发者的个人博客与作品集</description>"
        "<language>zh-CN</language>"
        f"<lastBuildDate>{_rfc822(datetime.now())}</lastBuildDate>"
        + "".join(items)
        + "</channel></rss>"
    )
    return Response(content=xml, media_type="application/rss+xml; charset=utf-8")


@router.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    """站点地图：固定页面 + 全部文章。"""
    pages = ["/", "/articles", "/moments", "/friends", "/projects", "/ai-news", "/ai-assistant"]
    entries = [f"<url><loc>{SITE}{page}</loc></url>" for page in pages]
    articles = db.query(Article).order_by(Article.id.desc()).all()
    for article in articles:
        lastmod = article.updated_at or article.created_at
        entries.append(
            f"<url><loc>{SITE}/articles/{article.id}</loc>"
            f"<lastmod>{lastmod.date().isoformat()}</lastmod></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(entries)
        + "</urlset>"
    )
    return Response(content=xml, media_type="application/xml; charset=utf-8")


@router.get("/robots.txt")
def robots():
    """爬虫协议：允许抓取，并指向 sitemap。"""
    body = f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n"
    return Response(content=body, media_type="text/plain; charset=utf-8")
