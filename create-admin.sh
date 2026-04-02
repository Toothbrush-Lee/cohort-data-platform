#!/bin/bash

# 创建默认管理员账户

set -e

echo "🔑 创建默认管理员账户..."

docker-compose exec backend uv run python -c "
from app.core.database import SessionLocal
from app.models.tables import User
from app.api.auth import get_password_hash

db = SessionLocal()

# 检查是否已存在 admin 用户
existing = db.query(User).filter(User.username == 'admin').first()
if existing:
    print('⚠️  管理员账户已存在')
    exit(0)

user = User(
    username='admin',
    email='admin@example.com',
    hashed_password=get_password_hash('admin123'),
    role='admin',
)
db.add(user)
db.commit()

print('✅ 管理员账户创建成功！')
print('')
print('用户名：admin')
print('密码：admin123')
print('')
print('⚠️  首次登录后请修改默认密码！')
"
