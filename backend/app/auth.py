# -*- coding: utf-8 -*-
"""登录认证：密码哈希 + JWT 签发/校验 + 登录接口。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> 本文件 -> routers/

流程：
  1. POST /api/auth/login 收到用户名密码
  2. bcrypt 比对密码哈希（不存明文，数据库被拖库也拿不到密码）
  3. 通过后 PyJWT 签发一个带过期时间的令牌返回前端
  4. 前端之后每次请求带 Authorization: Bearer <令牌>
  5. get_current_user 依赖负责解开令牌、查出是哪个用户
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User
from .schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- 密码哈希 ----------
def hash_password(password: str) -> str:
    """明文密码 -> bcrypt 哈希串。gensalt() 每次生成随机盐，同一密码两次结果不同"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """比对：bcrypt 会把盐从哈希里取出来再算，所以不用自己存盐"""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# ---------- JWT ----------
def create_token(user: User) -> str:
    """给用户签发 JWT。sub 存用户 id，exp 存过期时间（Unix 时间戳）"""
    payload = {
        "sub": str(user.id),                                    # subject：令牌代表谁
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def get_current_user(
    authorization: str = Header(default=""),   # 从请求头拿 Authorization
    db: Session = Depends(get_db),
) -> User:
    """FastAPI 依赖：校验令牌并返回当前用户。用在"需要登录"的接口上。
    用法：def create_article(..., user: User = Depends(get_current_user))
    校验失败直接抛 401，FastAPI 自动转成 401 响应。
    """
    # 请求头格式必须是 "Bearer xxx"，取 xxx 部分
    #print(f"authorization:{authorization: Bearer ***}")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization.removeprefix("Bearer ")

    try:
        # 解密 + 验签 + 查过期，任何一个不对都会抛 PyJWTError
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="令牌无效或已过期")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


# ---------- 接口 ----------
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """登录：校验用户名密码 -> 返回令牌 + 用户信息"""
    user = db.query(User).filter(User.username == data.username).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    return TokenResponse(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息（前端刷新页面后用来恢复登录态）"""
    return UserOut.model_validate(user)
