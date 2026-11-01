# -*- coding: utf-8 -*-
"""说说 API：列表 / 发布 / 删除。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> articles.py -> moments.py
-> 本文件


"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Friend
from ..schemas import FriendCreate, FriendOut
from ..auth import User, get_current_user
from ..jobs.friend_monitor import check_all_friends, check_friend

router = APIRouter(prefix="/api/friends", tags=["friends"])

@router.get("",response_model=List)
def list_friends(db: Session = Depends(get_db)):
    #
    items = (
        db.query(Friend)
        .order_by(Friend.is_active.desc(),Friend.created_at.desc(),Friend.id.desc())
        .all()
    )
    return [FriendOut.model_validate(item) for item in items]


@router.post("/check")
def check_all(user: User = Depends(get_current_user)):
    """手动触发一次全部友链巡检（管理员）。"""
    return check_all_friends()


@router.post("/{friend_id}/check", response_model=FriendOut)
def check_one_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """手动检测单个友链（管理员）。"""
    friend = db.get(Friend, friend_id)
    if friend is None:
        raise HTTPException(status_code=404, detail="友链不存在")
    check_friend(friend)
    db.commit()
    db.refresh(friend)
    return friend


@router.post("", response_model=FriendOut, status_code=201)
def create_friend(
        data:FriendCreate,
        db:Session = Depends(get_db),
        user:User =Depends(get_current_user)
):
    friend = Friend(**data.model_dump())
    db.add(friend)
    db.commit()
    db.refresh(friend)
    return FriendOut.model_validate(friend)

@router.delete("/{friend_id}", status_code=204)
def delete_friend(
        friend_id:int,
        db:Session = Depends(get_db),
        user:User = Depends(get_current_user)
):
    friend = db.get(Friend, friend_id)
    if friend is None:
        raise HTTPException(status_code=404, detail="友链不存在")
    db.delete(friend)
    db.commit()



