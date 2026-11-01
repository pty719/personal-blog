# -*- coding: utf-8 -*-
"""项目配置：数据库地址、JWT 密钥等。
【阅读顺序】main.py -> 本文件 -> db.py -> models.py -> schemas.py -> auth.py -> routers/

用 pydantic-settings 读配置：优先读环境变量 / .env 文件，没配就用下面的默认值。
这样"本地开发"和"阿里云部署"只需要改一个 DATABASE_URL，代码不用动。
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库连接串：
    #   本地开发：sqlite:///./blog.db —— 零配置，库文件自动生成在 backend/blog.db
    #   阿里云部署：mysql+pymysql://root:你的密码@127.0.0.1:3306/blog
    #     （pymysql 是纯 Python 的 MySQL 驱动，pip 装一下：pip install pymysql）
    DATABASE_URL: str = "sqlite:///./blog.db"

    # JWT 签名密钥：生产必须改成随机长字符串（部署时写进服务器的 .env）
    JWT_SECRET: str = "dev-secret-change-me-in-production"

    # 登录态有效期（小时），72 小时 = 3 天免登录
    JWT_EXPIRE_HOURS: int = 72

    # 站点对外地址：RSS / sitemap / robots 用它生成绝对链接
    SITE_URL: str = "https://yizhiyu.me"

    #DEEPSEEK_KEY
    DEEPSEEK_API_KEY: str = ""      # 从 .env 读取（密钥不进代码！本地 backend/.env，服务器 deploy/.env）
    MODEL: str = "deepseek-chat"

    class Config:
        env_file = ".env"   # 允许从 backend/.env 文件读配置（部署时用）


settings = Settings()
