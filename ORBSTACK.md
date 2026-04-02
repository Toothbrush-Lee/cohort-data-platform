# 使用 OrbStack 运行队列研究数据中台

## 为什么选择 OrbStack？

OrbStack 是 Docker Desktop 的轻量级替代品，专为 macOS 优化：

| 特性 | OrbStack | Docker Desktop |
|------|----------|----------------|
| 内存占用 | ~100MB | ~1-2GB |
| 启动速度 | ~2 秒 | ~30 秒 |
| 磁盘占用 | ~200MB | ~2GB+ |
| 网络性能 | 原生速度 | NAT 转换 |
| 价格 | 免费/开源 | 商业收费 |

## 安装 OrbStack

```bash
# 使用 Homebrew 安装
brew install --cask orbstack

# 或者从官网下载
# https://orbstack.dev/download
```

安装完成后，启动 OrbStack 应用。

## 使用本项目

### 1. 启动服务

```bash
cd cohort-data-platform

# 配置环境变量
cp .env.docker.example .env.docker
# 编辑 .env.docker，填入 ANTHROPIC_API_KEY

# 一键启动
./start.sh
```

### 2. OrbStack 专属命令

```bash
# 在 OrbStack UI 中查看容器
open orb://containers

# 查看资源使用情况
orb top

# 快速重启容器
orb restart cohort-backend
orb restart cohort-frontend
orb restart cohort-postgres
```

### 3. OrbStack 优势

- **自动休眠**：长时间不使用时自动释放资源
- **快速启动**：容器启动速度比 Docker Desktop 快 10 倍
- **原生网络**：可以直接使用 `localhost` 访问容器
- **Time Machine 排除**：自动排除 Docker 卷从备份

## 故障排查

### 检查 OrbStack 状态

```bash
# 查看 OrbStack 是否运行
orb status

# 重启 OrbStack
orb restart
```

### 清理资源

```bash
# 清理未使用的容器
docker system prune

# 清理未使用的卷（谨慎！会删除数据）
docker volume prune
```

### 日志查看

```bash
# 使用 orb 命令查看日志
orb logs cohort-backend

# 或使用标准 docker 命令
docker-compose logs -f backend
```

## 从 Docker Desktop 迁移

如果你之前使用 Docker Desktop：

```bash
# 1. 停止 Docker Desktop
# 2. 启动 OrbStack
# 3. OrbStack 会自动接管 Docker 命令

# 验证
docker info | grep OrbStack
```

无需更改任何配置，`docker`和`docker-compose` 命令完全兼容！
