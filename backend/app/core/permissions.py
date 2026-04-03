"""
Permission utilities for study-level access control
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.tables import StudyMember, User, Visit, Subject


def get_study_member_or_403(study_id: int, user: User, db: Session) -> StudyMember:
    """检查用户是否有权限访问研究"""
    member = db.query(StudyMember).filter(
        StudyMember.study_id == study_id,
        StudyMember.user_id == user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="无权访问该研究")
    return member


def get_study_id_from_visit(visit_id: int, db: Session) -> int:
    """从随访 ID 获取研究 ID"""
    visit = db.query(Visit).join(Subject).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="随访记录不存在")
    return visit.subject.study_id
