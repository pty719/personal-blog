# -*- coding: utf-8 -*-
"""Pydantic 模型：API 的"输入输出契约"。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> 本文件 -> auth.py -> routers/

作用：FastAPI 拿到请求后，按这里定义的结构自动校验/转换；
返回响应时，自动把 ORM 对象序列化成 JSON。
（ORM 模型管"数据库长什么样"，Pydantic 管"接口长什么样"，两者分开是 FastAPI 最佳实践）
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict,Field


# ---------- 用户 ----------
class UserOut(BaseModel):
    """返回给前端的用户信息（绝不能带 password_hash！）"""
    model_config = ConfigDict(from_attributes=True)  # 允许直接从 ORM 对象构造

    id: int
    username: str
    nickname: str
    avatar: str
    is_admin: bool
    created_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    """登录成功返回：JWT 令牌 + 用户信息"""
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- 文章 ----------
class ArticleCreate(BaseModel):
    """发布文章时前端提交的字段（必填只有 title/content）"""
    title: str
    content: str
    summary: str = ""
    cover: str = ""
    category: str = "默认"
    tags: str = ""


class ArticleUpdate(BaseModel):
    """编辑文章：所有字段可选，只更新传了的字段"""
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    cover: str | None = None
    category: str | None = None
    tags: str | None = None


class ArticleOut(BaseModel):
    """列表页用的文章信息（不含正文，省流量）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: str
    category: str
    tags: str
    views: int
    created_at: datetime
    updated_at: datetime


class ArticleDetail(ArticleOut):
    """详情页用的文章信息 = 列表信息 + 正文"""
    content: str

#---------说说-----------
class MomentCreate(BaseModel):
    """发布说说时前端提交的字段"""
    content: str = Field(min_length=1, max_length=500)
    images: str = ""

class MomentOut(BaseModel):

    model_config = ConfigDict(from_attributes=True)
    id: int
    content: str
    images: str
    created_at: datetime

#----------友链----------
class FriendCreate(BaseModel):
    """发友链前必须要检查提交的字段"""
    name : str = Field(min_length=1, max_length=50)
    url : str = Field(min_length=1, max_length=200)
    avatar: str = ""
    description: str = ""


class FriendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id : int
    name : str
    url : str
    avatar: str
    description: str
    is_active: bool
    last_check: datetime | None = None
    created_at: datetime

#----------项目----------
class ProjectCreate(BaseModel):
    """发项目前必须要检查提交的字段"""
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    url: str = ""
    repo: str = ""
    stars:int = Field(default=0, ge=0)
    tech_tags: str = ""

class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    url: str
    repo: str
    stars: int
    tech_tags: str
    created_at: datetime

#---------站内ai助手--------
class AssistantCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    conversation_id : str | None = None
    content : str = Field(min_length=1, max_length=500)

class AssistantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id : int
    conversation_id: str
    role : str
    content : str
    created_at: datetime

#ai爬取新闻
class AiNewsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    url: str
    summary: str = ""
    source: str = ""
    published_at: datetime | None = None
