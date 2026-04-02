# 队列研究多模态数据中台 (Cohort Data Platform)

## 项目概述

这是一个为队列研究设计的多模态数据管理中台，用于高效管理随访数据、医疗报告 PDF 提取、时间序列数据存储和导出。

### 核心功能

1. **受试者与随访管理** - 管理受试者信息和多次随访记录
2. **智能数据提取** - 使用 AI (Claude/GPT-4o) 自动从 PDF 报告中提取数据
3. **人机协作审核** - 录入员审核 AI 提取结果后入库
4. **多模态数据导出** - 一键导出 CSV/Excel 供 R/Python 分析

### 支持的数据类型

| 类型 | 描述 | 提取指标 |
|------|------|----------|
| EndoPAT | RHI 检测报告 | RHI, AI, AI@75bpm, 心率, 血压 |
| TCD | 经颅多普勒超声 | 各血管 Vp/Vm/Vd/PI/RI/S/D |
| Vicorder | PWV 脉波传导速度 | cfPWV, 血压，心率 |
| BloodTest | 血检报告 | 血糖，糖化血红蛋白，血脂等 |
| CGM | 连续血糖监测 | 时间序列特征值 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (Next.js)                          │
│  受试者管理 │ 随访管理 │ 文件上传 │ AI 审核 │ 数据导出         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Docker 容器化                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │  PostgreSQL │  │  FastAPI    │  │   Next.js       │     │
│  │  (5432)     │──│  Backend    │──│   Frontend      │     │
│  │             │  │  (8000)     │  │   (3000)        │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

**后端**
- Python 3.12+ with `uv` 包管理
- FastAPI - 现代高性能 API 框架
- SQLAlchemy 2.0 - ORM
- PostgreSQL 16 - 关系型数据库
- Alembic - 数据库迁移
- Anthropic/OpenAI SDK - AI 数据提取

**前端**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Shadcn/ui
- pnpm 包管理

**部署**
- Docker + Docker Compose

---

## 快速开始 (Docker 方式 - 推荐)

### 前提条件

