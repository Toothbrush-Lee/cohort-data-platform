"""
检测模板管理 API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tables import AssessmentTemplate, TemplateField
from app.api.auth import get_current_active_user


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


class TemplateResponse(BaseModel):
    """模板响应"""
    id: int
    template_name: str
    display_name: str
    description: Optional[str]
    is_active: bool
    fields: List[TemplateFieldResponse]

    model_config = ConfigDict(from_attributes=True)


router = APIRouter()


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取所有检测模板"""
    templates = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.is_active == True
    ).offset(skip).limit(limit).all()

    return templates


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

    return template
