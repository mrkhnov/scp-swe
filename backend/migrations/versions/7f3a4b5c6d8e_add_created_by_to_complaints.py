"""add_created_by_to_complaints

Revision ID: 7f3a4b5c6d8e
Revises: 6268b256099f
Create Date: 2025-11-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f3a4b5c6d8e'
down_revision: Union[str, None] = '6268b256099f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_by column as nullable first
    op.add_column('complaints', sa.Column('created_by', sa.Integer(), nullable=True))
    # Add foreign key constraint
    op.create_foreign_key('fk_complaints_created_by', 'complaints', 'users', ['created_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Drop foreign key and column
    op.drop_constraint('fk_complaints_created_by', 'complaints', type_='foreignkey')
    op.drop_column('complaints', 'created_by')
