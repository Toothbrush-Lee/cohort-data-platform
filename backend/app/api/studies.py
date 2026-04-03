"""
研究管理 API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.models.tables import Study, StudyMember, Subject, AssessmentTemplate, User
from app.schemas.schemas import StudyCreate, StudyUpdate, StudyResponse, StudyMemberCreate, StudyMemberResponse
from app.api.auth import get_current_user, get_current_admin_user

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


@router.post("/", response_model=StudyResponse)
async def create_study(
    study: StudyCreate,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """创建新研究（仅管理员）"""
    # 检查 code 是否已存在
    existing = db.query(Study).filter(Study.code == study.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="研究编码已存在")

    db_study = Study(
        name=study.name,
        code=study.code,
        description=study.description,
        visit_types=study.visit_types or {
            "Baseline": "基线",
            "V1": "1 月",
            "V3": "3 月",
            "V6": "6 月",
            "V12": "12 月",
            "Other": "其他"
        },
        is_active=study.is_active,
    )
    db.add(db_study)
    db.commit()
    db.refresh(db_study)

    # 创建者自动成为研究管理员
    db.add(StudyMember(
        study_id=db_study.id,
        user_id=current_user.id,
        role="admin"
    ))
    db.commit()

    return db_study


@router.get("/", response_model=List[StudyResponse])
async def list_studies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取我有权限访问的研究列表"""
    # 如果是管理员，返回所有研究；否则只返回有权限的研究
    if current_user.role == "admin":
        query = db.query(Study)
    else:
        query = db.query(Study).join(StudyMember).filter(StudyMember.user_id == current_user.id)

    query = query.filter(Study.is_active == True)

    studies = query.offset(skip).limit(limit).all()
    return studies


@router.get("/my", response_model=List[StudyResponse])
async def list_my_studies(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取我参与的研究列表（带详细信息）"""
    query = db.query(Study).join(StudyMember).filter(
        StudyMember.user_id == current_user.id,
        Study.is_active == True
    )

    # 计算受试者数量
    results = []
    for study in query.all():
        subject_count = db.query(Subject).filter(Subject.study_id == study.id).count()
        member_count = db.query(StudyMember).filter(StudyMember.study_id == study.id).count()
        study_dict = {
            "id": study.id,
            "name": study.name,
            "code": study.code,
            "description": study.description,
            "visit_types": study.visit_types,
            "is_active": study.is_active,
            "created_at": study.created_at,
            "updated_at": study.updated_at,
            "subject_count": subject_count,
            "member_count": member_count,
        }
        results.append(study_dict)

    return results


@router.get("/{study_id}", response_model=StudyResponse)
async def get_study(
    study_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取研究详情"""
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="研究不存在")

    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    subject_count = db.query(Subject).filter(Subject.study_id == study_id).count()
    member_count = db.query(StudyMember).filter(StudyMember.study_id == study_id).count()

    return {
        "id": study.id,
        "name": study.name,
        "code": study.code,
        "description": study.description,
        "visit_types": study.visit_types,
        "is_active": study.is_active,
        "created_at": study.created_at,
        "updated_at": study.updated_at,
        "subject_count": subject_count,
        "member_count": member_count,
    }


@router.put("/{study_id}", response_model=StudyResponse)
async def update_study(
    study_id: int,
    study_update: StudyUpdate,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """更新研究配置（仅管理员）"""
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="研究不存在")

    update_data = study_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(study, key, value)

    db.commit()
    db.refresh(study)
    return study


@router.delete("/{study_id}")
async def delete_study(
    study_id: int,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """删除研究（仅管理员，软删除改为 is_active=False）"""
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="研究不存在")

    study.is_active = False
    db.commit()
    return {"message": "研究已停用"}


# ============== Study Member Management ==============

@router.get("/{study_id}/members", response_model=List[StudyMemberResponse])
async def list_study_members(
    study_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取研究成员列表"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    members = db.query(StudyMember).filter(StudyMember.study_id == study_id).all()
    result = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        result.append({
            "id": member.id,
            "study_id": member.study_id,
            "user_id": member.user_id,
            "role": member.role,
            "created_at": member.created_at,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            } if user else None
        })
    return result


@router.post("/{study_id}/members", response_model=StudyMemberResponse)
async def add_study_member(
    study_id: int,
    member: StudyMemberCreate,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """添加研究成员（仅管理员）"""
    # 检查研究是否存在
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="研究不存在")

    # 检查用户是否存在
    user = db.query(User).filter(User.id == member.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查是否已存在
    existing = db.query(StudyMember).filter(
        StudyMember.study_id == study_id,
        StudyMember.user_id == member.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户已在研究中")

    db_member = StudyMember(
        study_id=study_id,
        user_id=member.user_id,
        role=member.role,
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)

    return db_member


@router.put("/{study_id}/members/{user_id}", response_model=StudyMemberResponse)
async def update_study_member(
    study_id: int,
    user_id: int,
    role: str,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """更新研究成员角色（仅管理员）"""
    member = db.query(StudyMember).filter(
        StudyMember.study_id == study_id,
        StudyMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    member.role = role
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{study_id}/members/{user_id}")
async def remove_study_member(
    study_id: int,
    user_id: int,
    db: Session = Depends(get_current_admin_user),
    current_user = Depends(get_current_user)
):
    """移除研究成员（仅管理员）"""
    member = db.query(StudyMember).filter(
        StudyMember.study_id == study_id,
        StudyMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    db.delete(member)
    db.commit()
    return {"message": "成员已移除"}
