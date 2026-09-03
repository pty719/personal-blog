# -*- coding: utf-8 -*-
"""数据库引擎 + 会话管理。
【阅读顺序】main.py -> config.py -> 本文件 -> models.py -> ...

SQLAlchemy 2.0 的三个核心概念：
  1. engine      —— 连接池，负责真正跟数据库通信
  2. SessionLocal —— 会话工厂，每个请求从这里拿一个"工作会话"
  3. Base        —— 所有 ORM 模型类的父类（models.py 里的表都继承它）
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

# SQLite 只允许"创建连接的线程"访问，FastAPI 是多线程处理请求的，
# 所以必须加 check_same_thread=False，否则一并发就报错。
# 换成 MySQL 后不需要这个参数，用条件判断自动适配。
connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# autoflush=False：查询前不自动把未提交的修改刷进库（行为更可预测）
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类，SQLAlchemy 靠它收集表定义（metadata）"""
    pass


def get_db():
    """FastAPI 依赖注入函数：每个请求开一个会话，请求结束自动关闭。

    用法：def list_articles(db: Session = Depends(get_db)): ...
    这样写的好处：数据库连接不会泄漏，用完必关。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
