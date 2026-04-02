"""
应用配置管理
"""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "队列研究多模态数据中台"
    API_V1_PREFIX: str = "/api/v1"

    # CORS 配置
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
    ]

    # 数据库配置
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/cohort_db"

    # 文件存储配置
    STORAGE_TYPE: str = "local"  # local | s3 | minio
    LOCAL_STORAGE_PATH: str = "./data/storage"

    # S3/OSS 配置
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_S3_ENDPOINT_URL: str = ""  # MinIO 使用时配置此项

    # AI 模型配置
    # 提供商选择：anthropic | openai | deepseek | moonshot | aliyun | siliconflow
    LLM_PROVIDER: str = "anthropic"

    # Anthropic (Claude) - 官方 API
    ANTHROPIC_API_KEY: str = ""

    # OpenAI (GPT-4o) - 官方 API
    OPENAI_API_KEY: str = ""

    # DeepSeek (深度求索) - 国内，兼容 OpenAI 格式
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"

    # Moonshot (Kimi/月之暗面) - 国内，兼容 OpenAI 格式
    MOONSHOT_API_KEY: str = ""
    MOONSHOT_BASE_URL: str = "https://api.moonshot.cn"

    # 阿里云 (通义千问) - 兼容 OpenAI 格式
    ALIYUN_API_KEY: str = ""
    ALIYUN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # SiliconFlow (硅基流动) - 国内，兼容 OpenAI 格式
    SILICONFLOW_API_KEY: str = ""
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn"

    # 自定义 API 配置（可用于其他兼容 OpenAI 格式的服务）
    CUSTOM_API_KEY: str = ""
    CUSTOM_BASE_URL: str = ""
    CUSTOM_MODEL_NAME: str = ""

    # 模型配置
    # Anthropic 模型
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    # OpenAI 模型
    OPENAI_MODEL: str = "gpt-4o"
    # DeepSeek 模型
    DEEPSEEK_MODEL: str = "deepseek-chat"
    # Moonshot 模型
    MOONSHOT_MODEL: str = "moonshot-v1-8k"
    # 阿里云模型
    ALIYUN_MODEL: str = "qwen-plus"
    # SiliconFlow 模型
    SILICONFLOW_MODEL: str = "Qwen/Qwen2.5-VL-72B-Instruct"
    # 自定义模型
    CUSTOM_MODEL: str = ""

    # JWT 配置
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 小时

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
