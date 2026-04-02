"""
受试者管理 API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.tables import Subject, Visit
from app.schemas.schemas import SubjectCreate, SubjectUpdate, SubjectResponse
from app.api.auth import get_current_active_user

router = APIRouter()


@router.post("/", response_model=SubjectResponse)
async def create_subject(
    subject: SubjectCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """创建新的受试者"""
    # 检查编码是否已存在
    existing = db.query(Subject).filter(Subject.subject_code == subject.subject_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="受试者编码已存在")

    db_subject = Subject(**subject.model_dump())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.get("/", response_model=List[SubjectResponse])
async def list_subjects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取受试者列表"""
    query = db.query(Subject)

    if search:
        query = query.filter(
            (Subject.subject_code.contains(search)) |
            (Subject.name_pinyin.contains(search))
        )

    subjects = query.offset(skip).limit(limit).all()
    return subjects


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取单个受试者详情"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="受试者不存在")
    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    subject_update: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """更新受试者信息"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="受试者不存在")

    for key, value in subject_update.model_dump(exclude_unset=True).items():
        setattr(db_subject, key, value)

    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.delete("/{subject_id}")
async def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """删除受试者"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="受试者不存在")

    db.delete(db_subject)
    db.commit()
    return {"message": "受试者已删除"}
