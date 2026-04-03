"""
检测模板管理 API（研究级配置）
"""
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.permissions import get_study_member_or_403
from app.models.tables import AssessmentTemplate, TemplateField, Study, StudyMember, User
from app.api.auth import get_current_active_user


class TemplateFieldCreate(BaseModel):
    """模板字段创建请求"""
    field_name: str
    field_label: str
    field_type: str = "number"
    unit: Optional[str] = None
    sort_order: int = 0
    required: bool = True
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class TemplateFieldUpdate(BaseModel):
    """模板字段更新请求"""
    field_name: Optional[str] = None
    field_label: Optional[str] = None
    field_type: Optional[str] = None
    unit: Optional[str] = None
    sort_order: Optional[int] = None
    required: Optional[bool] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class TemplateFieldResponse(BaseModel):
    """模板字段响应"""
    id: int
    field_name: str
    field_label: str
    field_type: str
    unit: Optional[str]
    sort_order: int
    required: bool
    min_value: Optional[float]
    max_value: Optional[float]

    model_config = ConfigDict(from_attributes=True)


class TemplateCreate(BaseModel):
    """模板创建请求"""
    template_name: str
    display_name: str
    description: Optional[str] = None
    fields: List[TemplateFieldCreate] = []


class TemplateUpdate(BaseModel):
    """模板更新请求"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    fields: Optional[List[TemplateFieldCreate]] = None


class TemplateResponse(BaseModel):
    """模板响应"""
    id: int
    study_id: int
    template_name: str
    display_name: str
    description: Optional[str]
    is_active: bool
    fields: List[TemplateFieldResponse]

    model_config = ConfigDict(from_attributes=True)


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


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    study_id: int = Query(..., description="研究 ID"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取研究下的所有检测模板"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    templates = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.study_id == study_id,
        AssessmentTemplate.is_active == True
    ).offset(skip).limit(limit).all()

    return templates


@router.post("/", response_model=TemplateResponse)
async def create_template(
    template: TemplateCreate,
    study_id: int = Query(..., description="研究 ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """创建研究模板（需要研究权限）"""
    # 检查权限
    member = _get_study_member_or_403(study_id, current_user, db)

    # 检查模板名称是否已存在
    existing = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.study_id == study_id,
        AssessmentTemplate.template_name == template.template_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="模板名称已存在")

    db_template = AssessmentTemplate(
        study_id=study_id,
        template_name=template.template_name,
        display_name=template.display_name,
        description=template.description,
        is_active=True,
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    # 创建字段
    for field_data in template.fields:
        field = TemplateField(
            template_id=db_template.id,
            **field_data.model_dump()
        )
        db.add(field)
    db.commit()
    db.refresh(db_template)

    return db_template


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取模板详情"""
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查权限
    _get_study_member_or_403(template.study_id, current_user, db)

    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_update: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """更新模板（需要研究权限）"""
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查权限
    _get_study_member_or_403(template.study_id, current_user, db)

    update_data = template_update.model_dump(exclude_unset=True, exclude={'fields'})
    for key, value in update_data.items():
        if value is not None:
            setattr(template, key, value)

    # 更新字段
    if template_update.fields is not None:
        # 删除原有字段
        db.query(TemplateField).filter(
            TemplateField.template_id == template_id
        ).delete()

        # 创建新字段
        for field_data in template_update.fields:
            field = TemplateField(
                template_id=template_id,
                **field_data.model_dump()
            )
            db.add(field)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """删除模板（需要研究权限）"""
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查权限
    _get_study_member_or_403(template.study_id, current_user, db)

    db.delete(template)
    db.commit()
    return {"message": "模板已删除"}


@router.post("/{template_id}/fields", response_model=TemplateFieldResponse)
async def add_template_field(
    template_id: int,
    field: TemplateFieldCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """添加模板字段"""
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    # 检查权限
    _get_study_member_or_403(template.study_id, current_user, db)

    db_field = TemplateField(
        template_id=template_id,
        **field.model_dump()
    )
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field


@router.delete("/{template_id}/fields/{field_id}")
async def delete_template_field(
    template_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """删除模板字段"""
    field = db.query(TemplateField).filter(
        TemplateField.id == field_id,
        TemplateField.template_id == template_id
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在")

    # 检查权限
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if template:
        _get_study_member_or_403(template.study_id, current_user, db)

    db.delete(field)
    db.commit()
    return {"message": "字段已删除"}
