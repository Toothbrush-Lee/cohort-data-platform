"""
受试者管理 API（研究级）
"""
from typing import List, Optional
from datetime import datetime
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd

from app.core.database import get_db
from app.models.tables import Subject, Visit, Study, StudyMember, User
from app.schemas.schemas import SubjectCreate, SubjectUpdate, SubjectResponse
from app.api.auth import get_current_active_user

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


@router.post("/", response_model=SubjectResponse)
async def create_subject(
    subject: SubjectCreate,
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """创建新的受试者"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    # 检查编码是否已存在（在同一研究中）
    existing = db.query(Subject).filter(
        Subject.study_id == study_id,
        Subject.subject_code == subject.subject_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="受试者编码已存在")

    db_subject = Subject(
        study_id=study_id,
        **subject.model_dump()
    )
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.get("/", response_model=List[SubjectResponse])
async def list_subjects(
    study_id: int = Query(..., description="研究 ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取受试者列表"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    query = db.query(Subject).filter(Subject.study_id == study_id)

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

    # 检查权限
    _get_study_member_or_403(subject.study_id, current_user, db)

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

    # 检查权限
    _get_study_member_or_403(db_subject.study_id, current_user, db)

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

    # 检查权限
    _get_study_member_or_403(db_subject.study_id, current_user, db)

    db.delete(db_subject)
    db.commit()
    return {"message": "受试者已删除"}


@router.post("/import/excel")
async def import_subjects_from_excel(
    file: UploadFile = File(...),
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """从 Excel 文件批量导入受试者

    Excel 格式要求:
    - subject_code: 受试者编号 (必填)
    - name_pinyin: 姓名拼音 (必填)
    - gender: 性别 (男/女，默认男)
    - birth_date: 出生日期 (YYYY-MM-DD)
    - enrollment_date: 入组日期 (YYYY-MM-DD)
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
    required_columns = ['subject_code', 'name_pinyin']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Excel 缺少必要的列：{', '.join(missing_columns)}")

    # 批量导入
    results = {"success": [], "failed": []}

    for index, row in df.iterrows():
        try:
            # 检查受试者编码是否已存在
            existing = db.query(Subject).filter(
                Subject.study_id == study_id,
                Subject.subject_code == str(row['subject_code'])
            ).first()
            if existing:
                results["failed"].append({
                    "row": index + 2,  # Excel 行号（从 1 开始，加上表头）
                    "reason": f"受试者编码已存在：{row['subject_code']}"
                })
                continue

            # 解析日期
            birth_date = None
            enrollment_date = None

            if pd.notna(row.get('birth_date')):
                if isinstance(row['birth_date'], datetime):
                    birth_date = row['birth_date'].strftime('%Y-%m-%d')
                else:
                    birth_date = str(row['birth_date'])

            if pd.notna(row.get('enrollment_date')):
                if isinstance(row['enrollment_date'], datetime):
                    enrollment_date = row['enrollment_date'].strftime('%Y-%m-%d')
                else:
                    enrollment_date = str(row['enrollment_date'])

            # 创建受试者
            subject_data = {
                "study_id": study_id,
                "subject_code": str(row['subject_code']),
                "name_pinyin": str(row['name_pinyin']),
                "gender": str(row.get('gender', '男')),
                "birth_date": birth_date,
                "enrollment_date": enrollment_date,
                "notes": str(row.get('notes', '')) if pd.notna(row.get('notes')) else None,
            }

            db_subject = Subject(**subject_data)
            db.add(db_subject)
            db.commit()

            results["success"].append({
                "row": index + 2,
                "subject_code": subject_data["subject_code"]
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
