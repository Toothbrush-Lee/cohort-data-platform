#!/bin/bash

# 队列研究多模态数据中台 - Docker 启动脚本

set -e

echo "🚀 队列研究多模态数据中台 - Docker 启动"
echo ""

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker/OrbStack"
    exit 1
fi

# 检查 .env.docker 是否存在
if [ ! -f .env.docker ]; then
    echo "⚠️  .env.docker 不存在，从模板创建..."
    cp .env.docker.example .env.docker
    echo "请编辑 .env.docker 配置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY"
    exit 1
fi

# 启动容器
echo "📦 启动 Docker 容器..."
docker-compose up -d

# 等待服务就绪
echo ""
echo "⏳ 等待服务启动..."

# 等待 PostgreSQL
echo "  - 等待 PostgreSQL..."
until docker exec cohort-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
echo "  ✓ PostgreSQL 就绪"

# 等待后端
echo "  - 等待后端 API..."
until curl -s http://localhost:8000/health > /dev/null 2>&1; do
    sleep 2
done
echo "  ✓ 后端 API 就绪"

echo ""
echo "✅ 所有服务启动成功！"
echo ""
echo "📍 访问地址:"
echo "   前端：http://localhost:3000"
echo "   后端 API 文档：http://localhost:8000/api/v1/docs"
echo ""
echo "📋 常用命令:"
echo "   docker-compose logs -f        # 查看所有日志"
echo "   docker-compose logs backend   # 查看后端日志"
echo "   docker-compose logs frontend  # 查看前端日志"
echo "   docker-compose down           # 停止所有容器"
echo "   docker-compose restart        # 重启容器"
echo ""
