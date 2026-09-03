# -*- coding: utf-8 -*-
"""说说 API：列表 / 发布 / 删除。
【阅读顺序】main.py -> config.py -> db.py -> models.py -> schemas.py -> auth.py -> articles.py -> moments.py
-> friends.py -> 本文件


"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Project
from ..schemas import ProjectCreate, ProjectOut
from ..auth import User, get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("",response_model=List)
def list_projects(db: Session = Depends(get_db)):
    #
    items = (
        db.query(Project)
        .order_by(Project.stars.desc(),Project.id.desc())
        .all()
    )
    return [ProjectOut.model_validate(item) for item in items]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
        data:ProjectCreate,
        db:Session = Depends(get_db),
        user:User =Depends(get_current_user)
):
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)

@router.delete("/{project_id}", status_code=204)
def delete_project(
        project_id:int,
        db:Session = Depends(get_db),
        user:User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    db.delete(project)
    db.commit()
