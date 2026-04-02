# 快速开始指南

## 前提条件

确保已安装以下工具：
- [uv](https://docs.astral.sh/uv/) (Python 包管理)
- [mise](https://mise.jdx.dev/) (工具管理)
- [pnpm](https://pnpm.io/) (Node.js 包管理)
- PostgreSQL 14+

## 一键启动（开发环境）

### 1. 启动数据库

```bash
# macOS (使用 Homebrew)
brew install postgresql@14
brew services start postgresql@14

# 创建数据库
createdb cohort_db
```

### 2. 配置后端

```bash
cd backend

# 安装依赖
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少配置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY

# 运行数据库迁移
uv run alembic upgrade head

# 启动后端服务
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 配置前端（新终端）

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 4. 访问应用

- 前端：http://localhost:3000
- 后端 API 文档：http://localhost:8000/api/v1/docs
- 首页：http://localhost:3000

## 默认账户

```
用户名：admin
密码：admin123
```

**注意**：首次使用时请修改默认密码！

## 开发流程

1. 创建受试者
2. 创建随访记录
3. 上传 PDF 报告（AI 自动提取）
4. 审核 AI 提取结果
5. 导出 CSV/Excel 数据

## 故障排查

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
brew services list

# 重启 PostgreSQL
brew services restart postgresql@14
```

### 前端无法连接后端

确保 `.env.local` 中配置：
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### AI 提取失败

检查 `.env` 中的 API Key 是否正确：
```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# 或 OpenAI
OPENAI_API_KEY=sk-...
```

## 下一步

- 阅读 [DOCS.md](./DOCS.md) 了解详细使用规范
- 查看 [README.md](./README.md) 了解技术架构
- 访问 API 文档 http://localhost:8000/api/v1/docs
