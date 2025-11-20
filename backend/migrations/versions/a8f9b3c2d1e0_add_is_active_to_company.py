"""add_is_active_to_company

Revision ID: a8f9b3c2d1e0
Revises: 7f3a4b5c6d8e
Create Date: 2025-11-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f9b3c2d1e0'
down_revision: Union[str, None] = '7f3a4b5c6d8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column with default True
    op.add_column('companies', sa.Column('is_active', sa.Boolean(), nullable=True))
    # Set default value for existing rows
    op.execute('UPDATE companies SET is_active = true WHERE is_active IS NULL')
    # Make column non-nullable
    op.alter_column('companies', 'is_active', nullable=False)


def downgrade() -> None:
    op.drop_column('companies', 'is_active')
