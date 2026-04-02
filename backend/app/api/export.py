"""
数据导出 API
"""
import io
import pandas as pd
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.models.tables import AssessmentData, Visit, Subject
from app.api.auth import get_current_active_user

router = APIRouter()


@router.get("/export/csv")
async def export_csv(
    subject_codes: Optional[str] = Query(None, description="逗号分隔的受试者编码"),
    visit_names: Optional[str] = Query(None, description="逗号分隔的随访名称"),
    assessment_types: Optional[str] = Query(None, description="逗号分隔的检查类型"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """导出 CSV 格式数据"""
    # 构建查询
    query = db.query(
        Subject.subject_code,
        Subject.name_pinyin,
        Subject.gender,
        Visit.visit_name,
        Visit.visit_date,
        AssessmentData.assessment_type,
        AssessmentData.extracted_data,
        AssessmentData.is_verified,
    ).join(Visit).join(Subject)

    # 应用筛选
    if subject_codes:
        codes = [c.strip() for c in subject_codes.split(',')]
        query = query.filter(Subject.subject_code.in_(codes))
    if visit_names:
        names = [n.strip() for n in visit_names.split(',')]
        query = query.filter(Visit.visit_name.in_(names))
    if assessment_types:
        types = [t.strip() for t in assessment_types.split(',')]
        query = query.filter(AssessmentData.assessment_type.in_(types))

    # 只导出已审核的数据
    query = query.filter(AssessmentData.is_verified == True)

    results = query.all()

    if not results:
        raise HTTPException(status_code=404, detail="没有符合条件的数据")

    # 展开 JSONB 数据为宽表
    all_rows = []
    for row in results:
        base_row = {
            'subject_code': row.subject_code,
            'name_pinyin': row.name_pinyin,
            'gender': row.gender,
            'visit_name': row.visit_name,
            'visit_date': row.visit_date,
            'assessment_type': row.assessment_type,
            'is_verified': row.is_verified,
        }
        # 展开 extracted_data
        for key, value in row.extracted_data.items():
            base_row[f"{row.assessment_type}_{key}"] = value
        all_rows.append(base_row)

    # 创建 DataFrame
    df = pd.DataFrame(all_rows)

    # 转换为 CSV
    stream = io.StringIO()
    df.to_csv(stream, index=False, encoding='utf-8-sig')
    stream.seek(0)

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cohort_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/export/excel")
async def export_excel(
    subject_codes: Optional[str] = Query(None),
    visit_names: Optional[str] = Query(None),
    assessment_types: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """导出 Excel 格式数据"""
    # 构建查询（与 CSV 导出相同）
    query = db.query(
        Subject.subject_code,
        Subject.name_pinyin,
        Subject.gender,
        Visit.visit_name,
        Visit.visit_date,
        AssessmentData.assessment_type,
        AssessmentData.extracted_data,
        AssessmentData.is_verified,
    ).join(Visit).join(Subject)

    if subject_codes:
        codes = [c.strip() for c in subject_codes.split(',')]
        query = query.filter(Subject.subject_code.in_(codes))
    if visit_names:
        names = [n.strip() for n in visit_names.split(',')]
        query = query.filter(Visit.visit_name.in_(names))
    if assessment_types:
        types = [t.strip() for t in assessment_types.split(',')]
        query = query.filter(AssessmentData.assessment_type.in_(types))

    query = query.filter(AssessmentData.is_verified == True)
    results = query.all()

    if not results:
        raise HTTPException(status_code=404, detail="没有符合条件的数据")

    # 展开 JSONB 数据为宽表
    all_rows = []
    for row in results:
        base_row = {
            'subject_code': row.subject_code,
            'name_pinyin': row.name_pinyin,
            'gender': row.gender,
            'visit_name': row.visit_name,
            'visit_date': row.visit_date,
            'assessment_type': row.assessment_type,
            'is_verified': row.is_verified,
        }
        for key, value in row.extracted_data.items():
            base_row[f"{row.assessment_type}_{key}"] = value
        all_rows.append(base_row)

    df = pd.DataFrame(all_rows)

    # 转换为 Excel
    stream = io.BytesIO()
    with pd.ExcelWriter(stream, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Cohort Data')
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=cohort_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
    )


@router.get("/wide-table")
async def get_wide_table(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取大宽表视图（用于前端数据表格展示）"""
    # 获取所有已审核的数据
    results = db.query(
        Subject.subject_code,
        Subject.name_pinyin,
        Subject.gender,
        Visit.visit_name,
        Visit.visit_date,
        AssessmentData.assessment_type,
        AssessmentData.extracted_data,
    ).join(Visit).join(Subject).filter(
        AssessmentData.is_verified == True
    ).all()

    # 构建宽表
    wide_data = {}
    for row in results:
        key = (row.subject_code, row.visit_name)
        if key not in wide_data:
            wide_data[key] = {
                'subject_code': row.subject_code,
                'name_pinyin': row.name_pinyin,
                'gender': row.gender,
                'visit_name': row.visit_name,
                'visit_date': row.visit_date.isoformat() if row.visit_date else None,
            }

        # 合并提取的数据
        for k, v in row.extracted_data.items():
            col_name = f"{row.assessment_type}_{k}"
            wide_data[key][col_name] = v

    return {
        "columns": list(wide_data.values()[0].keys()) if wide_data else [],
        "data": list(wide_data.values())
    }
