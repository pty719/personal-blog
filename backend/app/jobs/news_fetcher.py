# app/jobs/news_fetcher.py
"""AI 资讯采集：多源 RSS → 清洗 → 入库（URL 去重）

阅读顺序：SOURCES（源列表）→ clean_html / meaningful_summary（清洗）→ fetch_ai_news（主流程）
设计要点：
  1. 多源数据驱动：加一个源只需在 SOURCES 里加一行
  2. 单源失败隔离：某个源挂了不影响其他源（_fetch_one 内部 try/except）
  3. 摘要质量优先：**空摘要 > 垃圾摘要**（HN 元数据、纯跳转链接一律丢弃）
"""
import logging
import re
from email.utils import parsedate_to_datetime

import feedparser

from ..db import SessionLocal
from ..models import AiNews

logger = logging.getLogger(__name__)

# 源列表（实测可达；加源只需加一行）
SOURCES = [
    {"name": "Hacker News", "url": "https://hnrss.org/newest?q=AI"},
    {"name": "量子位", "url": "https://www.qbitai.com/feed"},
    {"name": "InfoQ", "url": "https://www.infoq.cn/feed"},
    {"name": "少数派", "url": "https://sspai.com/feed"},
]


def clean_html(text: str) -> str:
    """去掉 HTML 标签，保留纯文本"""
    text = re.sub(r"<[^>]+>", "", text or "")   # 去标签
    text = re.sub(r"\s+", " ", text)            # 多空白合并
    return text.strip()


def meaningful_summary(raw_summary: str) -> str:
    """清洗摘要并过滤无价值内容（无价值时返回空字符串）

    丢弃三类垃圾摘要：
      1. Hacker News 的元数据（Article URL / Comments URL / Points ...）——标题已含链接
      2. 纯跳转提示（"点击查看原文"）
      3. 清洗后过短（< 8 字，没有信息量）
    """
    text = clean_html(raw_summary)
    if not text:
        return ""
    # ① HN 元数据类
    if "Article URL:" in text or "Comments URL:" in text:
        return ""
    # ② 纯跳转提示
    if re.fullmatch(r"点击查看原文[>》]?", text):
        return ""
    # ③ 太短无信息量
    if len(text) < 8:
        return ""
    return text[:300]


def _parse_time(s: str):
    """RSS 时间 → datetime（解析失败给 None，不让单条记录炸掉整轮抓取）"""
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except Exception:
        return None


def _fetch_one(db, src: dict, limit: int) -> int:
    """抓取单个源（异常隔离：任何失败只影响本源的计数，不影响其他源）"""
    try:
        feed = feedparser.parse(src["url"])
        added = 0
        for entry in feed.entries[:limit]:
            url = entry.get("link")
            if not url:
                continue
            # 去重：库里已有该 url 就跳过（跨源也去重）
            if db.query(AiNews).filter(AiNews.url == url).first():
                continue
            db.add(AiNews(
                title=(entry.get("title") or "")[:200],
                url=url,
                summary=meaningful_summary(entry.get("summary", "")),
                source=src["name"],
                published_at=_parse_time(entry.get("published") or entry.get("updated") or ""),
            ))
            added += 1
        return added
    except Exception as exc:
        logger.warning("[news] 源 %s 抓取失败：%s", src["name"], exc)
        return 0


def fetch_ai_news(limit: int = 20) -> int:
    """抓取所有源 → 入库，返回新增总条数"""
    db = SessionLocal()
    total_added = 0
    try:
        for src in SOURCES:
            added = _fetch_one(db, src, limit)
            total_added += added
            logger.info("[news] %s 新增 %d 条", src["name"], added)
        db.commit()
    finally:
        db.close()
    return total_added
