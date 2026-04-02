"""
随访管理 API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.tables import Subject, Visit, RawFile
from app.schemas.schemas import VisitCreate, VisitUpdate, VisitResponse
from app.api.auth import get_current_active_user


class VisitBatchCreate(BaseModel):
    """批量创建随访请求"""
    subject_ids: List[int]
    visit_name: str
    visit_date: str
    notes: Optional[str] = None


class VisitBatchResponse(BaseModel):
    """批量创建随访响应"""
    created: List[VisitResponse]
    failed: List[dict]

router = APIRouter()


@router.post("/batch", response_model=VisitBatchResponse)
async def batch_create_visits(
    batch_data: VisitBatchCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """批量创建随访记录"""
    created = []
    failed = []

    for subject_id in batch_data.subject_ids:
        try:
            # 检查受试者是否存在
            subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if not subject:
                failed.append({
                    "subject_id": subject_id,
                    "reason": "受试者不存在"
                })
                continue

            # 创建随访记录
            db_visit = Visit(
                subject_id=subject_id,
                visit_name=batch_data.visit_name,
                visit_date=batch_data.visit_date,
                notes=batch_data.notes
            )
            db.add(db_visit)
            db.commit()
            db.refresh(db_visit)

            created.append(VisitResponse(
                id=db_visit.id,
                subject_id=db_visit.subject_id,
                subject_code=subject.subject_code,
                visit_name=db_visit.visit_name,
                visit_date=db_visit.visit_date,
                notes=db_visit.notes,
                created_at=db_visit.created_at,
                file_count=0
            ))
        except Exception as e:
            failed.append({
                "subject_id": subject_id,
                "reason": str(e)
            })
            db.rollback()

    return VisitBatchResponse(created=created, failed=failed)


@router.post("/", response_model=VisitResponse)
async def create_visit(
    visit: VisitCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """创建新的随访记录"""
    # 检查受试者是否存在
    subject = db.query(Subject).filter(Subject.id == visit.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="受试者不存在")

    db_visit = Visit(**visit.model_dump())
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)

    # 构建响应
    return VisitResponse(
        id=db_visit.id,
        subject_id=db_visit.subject_id,
        subject_code=subject.subject_code,
        visit_name=db_visit.visit_name,
        visit_date=db_visit.visit_date,
        notes=db_visit.notes,
        created_at=db_visit.created_at,
        file_count=0
    )


@router.get("/", response_model=List[VisitResponse])
async def list_visits(
    subject_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取随访列表"""
    query = db.query(Visit, Subject.subject_code).join(Subject)

    if subject_id:
        query = query.filter(Visit.subject_id == subject_id)

    visits = query.offset(skip).limit(limit).all()

    # 统计每个随访的文件数
    file_counts = db.query(
        RawFile.visit_id,
        func.count(RawFile.id).label('count')
    ).group_by(RawFile.visit_id).all()
    file_count_map = {fc.visit_id: fc.count for fc in file_counts}

    results = []
    for visit, subject_code in visits:
        results.append(VisitResponse(
            id=visit.id,
            subject_id=visit.subject_id,
            subject_code=subject_code,
            visit_name=visit.visit_name,
            visit_date=visit.visit_date,
            notes=visit.notes,
            created_at=visit.created_at,
            file_count=file_count_map.get(visit.id, 0)
        ))

    return results


@router.get("/{visit_id}", response_model=VisitResponse)
async def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取随访详情"""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="随访记录不存在")

    subject = db.query(Subject).filter(Subject.id == visit.subject_id).first()

    file_count = db.query(func.count(RawFile.id)).filter(RawFile.visit_id == visit_id).scalar()

    return VisitResponse(
        id=visit.id,
        subject_id=visit.subject_id,
        subject_code=subject.subject_code,
        visit_name=visit.visit_name,
        visit_date=visit.visit_date,
        notes=visit.notes,
        created_at=visit.created_at,
        file_count=file_count
    )


@router.put("/{visit_id}", response_model=VisitResponse)
async def update_visit(
    visit_id: int,
    visit_update: VisitUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """更新随访记录"""
    db_visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not db_visit:
        raise HTTPException(status_code=404, detail="随访记录不存在")

    for key, value in visit_update.model_dump(exclude_unset=True).items():
        setattr(db_visit, key, value)

    db.commit()
    db.refresh(db_visit)

    subject = db.query(Subject).filter(Subject.id == db_visit.subject_id).first()
    file_count = db.query(func.count(RawFile.id)).filter(RawFile.visit_id == visit_id).scalar()

    return VisitResponse(
        id=db_visit.id,
        subject_id=db_visit.subject_id,
        subject_code=subject.subject_code,
        visit_name=db_visit.visit_name,
        visit_date=db_visit.visit_date,
        notes=db_visit.notes,
        created_at=db_visit.created_at,
        file_count=file_count
    )


@router.delete("/{visit_id}")
async def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """删除随访记录"""
    db_visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not db_visit:
        raise HTTPException(status_code=404, detail="随访记录不存在")

    db.delete(db_visit)
    db.commit()
    return {"message": "随访记录已删除"}
