# -*- coding: utf-8 -*-
"""说说 API：列表 / 发布 / 删除。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> articles.py -> 本文件


#ai写的不包含logging，异步
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Moment
from ..schemas import MomentCreate, MomentOut
from ..auth import User, get_current_user

router = APIRouter(prefix="/api/moments", tags=["moments"])

@router.get("",response_model=dict)
def list_moments(page: int = 1,page_size: int = 10, db: Session = Depends(get_db)):
    #先计算总页数
    total = db.query(Moment).count()
    #
    items = (
        db.query(Moment)
        .order_by(Moment.created_at.desc(),Moment.id.desc())
        .offset((page-1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total,"page": page,"page_size": page_size,"items": [MomentOut.model_validate(a) for a in items]}


@router.post("", response_model=MomentOut, status_code=201)
def create_moment(
        data:MomentCreate,
        db:Session = Depends(get_db),
        user:User =Depends(get_current_user)
):
    moment = Moment(**data.model_dump())
    db.add(moment)
    db.commit()
    db.refresh(moment)
    return MomentOut.model_validate(moment)

@router.delete("/{moment_id}", status_code=204)
def delete_moment(
        moment_id:int,
        db:Session = Depends(get_db),
        user:User = Depends(get_current_user)
):
    moment = db.get(Moment, moment_id)
    if moment is None:
        raise HTTPException(status_code=404, detail="说说不存在")
    db.delete(moment)
    db.commit()