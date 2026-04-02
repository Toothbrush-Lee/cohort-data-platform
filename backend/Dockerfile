# Backend Dockerfile

# 基础镜像
FROM python:3.12-slim AS base

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
RUN pip install uv

# 开发环境
FROM base AS development

# 复制项目文件
COPY pyproject.toml uv.lock* ./

# 安装依赖
RUN uv sync --frozen

# 复制应用代码
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# 生产环境
FROM base AS production

# 复制项目文件
COPY pyproject.toml uv.lock* ./

# 仅安装生产依赖
RUN uv sync --frozen --no-dev

# 复制应用代码
COPY . .

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# 使用多进程启动
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
