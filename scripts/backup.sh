#!/bin/bash
set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cohort_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

echo "开始备份数据库..."

# 备份数据库
docker compose exec -T postgres pg_dump -U cohort_admin cohort_db | gzip > $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "cohort_db_*.sql.gz" -mtime +30 -delete

echo "备份完成：$BACKUP_FILE"
echo "文件大小：$(ls -lh $BACKUP_FILE | awk '{print $5}')"
