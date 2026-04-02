"""initial commit

Revision ID: initial
Revises:
Create Date: 2025-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, default='analyst'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # Subjects table
    op.create_table('subjects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject_code', sa.String(length=50), nullable=False),
        sa.Column('name_pinyin', sa.String(length=100), nullable=False),
        sa.Column('gender', sa.String(length=10), nullable=False),
        sa.Column('birth_date', sa.DateTime(), nullable=False),
        sa.Column('enrollment_date', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subjects_id'), 'subjects', ['id'], unique=False)
    op.create_index(op.f('ix_subjects_subject_code'), 'subjects', ['subject_code'], unique=True)

    # Visits table
    op.create_table('visits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('visit_name', sa.String(length=50), nullable=False),
        sa.Column('visit_date', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_visits_id'), 'visits', ['id'], unique=False)

    # Raw Files table
    op.create_table('raw_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('visit_id', sa.Integer(), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('stored_filename', sa.String(length=255), nullable=False),
        sa.Column('oss_url', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='uploaded'),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['visit_id'], ['visits.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_raw_files_id'), 'raw_files', ['id'], unique=False)

    # Assessment Data table
    op.create_table('assessment_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('visit_id', sa.Integer(), nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=True),
        sa.Column('assessment_type', sa.String(length=50), nullable=False),
        sa.Column('extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['raw_files.id'], ),
        sa.ForeignKeyConstraint(['visit_id'], ['visits.id'], ),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_data_id'), 'assessment_data', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_assessment_data_id'), table_name='assessment_data')
    op.drop_table('assessment_data')
    op.drop_index(op.f('ix_raw_files_id'), table_name='raw_files')
    op.drop_table('raw_files')
    op.drop_index(op.f('ix_visits_id'), table_name='visits')
    op.drop_table('visits')
    op.drop_index(op.f('ix_subjects_subject_code'), table_name='subjects')
    op.drop_index(op.f('ix_subjects_id'), table_name='subjects')
    op.drop_table('subjects')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
