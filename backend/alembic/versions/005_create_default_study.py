"""
Data migration to create default study and migrate existing data

Revision ID: 005_create_default_study
Revises: 004_add_multi_study_support
Create Date: 2026-04-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = '005_create_default_study'
down_revision = '004_add_multi_study_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create default study
    conn = op.get_bind()

    # Check if default study already exists
    result = conn.execute(
        text("SELECT id FROM studies WHERE code = 'DEFAULT_COHORT'")
    ).fetchone()

    if result:
        print("Default study already exists, skipping creation")
        default_study_id = result[0]
    else:
        # Insert default study
        result = conn.execute(
            text("""
                INSERT INTO studies (name, code, description, visit_types, is_active, created_at, updated_at)
                VALUES (
                    '默认队列',
                    'DEFAULT_COHORT',
                    '系统默认研究（自动创建）',
                    '{"Baseline": "基线", "V1": "1 月", "V3": "3 月", "V6": "6 月", "V12": "12 月", "Other": "其他"}'::jsonb,
                    true,
                    NOW(),
                    NOW()
                )
                RETURNING id
            """)
        ).fetchone()
        default_study_id = result[0]
        print(f"Created default study with ID: {default_study_id}")

    # Migrate existing subjects to default study
    conn.execute(
        text("""
            UPDATE subjects
            SET study_id = :study_id
            WHERE study_id IS NULL
        """),
        {"study_id": default_study_id}
    )
    print("Migrated existing subjects to default study")

    # Migrate existing templates to default study
    conn.execute(
        text("""
            INSERT INTO assessment_templates (study_id, template_name, display_name, description, is_active, created_at, updated_at)
            SELECT
                :study_id,
                'EndoPAT',
                'EndoPAT 检测',
                '血管内皮功能检测',
                true,
                NOW(),
                NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM assessment_templates WHERE study_id = :study_id AND template_name = 'EndoPAT'
            )
        """),
        {"study_id": default_study_id}
    )

    conn.execute(
        text("""
            INSERT INTO assessment_templates (study_id, template_name, display_name, description, is_active, created_at, updated_at)
            SELECT
                :study_id,
                'TCD',
                'TCD 检测',
                '经颅多普勒超声检测',
                true,
                NOW(),
                NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM assessment_templates WHERE study_id = :study_id AND template_name = 'TCD'
            )
        """),
        {"study_id": default_study_id}
    )

    conn.execute(
        text("""
            INSERT INTO assessment_templates (study_id, template_name, display_name, description, is_active, created_at, updated_at)
            SELECT
                :study_id,
                'Vicorder',
                'Vicorder 检测',
                '脉搏波传导速度检测',
                true,
                NOW(),
                NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM assessment_templates WHERE study_id = :study_id AND template_name = 'Vicorder'
            )
        """),
        {"study_id": default_study_id}
    )

    conn.execute(
        text("""
            INSERT INTO assessment_templates (study_id, template_name, display_name, description, is_active, created_at, updated_at)
            SELECT
                :study_id,
                'BloodTest',
                '血检',
                '血液生化检测',
                true,
                NOW(),
                NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM assessment_templates WHERE study_id = :study_id AND template_name = 'BloodTest'
            )
        """),
        {"study_id": default_study_id}
    )

    print("Created default templates for default study")

    # Add NOT NULL constraint to study_id after data migration
    op.alter_column('subjects', 'study_id', nullable=False)


def downgrade() -> None:
    # Remove NOT NULL constraint
    op.alter_column('subjects', 'study_id', nullable=True)

    # Reset study_id to NULL
    conn = op.get_bind()
    conn.execute(
        text("""
            UPDATE subjects
            SET study_id = NULL
            WHERE study_id = (SELECT id FROM studies WHERE code = 'DEFAULT_COHORT')
        """)
    )

    # Delete default study (cascade will delete associated templates)
    conn.execute(
        text("""
            DELETE FROM studies WHERE code = 'DEFAULT_COHORT'
        """)
    )
