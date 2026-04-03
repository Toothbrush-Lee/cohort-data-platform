"""
文件上传与管理 API（研究级）
"""
import os
import uuid
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.core.database import get_db
from app.core.config import settings
from app.models.tables import RawFile, Visit, FileStatus, Subject, Study, StudyMember, User
from app.schemas.schemas import RawFileResponse, FileUploadResponse, RawFileUpdate
from app.api.auth import get_current_active_user
from app.services.ai_extractor import extract_data_from_file

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


def _get_study_id_from_visit(visit_id: int, db: Session) -> int:
    """从随访 ID 获取研究 ID"""
    visit = db.query(Visit).join(Subject).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="随访记录不存在")
    return visit.subject.study_id


def generate_stored_filename(original_filename: str, visit_id: int, file_type: str) -> str:
    """生成存储文件名 - 包含可读信息 + 短 UUID 后缀"""
    import hashlib
    ext = os.path.splitext(original_filename)[1]
    # 使用时间戳 + visit_id + file_type + 短 hash，便于人类识别
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_hash = hashlib.md5(f"{timestamp}{uuid.uuid4()}".encode()).hexdigest()[:8]
    # 清理文件名中的非法字符
    safe_filename = "".join(c if c.isalnum() or c in " -_." else "_" for c in original_filename)[:50]
    return f"{timestamp}_visit{visit_id}_{file_type}_{safe_filename}_{short_hash}{ext}"


def get_file_type_from_filename(filename: str) -> str:
    """根据文件名推断文件类型"""
    filename_lower = filename.lower()
    if 'endo' in filename_lower or 'pat' in filename_lower:
        return 'EndoPAT'
    elif 'tcd' in filename_lower:
        return 'TCD'
    elif 'vicorder' in filename_lower or 'pwv' in filename_lower:
        return 'Vicorder'
    elif 'blood' in filename_lower or 'test' in filename_lower or '血检' in filename:
        return 'BloodTest'
    elif 'glu' in filename_lower or 'cgm' in filename_lower:
        return 'CGM'
    else:
        return 'Wearable'


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    study_id: int = Query(..., description="研究 ID"),
    visit_id: int = Query(...),
    file_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """上传文件并触发 AI 提取"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    # 检查随访是否存在且属于该研究
    visit = db.query(Visit).join(Subject).filter(
        Visit.id == visit_id,
        Subject.study_id == study_id
    ).first()
    if not visit:
        raise HTTPException(status_code=404, detail="随访记录不存在或不属于该研究")

    # 确定文件类型
    if not file_type:
        file_type = get_file_type_from_filename(file.filename)

    # 生成存储文件名
    stored_filename = generate_stored_filename(file.filename, visit_id, file_type)
    storage_path = os.path.join(settings.LOCAL_STORAGE_PATH, stored_filename)

    # 确保存储目录存在
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)

    # 保存文件
    with open(storage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 创建数据库记录
    db_file = RawFile(
        visit_id=visit_id,
        file_type=file_type,
        original_filename=file.filename,
        stored_filename=stored_filename,
        oss_url=storage_path,
        status=FileStatus.PROCESSING,
        uploaded_by=current_user.id,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    # 后台触发 AI 提取
    try:
        # 从数据库获取模板字段（研究级）
        from app.models.tables import AssessmentTemplate, TemplateField
        template = db.query(AssessmentTemplate).filter(
            AssessmentTemplate.study_id == study_id,
            AssessmentTemplate.template_name == file_type
        ).first()
        template_fields = None
        if template:
            fields = db.query(TemplateField).filter(TemplateField.template_id == template.id).all()
            template_fields = [
                {"field_name": f.field_name, "field_label": f.field_label, "field_type": f.field_type}
                for f in fields
            ]
            print(f"使用模板字段：{template_fields}")

        # 使用模板字段进行 AI 提取
        extracted_data = await extract_data_from_file(
            file_path=storage_path,
            file_type=file_type,
            filename=file.filename,
            template_fields=template_fields
        )
        if extracted_data:
            # 将 AI 提取结果存为草稿
            db_file.ai_extracted_data = extracted_data
            db_file.status = FileStatus.PENDING_REVIEW
            print(f"AI 提取成功：{extracted_data}")
        else:
            db_file.status = FileStatus.UPLOADED
    except Exception as e:
        print(f"AI 提取失败：{e}")
        db_file.status = FileStatus.UPLOADED

    db.commit()

    return FileUploadResponse(
        file_id=db_file.id,
        original_filename=file.filename,
        file_type=file_type,
        status=db_file.status,
        message="文件上传成功"
    )


@router.get("/", response_model=List[RawFileResponse])
async def list_files(
    study_id: int = Query(..., description="研究 ID"),
    visit_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取文件列表"""
    # 检查权限
    _get_study_member_or_403(study_id, current_user, db)

    query = db.query(RawFile).join(Visit).join(Subject).filter(
        Subject.study_id == study_id
    )

    if visit_id:
        query = query.filter(RawFile.visit_id == visit_id)
    if status:
        query = query.filter(RawFile.status == status)
    if file_type:
        query = query.filter(RawFile.file_type == file_type)

    files = query.offset(skip).limit(limit).all()
    return files


@router.get("/{file_id}", response_model=RawFileResponse)
async def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """获取文件详情"""
    db_file = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    return db_file


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """下载文件 - 返回规范命名的文件"""
    db_file = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if not os.path.exists(db_file.oss_url):
        raise HTTPException(status_code=404, detail="文件存储已丢失")

    # 使用规范文件名下载（包含时间戳、随访 ID、检测类型等信息）
    return FileResponse(
        db_file.oss_url,
        media_type="application/octet-stream",
        filename=db_file.stored_filename
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """删除文件"""
    db_file = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # 删除存储文件
    if os.path.exists(db_file.oss_url):
        os.remove(db_file.oss_url)

    db.delete(db_file)
    db.commit()
    return {"message": "文件已删除"}


class ConfirmRequest(BaseModel):
    ai_extracted_data: dict


@router.post("/{file_id}/confirm")
async def confirm_ai_data(
    file_id: int,
    request: ConfirmRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """确认 AI 提取的数据并创建正式记录"""
    db_file = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # 使用请求中的数据，如果没有则使用数据库中的
    extracted_data = request.ai_extracted_data if request.ai_extracted_data else db_file.ai_extracted_data

    if not extracted_data:
        raise HTTPException(status_code=400, detail="没有 AI 提取的数据")

    # 创建 AssessmentData 记录
    from app.models.tables import AssessmentData
    assessment = AssessmentData(
        visit_id=db_file.visit_id,
        file_id=db_file.id,
        assessment_type=db_file.file_type,
        extracted_data=extracted_data,
        is_verified=False,
        sample_time=extracted_data.get('test_date') or extracted_data.get('sample_time')
    )
    db.add(assessment)

    # 更新文件状态和 AI 数据
    db_file.ai_extracted_data = extracted_data
    db_file.status = FileStatus.VERIFIED
    db.commit()
    db.refresh(assessment)

    return {
        "message": "数据已确认入库",
        "assessment_id": assessment.id,
        "data": assessment.extracted_data
    }


@router.patch("/{file_id}/ai_data")
async def update_ai_data(
    file_id: int,
    ai_extracted_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """更新 AI 提取的数据（用户在界面上编辑草稿数据）"""
    db_file = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    db_file.ai_extracted_data = ai_extracted_data
    db.commit()
    db.refresh(db_file)

    return {
        "message": "AI 提取数据已更新",
        "data": db_file.ai_extracted_data
    }
