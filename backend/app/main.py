"""
队列研究多模态数据中台 - FastAPI 主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import subjects, visits, files, assessments, export, auth, templates, users

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="队列研究多模态数据中台 API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(subjects.router, prefix="/api/v1/subjects", tags=["受试者管理"])
app.include_router(visits.router, prefix="/api/v1/visits", tags=["随访管理"])
app.include_router(files.router, prefix="/api/v1/files", tags=["文件管理"])
app.include_router(assessments.router, prefix="/api/v1/assessments", tags=["检查数据管理"])
app.include_router(export.router, prefix="/api/v1/export", tags=["数据导出"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["检测模板"])
app.include_router(users.router, prefix="/api/v1/users", tags=["用户管理"])


@app.get("/")
async def root():
    return {"message": "欢迎使用队列研究多模态数据中台 API", "docs": "/api/v1/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
