#!/bin/bash
set -e

# 检查后端
echo "检查后端服务..."
if ! curl -sf http://localhost:8000/health > /dev/null; then
    echo "❌ 后端健康检查失败"
    exit 1
fi
echo "✓ 后端服务正常"

# 检查前端
echo "检查前端服务..."
if ! curl -sf http://localhost:3000 > /dev/null; then
    echo "❌ 前端健康检查失败"
    exit 1
fi
echo "✓ 前端服务正常"

# 检查数据库
echo "检查数据库..."
if ! docker compose exec -T postgres pg_isready -U postgres > /dev/null; then
    echo "❌ 数据库健康检查失败"
    exit 1
fi
echo "✓ 数据库服务正常"

echo ""
echo "所有健康检查通过 ✓"
exit 0
