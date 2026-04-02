# Frontend (Next.js)

队列研究多模态数据中台的前端应用，基于 Next.js 14 + TypeScript + Tailwind CSS。

## 技术栈

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn/ui** - UI 组件库

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

## 构建

```bash
# 生产构建
pnpm build

# 启动生产服务器
pnpm start
```

## 代码检查

```bash
# ESLint
pnpm lint
```

## 项目结构

```
src/
├── app/              # Next.js 页面和路由
├── components/       # React 组件
├── lib/              # 工具函数和 API 客户端
└── types/            # TypeScript 类型定义
```

## 环境变量

复制 `.env.local.example` 到 `.env.local`：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Docker 开发

前端通过 Docker Compose 自动构建和运行，无需本地安装依赖。

```bash
# 从根目录启动
docker compose up -d
```
