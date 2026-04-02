"""
Pydantic Schemas 定义
"""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field


# ============== User Schemas ==============
class UserBase(BaseModel):
    username: str
    email: str
    role: str = "analyst"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============== Subject Schemas ==============
class SubjectBase(BaseModel):
    subject_code: str
    name_pinyin: str
    gender: str
    birth_date: datetime
    enrollment_date: Optional[datetime] = None
    notes: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name_pinyin: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    enrollment_date: Optional[datetime] = None
    notes: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    visit_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============== Visit Schemas ==============
class VisitBase(BaseModel):
    visit_name: str
    visit_date: datetime
    notes: Optional[str] = None


class VisitCreate(VisitBase):
    subject_id: int


class VisitUpdate(BaseModel):
    visit_name: Optional[str] = None
    visit_date: Optional[datetime] = None
    notes: Optional[str] = None


class VisitResponse(VisitBase):
    id: int
    subject_id: int
    subject_code: str
    created_at: datetime
    file_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============== RawFile Schemas ==============
class RawFileBase(BaseModel):
    file_type: str
    original_filename: str


class RawFileCreate(RawFileBase):
    visit_id: int


class RawFileUpdate(BaseModel):
    file_type: Optional[str] = None
    status: Optional[str] = None
    verified_by: Optional[int] = None


class RawFileResponse(RawFileBase):
    id: int
    visit_id: int
    stored_filename: str
    oss_url: str
    file_size: Optional[int]
    mime_type: Optional[str]
    status: str
    uploaded_by: Optional[int]
    verified_by: Optional[int]
    uploaded_at: datetime
    verified_at: Optional[datetime]
    ai_extracted_data: Optional[dict] = None  # AI 提取的草稿数据

    model_config = ConfigDict(from_attributes=True)


# ============== AssessmentData Schemas ==============
class AssessmentDataBase(BaseModel):
    assessment_type: str
    extracted_data: dict[str, Any]
    is_verified: bool = False
    sample_time: Optional[datetime] = None


class AssessmentDataCreate(AssessmentDataBase):
    visit_id: int
    file_id: Optional[int] = None


class AssessmentDataUpdate(BaseModel):
    extracted_data: Optional[dict[str, Any]] = None
    is_verified: Optional[bool] = None
    verified_by: Optional[int] = None


class AssessmentDataResponse(AssessmentDataBase):
    id: int
    visit_id: int
    file_id: Optional[int]
    verified_at: Optional[datetime]
    verified_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============== File Upload Schemas ==============
class FileUploadResponse(BaseModel):
    file_id: int
    original_filename: str
    file_type: str
    status: str
    message: str


# ============== Export Schemas ==============
class ExportRequest(BaseModel):
    subject_codes: Optional[list[str]] = None
    visit_names: Optional[list[str]] = None
    assessment_types: Optional[list[str]] = None
    format: str = "csv"  # csv | excel | parquet


# ============== Auth Schemas ==============
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str
