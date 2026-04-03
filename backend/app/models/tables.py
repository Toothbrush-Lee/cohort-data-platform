"""
数据库模型定义

核心业务逻辑：
所有数据必须挂载在以下层级之下，避免数据孤岛：
研究 (Study) -> 受试者 (Subject) -> 随访波次 (Visit) -> 检查项目 (Assessment) -> 数据负载 (Payload)
"""
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    DateTime,
    Boolean,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
import enum

from app.core.database import Base


class VisitType(str, enum.Enum):
    """随访类型枚举"""
    BASELINE = "Baseline"  # 基线
    V1 = "V1"  # 第一次随访
    V2 = "V2"
    V3 = "V3"
    V6 = "V6"
    V12 = "V12"
    OTHER = "Other"


class FileType(str, enum.Enum):
    """文件类型枚举"""
    ENDO_PAT = "EndoPAT"  # RHI 检测
    TCD = "TCD"  # 经颅多普勒
    VICORDER = "Vicorder"  # PWV 检测
    BLOOD_TEST = "BloodTest"  # 血检报告
    CGM = "CGM"  # 连续血糖监测
    WEARABLE = "Wearable"  # 其他可穿戴设备


class FileStatus(str, enum.Enum):
    """文件状态枚举"""
    UPLOADED = "uploaded"  # 已上传
    PROCESSING = "processing"  # 解析中
    PENDING_REVIEW = "pending_review"  # 待审核
    VERIFIED = "verified"  # 已入库
    REJECTED = "rejected"  # 已驳回


class Study(Base):
    """研究表 - 多队列研究的核心容器"""
    __tablename__ = "studies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # 研究名称（如"队列 A"）
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # 研究编码（如"COHORT_A"）
    description: Mapped[str] = mapped_column(Text, nullable=True)  # 研究描述
    visit_types: Mapped[dict] = mapped_column(JSONB, default=lambda: {
        "Baseline": "基线",
        "V1": "1 月",
        "V3": "3 月",
        "V6": "6 月",
        "V12": "12 月",
        "Other": "其他"
    })  # 随访类型配置
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # 是否启用
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    subjects = relationship("Subject", back_populates="study", cascade="all, delete-orphan")
    templates = relationship("AssessmentTemplate", back_populates="study", cascade="all, delete-orphan")
    members = relationship("StudyMember", back_populates="study", cascade="all, delete-orphan")


class StudyMember(Base):
    """研究成员表 - 用户与研究的关联（多对多）"""
    __tablename__ = "study_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    study_id: Mapped[int] = mapped_column(Integer, ForeignKey("studies.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="analyst")  # 研究内的角色
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系
    study = relationship("Study", back_populates="members")
    user = relationship("User")


class User(Base):
    """用户表 - 支持 RBAC 权限控制"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="analyst")  # admin, clerk, analyst, reviewer
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 关系
    uploaded_files = relationship("RawFile", back_populates="uploaded_by_user", foreign_keys="RawFile.uploaded_by")
    verified_files = relationship("RawFile", back_populates="verified_by_user", foreign_keys="RawFile.verified_by")
    study_memberships = relationship("StudyMember", back_populates="user")


class Subject(Base):
    """受试者表"""
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    study_id: Mapped[int] = mapped_column(Integer, ForeignKey("studies.id"), nullable=False)
    subject_code: Mapped[str] = mapped_column(String(50), index=True)  # 受试者编码（研究内唯一）
    name_pinyin: Mapped[str] = mapped_column(String(100))  # 姓名拼音缩写
    gender: Mapped[str] = mapped_column(String(10))  # 男/女
    birth_date: Mapped[datetime] = mapped_column(DateTime)
    enrollment_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    study = relationship("Study", back_populates="subjects")
    visits = relationship("Visit", back_populates="subject", cascade="all, delete-orphan", order_by="Visit.visit_date")

    # 唯一约束：study_id + subject_code 组合唯一
    __table_args__ = (
        # 组合唯一约束在 alembic 迁移中定义
    )


class Visit(Base):
    """随访记录表"""
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    visit_name: Mapped[str] = mapped_column(String(50))  # Baseline, V1, V2, etc.
    visit_date: Mapped[datetime] = mapped_column(DateTime)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系
    subject = relationship("Subject", back_populates="visits")
    files = relationship("RawFile", back_populates="visit", cascade="all, delete-orphan")
    assessments = relationship("AssessmentData", back_populates="visit", cascade="all, delete-orphan")


class RawFile(Base):
    """原始文件表"""
    __tablename__ = "raw_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    visit_id: Mapped[int] = mapped_column(Integer, ForeignKey("visits.id"), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50))  # EndoPAT, TCD, etc.
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255))  # OSS 存储文件名
    oss_url: Mapped[str] = mapped_column(String(500))  # 存储路径/URL
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    verified_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_extracted_data: Mapped[dict] = mapped_column(JSONB, nullable=True)  # AI 提取的草稿数据

    # 关系
    visit = relationship("Visit", back_populates="files")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])
    verified_by_user = relationship("User", foreign_keys=[verified_by])
    assessment = relationship("AssessmentData", back_populates="file", uselist=False, cascade="all, delete-orphan")


class AssessmentData(Base):
    """结构化检查数据表"""
    __tablename__ = "assessment_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    visit_id: Mapped[int] = mapped_column(Integer, ForeignKey("visits.id"), nullable=False)
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("raw_files.id"), nullable=True)
    assessment_type: Mapped[str] = mapped_column(String(50))  # EndoPAT, TCD, Vicorder, BloodTest
    extracted_data: Mapped[dict] = mapped_column(JSONB)  # LLM 提取的键值对
    sample_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)  # 采样时间
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    visit = relationship("Visit", back_populates="assessments")
    file = relationship("RawFile", back_populates="assessment")
    verified_by_user = relationship("User")


class AssessmentTemplate(Base):
    """检测模板表 - 定义每类检测的指标模板（研究级配置）"""
    __tablename__ = "assessment_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    study_id: Mapped[int] = mapped_column(Integer, ForeignKey("studies.id"), nullable=False)
    template_name: Mapped[str] = mapped_column(String(100))  # EndoPAT, TCD, Vicorder, BloodTest
    display_name: Mapped[str] = mapped_column(String(100))  # 中文显示名
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    study = relationship("Study", back_populates="templates")
    fields = relationship("TemplateField", back_populates="template", cascade="all, delete-orphan", order_by="TemplateField.sort_order")


class TemplateField(Base):
    """模板字段表 - 定义模板中的具体指标字段"""
    __tablename__ = "template_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(Integer, ForeignKey("assessment_templates.id"), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100))  # 字段英文名（键名）
    field_label: Mapped[str] = mapped_column(String(100))  # 字段中文名（显示标签）
    field_type: Mapped[str] = mapped_column(String(20), default="number")  # number, text, boolean
    unit: Mapped[str] = mapped_column(String(50), nullable=True)  # 单位
    sort_order: Mapped[int] = mapped_column(Integer, default=0)  # 排序
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    min_value: Mapped[float] = mapped_column(nullable=True)  # 最小值（用于验证）
    max_value: Mapped[float] = mapped_column(nullable=True)  # 最大值（用于验证）
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系
    template = relationship("AssessmentTemplate", back_populates="fields")
