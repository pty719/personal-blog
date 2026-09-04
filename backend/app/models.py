# -*- coding: utf-8 -*-
"""ORM 模型：5 张核心表 = 小站的全部数据。
【阅读顺序】main.py -> config.py -> db.py -> 本文件 -> schemas.py -> auth.py -> routers/

表设计（对应原站功能）：
  users    用户表      —— 站长账号 + 以后多用户（登录用）
  articles 文章表      —— 博客文章（Markdown 正文，对应"文章"栏目）
  moments  说说表      —— 一句话动态（对应"说说"栏目，时间线展示）
  friends  友链表      —— 友情链接（第 3 周友链监控 Agent 会更新 is_active/last_check）
  projects 项目表      —— 项目展示（对应"项目"栏目，GitHub 卡片）
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    """用户表：先只服务"站长一个人"，is_admin 为以后留扩展位"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # 登录名，唯一
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)         # bcrypt 哈希，绝不存明文
    nickname: Mapped[str] = mapped_column(String(50), default="", nullable=False)   # 展示昵称
    avatar: Mapped[str] = mapped_column(String(200), default="", nullable=False)    # 头像 URL
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # 是否管理员
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())  # 注册时间


class Article(Base):
    """文章表：核心内容表。content 存 Markdown 原文，前端渲染成 HTML"""
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)          # 标题
    summary: Mapped[str] = mapped_column(String(500), default="", nullable=False)  # 摘要（第 4 周让 AI 自动生成）
    content: Mapped[str] = mapped_column(Text, nullable=False)               # Markdown 正文
    cover: Mapped[str] = mapped_column(String(200), default="", nullable=False)    # 封面图 URL
    category: Mapped[str] = mapped_column(String(50), default="默认", nullable=False)  # 分类
    tags: Mapped[str] = mapped_column(String(200), default="", nullable=False)      # 标签，逗号分隔（简单够用）
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)   # 浏览量，详情接口自增
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()              # 更新时自动写当前时间
    )


class Moment(Base):
    """说说表：一句心情/动态，配图可选，首页/说说页时间线展示"""
    __tablename__ = "moments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)                # 说说正文
    images: Mapped[str] = mapped_column(String(500), default="", nullable=False)  # 图片 URL，逗号分隔
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Friend(Base):
    """友链表：互相挂链接的朋友。
    第 3 周"友链监控 Agent"会定时访问 url 检查网站是否活着，
    把结果写进 is_active / last_check —— 这就是一个真实的 Agent 数据落点。
    """
    __tablename__ = "friends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)             # 友链名
    url: Mapped[str] = mapped_column(String(200), nullable=False)             # 友链地址
    avatar: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # 头像 URL
    description: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # 一句话介绍
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # 存活标记（Agent 更新）
    last_check: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)    # 上次检测时间
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Project(Base):
    """项目表：作品展示卡片，对应"项目"栏目"""
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)            # 项目名
    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)  # 简介
    url: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # 演示地址
    repo: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # GitHub 仓库地址
    stars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)    # star 数（可手动/定时同步）
    tech_tags: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # 技术栈标签，逗号分隔
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class Assistant(Base):
    __tablename__ = "assistants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(36), default="", nullable=False)  # 会话标识（uuid）
    role: Mapped[str] = mapped_column(String(10), default="", nullable=False)   # user / assistant / summary
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)      # 消息内容
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class AiNews(Base):
    __tablename__ = "ai_news"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(200), default="", nullable=False, unique=True)
    summary: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    source: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, default="", server_default=func.now())