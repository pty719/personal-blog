# -*- coding: utf-8 -*-
"""FastAPI 入口：应用实例 + 中间件 + 路由挂载。
【阅读顺序】本文件 -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> routers/

启动命令（backend 目录下）：
    .venv/Scripts/uvicorn app.main:app --reload --port 8000
    （--reload：改代码自动重启，开发期神器。
     注意：docstring 里写 Windows 路径要避免 \\u 开头，如 \\uvicorn 会被 Python
     当成 Unicode 转义报 SyntaxError，所以这里用正斜杠）
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from .jobs.news_fetcher import fetch_ai_news
from .jobs.friend_monitor import check_all_friends
from .auth import router as auth_router
from .routers import articles, moments, friends, projects, assistants, ai_news, stats, feed
from .services.rag import build_index


scheduler = BackgroundScheduler()
scheduler.add_job(check_all_friends, 'cron', hour=8, minute=0)   # 每天 8:00（函数引用，无括号）
scheduler.add_job(fetch_ai_news, 'interval', hours=6)
scheduler.start()
# 启动时立即跑一次（部署完马上看到效果）
check_all_friends()
#启动时构建知识库索引（文章少，秒级）
build_index()
app = FastAPI(
    title="小站 API",
    description="Starhiro 小站复刻版 —— FastAPI 后端（求职作品）",
    version="0.1.0",
)

# CORS：允许浏览器跨域访问。
# 开发期前端跑在 localhost:5173（Vite），后端在 8000，端口不同就是跨域。
# 部署后前端和后端同域名（nginx 反代），这个中间件就不起作用了，但留着无害。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # 开发期放开所有来源；上线前可以收紧成自己的域名
    allow_credentials=True,
    allow_methods=["*"],      # 允许所有 HTTP 方法（GET/POST/PUT/DELETE...）
    allow_headers=["*"],
)

# 挂载路由：/api/auth/* 和 /api/articles/*
app.include_router(auth_router)
app.include_router(articles.router)
app.include_router(moments.router)
app.include_router(friends.router)
app.include_router(projects.router)
app.include_router(assistants.router)
app.include_router(ai_news.router)
app.include_router(stats.router)
app.include_router(feed.router)

@app.get("/health")
@app.get("/api/health")
def health():
    """健康检查：部署后 nginx 和监控脚本用它确认后端活着
    两个路径都注册：/health 给 curl/测试脚本，/api/health 给前端（走 Vite/nginx 代理）
    """
    return {"status": "ok", "service": "blog-api"}
