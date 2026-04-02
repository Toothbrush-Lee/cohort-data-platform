"""add_assessment_templates

Revision ID: 002
Revises: initial
Create Date: 2026-04-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = 'initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Assessment Templates table
    op.create_table('assessment_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_templates_id'), 'assessment_templates', ['id'], unique=False)
    op.create_index(op.f('ix_assessment_templates_template_name'), 'assessment_templates', ['template_name'], unique=True)

    # Template Fields table
    op.create_table('template_fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_label', sa.String(length=100), nullable=False),
        sa.Column('field_type', sa.String(length=20), nullable=False, default='number'),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
        sa.Column('required', sa.Boolean(), nullable=False, default=True),
        sa.Column('min_value', sa.Float(), nullable=True),
        sa.Column('max_value', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['assessment_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_template_fields_id'), 'template_fields', ['id'], unique=False)
    op.create_index(op.f('ix_template_fields_template_id'), 'template_fields', ['template_id'], unique=False)

    # Insert default templates
    # EndoPAT Template
    op.execute("""
        INSERT INTO assessment_templates (template_name, display_name, description, is_active)
        VALUES ('EndoPAT', 'EndoPAT 检测', '外周动脉张力测定检查', true)
    """)

    # Get the template_id for EndoPAT
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'rhi_value', 'RHI 值', 'number', '', 1, true FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'ai_value', 'AI 值', 'number', '%', 2, true FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'ai_75bpm', 'AI@75bpm', 'number', '%', 3, false FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'heart_rate', '心率', 'number', 'bpm', 4, true FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'systolic_bp', '收缩压', 'number', 'mmHg', 5, true FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'diastolic_bp', '舒张压', 'number', 'mmHg', 6, true FROM assessment_templates WHERE template_name = 'EndoPAT'
    """)

    # TCD Template
    op.execute("""
        INSERT INTO assessment_templates (template_name, display_name, description, is_active)
        VALUES ('TCD', 'TCD 检测', '经颅多普勒超声检查', true)
    """)

    # TCD fields - for each vessel
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'vessel_name', '血管名称', 'text', '', 1, true FROM assessment_templates WHERE template_name = 'TCD'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'vp', '收缩峰流速 (Vp)', 'number', 'cm/s', 2, true FROM assessment_templates WHERE template_name = 'TCD'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'vm', '平均流速 (Vm)', 'number', 'cm/s', 3, true FROM assessment_templates WHERE template_name = 'TCD'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'vd', '舒张末期流速 (Vd)', 'number', 'cm/s', 4, true FROM assessment_templates WHERE template_name = 'TCD'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'pi', '搏动指数 (PI)', 'number', '', 5, true FROM assessment_templates WHERE template_name = 'TCD'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'ri', '阻力指数 (RI)', 'number', '', 6, true FROM assessment_templates WHERE template_name = 'TCD'
    """)

    # Vicorder/PWV Template
    op.execute("""
        INSERT INTO assessment_templates (template_name, display_name, description, is_active)
        VALUES ('Vicorder', 'Vicorder 检测', '脉搏波传导速度测定', true)
    """)

    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'cf_pwv', 'cfPWV', 'number', 'm/s', 1, true FROM assessment_templates WHERE template_name = 'Vicorder'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'systolic_bp', '收缩压', 'number', 'mmHg', 2, true FROM assessment_templates WHERE template_name = 'Vicorder'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'diastolic_bp', '舒张压', 'number', 'mmHg', 3, true FROM assessment_templates WHERE template_name = 'Vicorder'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'heart_rate', '心率', 'number', 'bpm', 4, true FROM assessment_templates WHERE template_name = 'Vicorder'
    """)

    # BloodTest Template
    op.execute("""
        INSERT INTO assessment_templates (template_name, display_name, description, is_active)
        VALUES ('BloodTest', '血检', '血液生化检查', true)
    """)

    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'glucose', '空腹血糖', 'number', 'mmol/L', 1, true FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'total_cholesterol', '总胆固醇', 'number', 'mmol/L', 2, true FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'ldl_cholesterol', '低密度脂蛋白', 'number', 'mmol/L', 3, true FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'hdl_cholesterol', '高密度脂蛋白', 'number', 'mmol/L', 4, true FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'triglycerides', '甘油三酯', 'number', 'mmol/L', 5, true FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'creatinine', '肌酐', 'number', 'μmol/L', 6, false FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'alt', 'ALT (谷丙转氨酶)', 'number', 'U/L', 7, false FROM assessment_templates WHERE template_name = 'BloodTest'
    """)
    op.execute("""
        INSERT INTO template_fields (template_id, field_name, field_label, field_type, unit, sort_order, required)
        SELECT id, 'ast', 'AST (谷草转氨酶)', 'number', 'U/L', 8, false FROM assessment_templates WHERE template_name = 'BloodTest'
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_template_fields_template_id'), table_name='template_fields')
    op.drop_index(op.f('ix_template_fields_id'), table_name='template_fields')
    op.drop_table('template_fields')
    op.drop_index(op.f('ix_assessment_templates_template_name'), table_name='assessment_templates')
    op.drop_index(op.f('ix_assessment_templates_id'), table_name='assessment_templates')
    op.drop_table('assessment_templates')
