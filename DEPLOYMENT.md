# 队列研究数据中台 - Docker 部署文档

> 本项目采用 Docker 容器化部署，支持开发环境和生产环境两种模式。

## 目录

1. [架构概述](#架构概述)
2. [前置要求](#前置要求)
3. [快速开始 (开发环境)](#快速开始 - 开发环境)
4. [生产环境部署](#生产环境部署)
5. [服务说明](#服务说明)
6. [数据持久化](#数据持久化)
7. [网络安全](#网络安全)
8. [运维管理](#运维管理)
9. [监控与日志](#监控与日志)
10. [备份恢复](#备份恢复)

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Docker Compose                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │ Frontend │  │ Backend  │  │   PostgreSQL     │  │   │
│  │  │  :3000   │  │  :8000   │  │     :5432        │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │   │
│  │       │             │                 │            │   │
│  │       └─────────────┴─────────────────┘            │   │
│  │                       │                            │   │
│  │       ┌───────────────▼───────────────┐            │   │
│  │       │      Docker Volumes           │            │   │
│  │       │  - pgdata (数据库)            │            │   │
│  │       │  - storage (文件存储)         │            │   │
│  │       └───────────────────────────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**生产环境 additionally 包含 Nginx 反向代理**

---

## 前置要求

### 硬件要求
- CPU: 2 核 (推荐 4 核)
- 内存：4GB (推荐 8GB)
- 存储：50GB SSD (推荐 100GB)

### 软件要求
- Docker Engine 24.0+
- Docker Compose v2.20+
- Git

### 检查安装
```bash
docker --version
docker compose version
```

### 安装 Docker (如未安装)
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 或者使用官方脚本
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

---

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url> cohort-data-platform
cd cohort-data-platform
```

### 2. 复制并配置环境变量
```bash
# 复制 Docker 环境配置
cp .env.docker.example .env.docker

# 编辑配置 (必须修改)
vim .env.docker
```

### 3. 修改必要配置

**必须修改的配置项：**
```bash
# JWT 密钥 (生产环境必须修改)
JWT_SECRET=<生成一个随机字符串>

# AI API Key (至少配置一个)
ALIYUN_API_KEY=your-api-key

# 数据库密码 (生产环境必须修改)
# 在 docker-compose.yml 中修改 POSTGRES_PASSWORD
```

生成 JWT 密钥：
```bash
openssl rand -hex 32
```

### 4. 启动服务
```bash
# 构建并启动所有服务
docker compose up -d --build

# 查看日志
docker compose logs -f

# 检查服务状态
docker compose ps
```

### 5. 运行数据库迁移
```bash
# 等待数据库启动后
docker compose exec backend uv run alembic upgrade head
```

### 6. 创建管理员用户
```bash
docker compose exec backend python << 'EOF'
from app.core.database import SessionLocal
from app.core.security import create_password_hash
from app.models.tables import User

db = SessionLocal()
user = User(
    username='admin',
    email='admin@example.com',
    hashed_password=create_password_hash('Admin@123456'),
    role='admin',
    is_active=True
)
db.add(user)
db.commit()
db.close()
print('管理员创建成功')
EOF
```

### 7. 访问应用
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

---

## 生产环境部署

项目已包含完整的生产环境配置：

| 文件 | 说明 |
|------|------|
| `docker-compose.prod.yml` | 生产环境 Docker Compose 配置 |
| `nginx/nginx.conf` | Nginx 反向代理配置 |

### 1. 配置 SSL 证书

```bash
# 创建 SSL 目录
mkdir -p nginx/ssl

# 放入 SSL 证书
# - fullchain.pem (证书链)
# - privkey.pem (私钥)

# 如果使用 Let's Encrypt:
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

### 2. 启动生产环境

```bash
# 使用生产配置启动
docker compose -f docker-compose.prod.yml up -d --build

# 查看状态
docker compose -f docker-compose.prod.yml ps
```

### 3. 运行数据库迁移

```bash
docker compose -f docker-compose.prod.yml exec backend uv run alembic upgrade head
```

### 4. 创建管理员用户

```bash
docker compose -f docker-compose.prod.yml exec backend python << 'EOF'
from app.core.database import SessionLocal
from app.core.security import create_password_hash
from app.models.tables import User

db = SessionLocal()
user = User(
    username='admin',
    email='admin@example.com',
    hashed_password=create_password_hash('Admin@123456'),
    role='admin',
    is_active=True
)
db.add(user)
db.commit()
db.close()
print('管理员创建成功')
EOF
```

### 5. 访问应用

- 前端：https://your-domain.com
- API 文档：https://your-domain.com/api/v1/docs

---

## 服务说明

### PostgreSQL

| 配置项 | 开发环境默认值 | 生产环境默认值 | 说明 |
|--------|---------------|---------------|------|
| 端口 | 5432 (暴露) | 不暴露 | 生产环境仅内部访问 |
| 数据卷 | pgdata | pgdata | 持久化存储 |
| 用户 | postgres | cohort_admin | 开发环境使用 postgres |
| 密码 | postgres | changeit | **生产环境必须修改** |

### Backend (FastAPI)
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 端口 | 8000 | 通过 Nginx 代理 |
| 工作进程 | 4 | 根据 CPU 调整 |
| 数据卷 | storage | 存储上传的文件 |
| 依赖 | postgres | 健康检查通过后启动 |

### Frontend (Next.js)
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 端口 | 3000 | 通过 Nginx 代理 |
| 模式 | production | 使用 runner 镜像 |
| 依赖 | backend | 等待后端启动 |

### Nginx
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| HTTP 端口 | 80 | 重定向到 HTTPS |
| HTTPS 端口 | 443 | 主访问入口 |
| SSL 证书 | nginx/ssl/ | 需要自行配置 |

---

## 数据持久化

### Docker Volumes
```bash
# 查看数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect cohort-data-platform_pgdata
docker volume inspect cohort-data-platform_storage
```

### 数据位置
- PostgreSQL 数据：`/var/lib/docker/volumes/cohort-data-platform_pgdata/_data`
- 文件存储：`/var/lib/docker/volumes/cohort-data-platform_storage/_data`

### 备份数据卷
```bash
# 备份数据库
docker run --rm \
  -v cohort-data-platform_pgdata:/data \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/pgdata_$(date +%Y%m%d).tar.gz /data

# 备份文件存储
docker run --rm \
  -v cohort-data-platform_storage:/data \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/storage_$(date +%Y%m%d).tar.gz /data
```

---

## 网络安全

### 1. 防火墙配置
```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS/RHEL (Firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. Docker 网络安全
```bash
# 查看网络
docker network ls

# 网络详情
docker network inspect cohort-data-platform_cohort-network
```

### 3. SSL 证书配置

使用 Let's Encrypt (免费)：
```bash
# 安装 certbot
sudo apt install -y certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到 nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/

# 设置权限
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 600 nginx/ssl/privkey.pem

# 重启 nginx
docker compose exec nginx nginx -s reload
```

自动续期：
```bash
# 添加 cron 任务
(crontab -l 2>/dev/null; echo "0 2 * * 1 certbot renew --quiet && docker compose exec nginx nginx -s reload") | crontab -
```

---

## 运维管理

### 常用命令

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启服务
docker compose restart

# 重启单个服务
docker compose restart backend

# 查看日志
docker compose logs -f
docker compose logs -f backend

# 查看服务状态
docker compose ps

# 进入容器
docker compose exec backend bash
docker compose exec postgres psql -U postgres       # 开发环境
docker compose -f docker-compose.prod.yml exec postgres psql -U cohort_admin  # 生产环境

# 重新构建
docker compose build --no-cache

# 更新镜像
docker compose pull
docker compose up -d --force-recreate
```

### 数据库迁移
```bash
# 运行迁移
docker compose exec backend uv run alembic upgrade head

# 查看迁移历史
docker compose exec backend uv run alembic history

# 回滚迁移
docker compose exec backend uv run alembic downgrade -1
```

### 环境变量管理
```bash
# 查看当前环境变量
docker compose exec backend env

# 修改环境变量后重启
vim .env.docker
docker compose restart backend
```

---

## 监控与日志

### Docker 日志
```bash
# 查看所有服务日志
docker compose logs -f

# 查看单个服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# 查看最近 100 行
docker compose logs --tail=100 backend

# 带时间戳
docker compose logs -t backend
```

### 容器监控
```bash
# 容器资源使用
docker stats

# 容器详情
docker inspect cohort-backend

# 查看容器进程
docker top cohort-backend
```

### 健康检查
```bash
# 检查服务健康状态
curl http://localhost/health
curl http://localhost:8000/health

# 检查数据库 (开发环境)
docker compose exec postgres pg_isready -U postgres

# 检查数据库 (生产环境)
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U cohort_admin
```

---

## 备份恢复

### 数据库备份脚本

创建 `scripts/backup.sh`：

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cohort_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# 备份数据库 (开发环境使用 postgres 用户，生产环境使用 cohort_admin)
docker compose exec -T postgres pg_dump -U postgres cohort_db | gzip > $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "cohort_db_*.sql.gz" -mtime +30 -delete

echo "备份完成：$BACKUP_FILE"
```

### 数据库恢复

```bash
# 从备份恢复 (开发环境)
gunzip -c cohort_db_20260402_020000.sql.gz | docker compose exec -T postgres psql -U postgres cohort_db

# 生产环境恢复
gunzip -c cohort_db_20260402_020000.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U cohort_admin cohort_db
```

### 完整备份
```bash
# 备份所有数据
docker run --rm \
  -v cohort-data-platform_pgdata:/pgdata \
  -v cohort-data-platform_storage:/storage \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/full_backup_$(date +%Y%m%d).tar.gz /pgdata /storage
```

---

## 常见问题

### 1. 容器无法启动
```bash
# 查看日志
docker compose logs backend

# 检查端口占用
docker ps

# 重新构建
docker compose build --no-cache
```

### 2. 数据库连接失败
```bash
# 检查数据库是否运行
docker compose ps postgres

# 检查健康状态
docker compose exec postgres pg_isready

# 查看数据库日志
docker compose logs postgres
```

### 3. 文件上传失败
```bash
# 检查存储卷权限
docker volume inspect cohort-data-platform_storage

# 修复权限
docker compose exec backend chown -R nobody:nogroup /app/data/storage
```

### 4. 内存不足
```bash
# 限制容器内存 (docker-compose.yml)
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

---

## 升级指南

### 应用升级
```bash
# 1. 备份数据
./scripts/backup.sh

# 2. 拉取最新代码
git pull

# 3. 重新构建
docker compose build

# 4. 运行迁移
docker compose exec backend uv run alembic upgrade head

# 5. 重启服务
docker compose up -d
```

---

## 附录 A: 完整环境变量示例

### .env.docker 完整配置

```bash
# ==================== 数据库配置 ====================
# PostgreSQL 连接 (Docker 网络内部)
DATABASE_URL=postgresql://cohort_admin:changeit@postgres:5432/cohort_db

# ==================== JWT 配置 ====================
# 生产环境必须修改！生成方法：openssl rand -hex 32
JWT_SECRET=change-this-to-a-random-secret-key-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ==================== AI 服务配置 ====================
# 提供商选择：anthropic | openai | deepseek | moonshot | aliyun | siliconflow | custom
LLM_PROVIDER=aliyun

# Anthropic (Claude) - 官方 API
ANTHROPIC_API_KEY=

# OpenAI (GPT-4o) - 官方 API
OPENAI_API_KEY=

# DeepSeek (深度求索) - 国内 API
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Moonshot (Kimi/月之暗面) - 国内 API
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.cn
MOONSHOT_MODEL=moonshot-v1-8k

# 阿里云 (通义千问) - 国内 API
ALIYUN_API_KEY=your-api-key-here
ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ALIYUN_MODEL=qwen-plus

# SiliconFlow (硅基流动) - 国内 API
SILICONFLOW_API_KEY=
SILICONFLOW_BASE_URL=https://api.siliconflow.cn
SILICONFLOW_MODEL=Qwen/Qwen2.5-VL-72B-Instruct

# ==================== 文件存储配置 ====================
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/app/data/storage

# ==================== CORS 配置 ====================
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# ==================== 日志配置 ====================
LOG_LEVEL=INFO
```

---

## 附录 B: Docker Compose 配置说明

### 开发环境 (docker-compose.yml)

| 配置项 | 说明 |
|--------|------|
| 代码挂载 | 本地代码实时同步到容器 |
| 热重载 | 后端和前端都启用热重载 |
| 端口暴露 | 3000 (前端), 8000 (后端), 5432 (数据库) |

### 生产环境 (docker-compose.prod.yml)

| 配置项 | 说明 |
|--------|------|
| 网络隔离 | 使用独立 Docker 网络，数据库不暴露端口 |
| 多工作进程 | 后端使用 4 个工作进程 |
| 反向代理 | Nginx 统一入口，SSL 终止 |
| 数据持久化 | 使用 Docker Volume 持久化数据 |

---

## 附录 C: 端口说明

| 服务 | 开发环境 | 生产环境 | 说明 |
|------|---------|---------|------|
| Nginx | - | 80, 443 | 生产环境统一入口 |
| Frontend | 3000 | - | 开发环境直接访问 |
| Backend | 8000 | - | 开发环境直接访问 |
| PostgreSQL | 5432 | - | 生产环境不暴露 |

---

## 附录 D: 文件存储路径

| 环境 | 存储路径 |
|------|---------|
| Docker | /var/lib/docker/volumes/cohort-data-platform_storage/_data |
| 容器内 | /app/data/storage |

---

## 部署检查清单

- [ ] 修改 JWT_SECRET
- [ ] 修改数据库密码
- [ ] 配置 LLM API Key
- [ ] 配置 SSL 证书
- [ ] 配置防火墙
- [ ] 设置日志轮转
- [ ] 设置备份任务
- [ ] 创建管理员用户
- [ ] 验证健康检查
- [ ] 测试文件上传
