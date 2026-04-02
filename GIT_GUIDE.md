# Git 版本管理使用指南

## 仓库结构

```
cohort-data-platform/       # 单一 Git 仓库 (Monorepo)
├── .git/                   # 唯一 Git 目录
├── .gitignore              # 忽略文件配置
├── .gitattributes          # 换行符和属性配置
├── .githooks/              # Git 钩子脚本
│   └── commit-msg          # 提交信息验证钩子
├── backend/                # 后端代码
├── frontend/               # 前端代码
└── docker-compose.yml      # Docker 编排
```

---

## 分支策略 (GitHub Flow)

```
main              # 生产分支，始终可部署
├── feature/*     # 新功能分支
├── bugfix/*      # bug 修复分支
└── hotfix/*      # 紧急修复分支
```

### 工作流程

```bash
# 1. 从 main 创建功能分支
git checkout -b feature/blood-test-export

# 2. 开发并提交 (可同时修改前后端)
git add .
git commit -m "feat: add blood test data export"

# 3. 推送到远程
git push -u origin feature/blood-test-export

# 4. 创建 Pull Request (Merge Request)

# 5. 合并后删除分支，同步 main
git checkout main
git pull
```

---

## 提交规范 (Conventional Commits)

### 格式
```
<type>: <description>

[optional body]

[optional footer]
```

### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add CGM data visualization` |
| `fix` | Bug 修复 | `fix: correct RHI value calculation` |
| `docs` | 文档更新 | `docs: update API documentation` |
| `style` | 代码格式 | `style: fix eslint formatting` |
| `refactor` | 重构 | `refactor: extract validation logic` |
| `test` | 测试 | `test: add unit tests for auth` |
| `chore` | 构建/工具 | `chore: update dependencies` |
| `perf` | 性能优化 | `perf: improve query performance` |
| `ci` | CI 配置 | `ci: add github actions workflow` |
| `build` | 构建系统 | `build: update webpack config` |
| `revert` | 回滚 | `revert: revert previous commit` |

### 提交示例

```bash
# 新功能
git commit -m "feat: add PDF upload for EndoPAT reports"

# Bug 修复
git commit -m "fix: handle null values in assessment data"

# 带描述的提交
git commit -m "feat: support batch visit creation

- Add batch create API endpoint
- Add multi-select UI for subjects
- Update visit list page"

# 关联 Issue
git commit -m "fix: correct blood test field mapping

Closes #123"
```

---

## 版本管理

### 创建版本标签

```bash
# 查看当前版本
git describe --tags

# 创建新版本
git tag v1.2.0

# 推送标签
git push origin --tags
```

### 版本命名 (Semantic Versioning)

```
v1.2.3
│ │ └─ Patch: 向后兼容的问题修复
│ └─── Minor: 向后兼容的新功能
└───── Major: 不兼容的变更
```

---

## 常用命令

### 日常操作
```bash
# 查看状态
git status

# 查看提交历史
git log --oneline
git log --graph --oneline --all

# 查看变更
git diff
git diff HEAD~1

# 撤销修改
git checkout -- <file>      # 撤销工作区修改
git reset HEAD <file>       # 撤销暂存
```

### 分支操作
```bash
# 创建分支
git checkout -b feature/new-feature

# 切换分支
git checkout main

# 合并分支
git merge feature/new-feature

# 删除分支
git branch -d feature/new-feature
git branch -D feature/new-feature  # 强制删除
```

### 同步远程
```bash
# 拉取最新代码
git pull

# 推送代码
git push
git push -u origin <branch>

# 推送标签
git push origin --tags
```

---

## 忽略文件 (.gitignore)

已配置忽略：
- 环境变量 (`.env`, `.env.local`, `.env.docker`)
- 敏感文件 (`*.pem`, `*.key`)
- 构建产物 (`node_modules/`, `__pycache__/`, `.next/`)
- 存储文件 (`backend/storage/*`)
- IDE 配置 (`.vscode/`, `.idea/`)

---

## 配置远程仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/your-org/cohort-data-platform.git

# 或 SSH 方式
git remote add origin git@github.com:your-org/cohort-data-platform.git

# 推送 main 分支
git push -u origin main

# 验证
git remote -v
```

---

## 最佳实践

### ✅ 推荐
- 小步提交，频繁推送
- 一个提交只做一件事
- 提交前运行测试
- 使用有意义的提交信息
- 功能分支及时合并删除

### ❌ 避免
- 大篇幅的提交（>500 行代码）
- 模糊的提交信息（如 "update", "fix stuff"）
- 在生产分支直接提交
- 长期不合并的功能分支
- 提交敏感信息（密码、API Key）

---

## 故障排查

### 提交信息格式错误
```
# 如果 hook 阻止了提交，检查信息格式
git commit -m "feat: add new feature"  # ✓
git commit -m "added stuff"            # ✗
```

### 误提交敏感文件
```bash
# 从历史中删除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/secret" \
  --prune-empty --tag-name-filter cat -- --all
```

### 回滚错误提交
```bash
# 回滚最后一次提交
git revert HEAD

# 回滚特定提交
git revert <commit-hash>
```

---

## 权限管理

建议配置分支保护：
- `main` 分支：禁止直接推送，必须通过 PR 合并
- 要求至少 1 人代码审查
- 要求 CI 检查通过

---

## 备份策略

```bash
# 定期推送到远程仓库
git push

# 本地备份
git bundle create backup-$(date +%Y%m%d).bundle --all
```
