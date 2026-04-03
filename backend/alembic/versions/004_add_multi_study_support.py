"""add multi-study support

Revision ID: 004_add_multi_study_support
Revises: 20260402_120000_add_ai_extracted_data
Create Date: 2026-04-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_add_multi_study_support'
down_revision = '20260402_120000_add_ai_extracted_data'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create Study table
    op.create_table('studies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('visit_types', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_studies_code'), 'studies', ['code'], unique=True)
    op.create_index(op.f('ix_studies_id'), 'studies', ['id'], unique=False)

    # Create StudyMember table
    op.create_table('study_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('study_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, default='analyst'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['study_id'], ['studies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('study_id', 'user_id', name='uq_study_member')
    )
    op.create_index(op.f('ix_study_members_id'), 'study_members', ['id'], unique=False)
    op.create_index(op.f('ix_study_members_study_id'), 'study_members', ['study_id'], unique=False)
    op.create_index(op.f('ix_study_members_user_id'), 'study_members', ['user_id'], unique=False)

    # Add study_id to subjects table
    op.add_column('subjects', sa.Column('study_id', sa.Integer(), nullable=False))
    op.create_foreign_key(
        'fk_subjects_study_id',
        'subjects', 'studies',
        ['study_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index(op.f('ix_subjects_study_id'), 'subjects', ['study_id'], unique=False)

    # Drop unique constraint on subject_code and create new unique index with study_id
    # Note: Alembic doesn't support dropping unique constraints directly in all cases
    # We'll create a new unique index on (study_id, subject_code)
    op.create_index('uq_subjects_study_code', 'subjects', ['study_id', 'subject_code'], unique=True)

    # Add study_id to assessment_templates table
    op.add_column('assessment_templates', sa.Column('study_id', sa.Integer(), nullable=False))
    op.create_foreign_key(
        'fk_assessment_templates_study_id',
        'assessment_templates', 'studies',
        ['study_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index(op.f('ix_assessment_templates_study_id'), 'assessment_templates', ['study_id'], unique=False)

    # Drop unique constraint on template_name and create new unique index with study_id
    op.drop_index('uq_assessment_templates_template_name', table_name='assessment_templates')
    op.create_index('uq_assessment_templates_study_template', 'assessment_templates', ['study_id', 'template_name'], unique=True)


def downgrade() -> None:
    # Restore unique constraint on template_name
    op.drop_index('uq_assessment_templates_study_template', table_name='assessment_templates')
    op.create_index('uq_assessment_templates_template_name', 'assessment_templates', ['template_name'], unique=True)

    # Remove study_id from assessment_templates
    op.drop_constraint('fk_assessment_templates_study_id', 'assessment_templates', type_='foreignkey')
    op.drop_index(op.f('ix_assessment_templates_study_id'), table_name='assessment_templates')
    op.drop_column('assessment_templates', 'study_id')

    # Remove study_id from subjects
    op.drop_constraint('fk_subjects_study_id', 'subjects', type_='foreignkey')
    op.drop_index(op.f('ix_subjects_study_id'), table_name='subjects')
    op.drop_index('uq_subjects_study_code', table_name='subjects')
    op.drop_column('subjects', 'study_id')

    # Drop StudyMember table
    op.drop_index(op.f('ix_study_members_user_id'), table_name='study_members')
    op.drop_index(op.f('ix_study_members_study_id'), table_name='study_members')
    op.drop_index(op.f('ix_study_members_id'), table_name='study_members')
    op.drop_table('study_members')

    # Drop Study table
    op.drop_index(op.f('ix_studies_id'), table_name='studies')
    op.drop_index(op.f('ix_studies_code'), table_name='studies')
    op.drop_table('studies')
