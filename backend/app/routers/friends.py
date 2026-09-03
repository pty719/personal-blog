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



