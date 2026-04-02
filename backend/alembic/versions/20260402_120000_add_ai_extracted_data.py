"""add ai_extracted_data

Revision ID: 004
Revises: 003
Create Date: 2026-04-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 添加 ai_extracted_data 字段到 raw_files 表
    op.add_column('raw_files',
        sa.Column('ai_extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    # 删除 ai_extracted_data 字段
    op.drop_column('raw_files', 'ai_extracted_data')
