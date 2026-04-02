"""add_sample_time

Revision ID: 003
Revises: 002
Create Date: 2026-04-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加 sample_time 字段到 assessment_data 表
    op.add_column('assessment_data',
        sa.Column('sample_time', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('assessment_data', 'sample_time')