- [Docker](https://docker.com) 或 [OrbStack](https://orbstack.dev) (Mac 用户推荐)

### 一键启动

```bash
# 1. 克隆/进入项目目录
cd cohort-data-platform

# 2. 配置环境变量
cp .env.docker.example .env.docker
# 编辑 .env.docker，填入 ANTHROPIC_API_KEY 或 OPENAI_API_KEY

# 3. 启动所有服务
docker compose up -d --build

# 4. 查看日志
docker compose logs -f

# 5. 等待服务就绪后访问
# 前端：http://localhost:3000
# 后端 API 文档：http://localhost:8000/api/v1/docs
```

### 初始化数据库

首次启动后，需要运行数据库迁移：

```bash
# 进入后端容器
docker compose exec backend bash

# 运行迁移
uv run alembic upgrade head

# 创建默认管理员账户
python << 'EOF'
from app.core.database import SessionLocal
from app.models.tables import User
from app.core.security import create_password_hash

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
print('管理员账户创建成功！')
EOF

# 退出容器
exit
```

### 常用 Docker 命令

```bash
# 查看运行状态
docker compose ps

# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# 重启服务
docker compose restart backend
docker compose restart frontend

# 停止所有服务
docker compose down

# 停止并删除数据卷（谨慎使用！）
docker compose down -v

# 重新构建镜像
docker compose build --no-cache

# 进入容器执行命令
docker compose exec backend bash
docker compose exec frontend sh
```

---

## 本地开发（可选）

如需本地开发（非 Docker 方式），请参考 [DEPLOYMENT.md](./DEPLOYMENT.md) 中的详细配置说明。

---

## 数据库模型

```
User (用户)
  ├── id, username, email, role (admin/clerk/analyst)
  └── 关系：uploaded_files, verified_files

Subject (受试者)
  ├── id, subject_code, name_pinyin, gender, birth_date
  └── 关系：visits

Visit (随访)
  ├── id, subject_id, visit_name (Baseline/V1/V3...), visit_date
  └── 关系：files, assessments

RawFile (原始文件)
  ├── id, visit_id, file_type, oss_url, status
  └── 关系：assessment

AssessmentData (结构化数据)
  ├── id, visit_id, file_id, assessment_type
  ├── extracted_data (JSONB)
  └── is_verified, verified_at
```

---

## 项目结构

```
cohort-data-platform/
├── docker-compose.yml        # Docker 编排配置
├── docker-compose.prod.yml   # 生产环境配置
├── .env.docker               # Docker 环境变量
├── .gitignore                # Git 忽略文件配置
├── .gitattributes            # Git 属性配置
├── .githooks/                # Git 钩子脚本
│   └── commit-msg            # 提交信息验证钩子
│
├── backend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── api/              # API 路由
│   │   ├── core/             # 核心配置
│   │   ├── models/           # 数据库模型
│   │   ├── schemas/          # Pydantic 模型
│   │   └── services/         # 业务服务 (AI 提取)
│   ├── alembic/              # 数据库迁移
│   └── pyproject.toml
│
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/              # Next.js 页面
│       ├── components/       # UI 组件
│       ├── lib/              # API 封装
│       └── types/            # TypeScript 类型
│
├── nginx/
│   ├── nginx.conf            # Nginx 反向代理配置
│   └── ssl/                  # SSL 证书目录
│
├── scripts/
│   ├── backup.sh             # 数据库备份脚本
│   └── health-check.sh       # 健康检查脚本
│
├── README.md                 # 项目说明（本文档）
├── DEPLOYMENT.md             # Docker 部署详细指南
├── DOCS.md                   # 数据采集、审核、分析规范 (SOP)
└── GIT_GUIDE.md              # Git 版本管理使用指南
```

---

## API 端点

### 认证
- `POST /api/v1/auth/login` - 用户登录

### 受试者管理
- `GET/POST /api/v1/subjects/` - 列表/创建
- `GET/PUT/DELETE /api/v1/subjects/{id}` - 详情/更新/删除

### 随访管理
- `GET/POST /api/v1/visits/` - 列表/创建
- `GET/PUT/DELETE /api/v1/visits/{id}` - 详情/更新/删除

### 文件管理
- `POST /api/v1/files/upload` - 上传文件
- `GET /api/v1/files/` - 文件列表
- `GET /api/v1/files/{id}/download` - 下载文件

### 检查数据
- `GET /api/v1/assessments/` - 列表
- `PUT /api/v1/assessments/{id}` - 更新 (审核确认)
- `GET /api/v1/assessments/visit/{visit_id}/summary` - 随访汇总

### 数据导出
- `GET /api/v1/export/csv` - 导出 CSV
- `GET /api/v1/export/excel` - 导出 Excel

---

## 角色与权限

| 角色 | 权限 |
|------|------|
| admin | 全部权限，包括用户管理 |
| clerk | 上传文件、审核数据 |
| analyst | 查看和导出数据 |
| reviewer | 审核数据 |

**默认管理员账户：**
- 用户名：`admin`
- 密码：`Admin@123456`

**注意**：首次登录后请立即修改默认密码！

---

## AI 提取配置

在 `.env.docker` 中配置 AI 服务：

```bash
# 使用 Anthropic Claude (推荐)
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic

# 或使用 OpenAI
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
```

---

## 故障排查

### 容器无法启动

```bash
# 查看日志
docker compose logs

# 检查配置
docker compose config
```

### 数据库连接失败

确保 `DATABASE_URL` 使用正确的 Docker 服务名：
```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cohort_db
```

### 前端无法连接后端

确保 `.env.docker` 中 CORS 配置正确：
```bash
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
```

### 重置所有数据

```bash
# 停止并删除所有容器和数据卷
docker compose down -v

# 重新启动
docker compose up -d

# 重新运行迁移
docker compose exec backend uv run alembic upgrade head
```

---

## 下一步

1. **配置 AI API** - 在 `.env.docker` 中填入你的 Claude/OpenAI API Key
2. **创建管理员账户** - 运行初始化脚本
3. **开始使用** - 访问 http://localhost:3000 开始录入数据

---

## 文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Docker 部署详细指南
- [DOCS.md](./DOCS.md) - 数据采集、审核、分析规范 (SOP)
- [GIT_GUIDE.md](./GIT_GUIDE.md) - Git 版本管理使用指南

---

## License

MIT
