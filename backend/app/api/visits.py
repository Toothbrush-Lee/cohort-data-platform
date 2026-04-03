"""
随访管理 API（研究级）
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd

from app.core.database import get_db
from app.models.tables import Subject, Visit, RawFile, Study, StudyMember, User
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


def _get_study_member_or_403(study_id: int, user: User, db: Session) -> StudyMember:
    """检查用户是否有权限访问研究"""
    member = db.query(StudyMember).filter(
        StudyMember.study_id == study_id,
        StudyMember.user_id == user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="无权访问该研究")
    return member


@router.post("/batch", response_model=VisitBatchResponse)
async def batch_create_visits(
    batch_data: VisitBatchCreate,
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """批量创建随访记录"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    created = []
    failed = []

    for subject_id in batch_data.subject_ids:
        try:
            # 检查受试者是否存在且属于该研究
            subject = db.query(Subject).filter(
                Subject.id == subject_id,
                Subject.study_id == study_id
            ).first()
            if not subject:
                failed.append({
                    "subject_id": subject_id,
                    "reason": "受试者不存在或不属于该研究"
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
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """创建新的随访记录"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    # 检查受试者是否存在且属于该研究
    subject = db.query(Subject).filter(
        Subject.id == visit.subject_id,
        Subject.study_id == study_id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="受试者不存在或不属于该研究")

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
    study_id: int = Query(..., description="研究 ID"),
    subject_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取随访列表"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    query = db.query(Visit, Subject.subject_code).join(
        Subject, Visit.subject_id == Subject.id
    ).filter(Subject.study_id == study_id)

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

    # 检查权限（通过 study_id）
    subject = db.query(Subject).filter(Subject.id == visit.subject_id).first()
    if subject:
        _get_study_member_or_403(subject.study_id, current_user, db)

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

    # 检查权限
    subject = db.query(Subject).filter(Subject.id == db_visit.subject_id).first()
    if subject:
        _get_study_member_or_403(subject.study_id, current_user, db)

    for key, value in visit_update.model_dump(exclude_unset=True).items():
        setattr(db_visit, key, value)

    db.commit()
    db.refresh(db_visit)

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

    # 检查权限
    subject = db.query(Subject).filter(Subject.id == db_visit.subject_id).first()
    if subject:
        _get_study_member_or_403(subject.study_id, current_user, db)

    db.delete(db_visit)
    db.commit()
    return {"message": "随访记录已删除"}


@router.post("/import/excel")
async def import_visits_from_excel(
    file: UploadFile = File(...),
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """从 Excel 文件批量导入随访记录

    Excel 格式要求:
    - subject_code: 受试者编号 (必填，必须已存在)
    - visit_name: 随访类型 (必填，Baseline/V1/V3/V6/V12/Other)
    - visit_date: 随访日期 (必填，YYYY-MM-DD)
    - notes: 备注 (可选)
    """
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    # 读取 Excel 文件
    try:
        contents = await file.read()
        df = pd.read_excel(contents, engine='openpyxl')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取 Excel 文件：{str(e)}")

    # 验证必要的列
    required_columns = ['subject_code', 'visit_name', 'visit_date']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Excel 缺少必要的列：{', '.join(missing_columns)}")

    # 批量导入
    results = {"success": [], "failed": []}

    for index, row in df.iterrows():
        try:
            # 检查受试者是否存在
            subject = db.query(Subject).filter(
                Subject.study_id == study_id,
                Subject.subject_code == str(row['subject_code'])
            ).first()
            if not subject:
                results["failed"].append({
                    "row": index + 2,
                    "reason": f"受试者不存在：{row['subject_code']}"
                })
                continue

            # 解析日期
            visit_date = None
            if pd.notna(row['visit_date']):
                if isinstance(row['visit_date'], datetime):
                    visit_date = row['visit_date'].strftime('%Y-%m-%d')
                else:
                    visit_date = str(row['visit_date'])

            # 检查随访类型是否有效
            valid_visit_types = ['Baseline', 'V1', 'V3', 'V6', 'V12', 'Other']
            visit_name = str(row['visit_name']).strip()
            if visit_name not in valid_visit_types:
                results["failed"].append({
                    "row": index + 2,
                    "reason": f"无效的随访类型：{visit_name}"
                })
                continue

            # 创建随访记录
            visit_data = {
                "subject_id": subject.id,
                "visit_name": visit_name,
                "visit_date": visit_date,
                "notes": str(row.get('notes', '')) if pd.notna(row.get('notes')) else None,
            }

            db_visit = Visit(**visit_data)
            db.add(db_visit)
            db.commit()

            results["success"].append({
                "row": index + 2,
                "subject_code": subject.subject_code,
                "visit_name": visit_name
            })

        except Exception as e:
            db.rollback()
            results["failed"].append({
                "row": index + 2,
                "reason": str(e)
            })

    return {
        "message": f"导入完成：成功 {len(results['success'])} 条，失败 {len(results['failed'])} 条",
        "success": results["success"],
        "failed": results["failed"]
    }
