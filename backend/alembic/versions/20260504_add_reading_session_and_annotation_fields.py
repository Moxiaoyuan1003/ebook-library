"""add reading_session table and annotation fields

Revision ID: 4651b71787cd
Revises:
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

# revision identifiers, used by Alembic.
revision = "4651b71787cd"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Create reading_sessions table ---
    op.create_table(
        "reading_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            UUID(as_uuid=True),
            sa.ForeignKey("books.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("messages", JSON, server_default="[]"),
        sa.Column("context_passages", JSON, server_default="[]"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.func.now(),
            server_onupdate=sa.func.now(),
        ),
    )

    # --- Add new columns to annotations table ---
    op.add_column(
        "annotations",
        sa.Column("highlight_color", sa.String(20), server_default="yellow"),
    )
    op.add_column(
        "annotations",
        sa.Column("start_cfi", sa.Text(), nullable=True),
    )
    op.add_column(
        "annotations",
        sa.Column("end_cfi", sa.Text(), nullable=True),
    )
    op.add_column(
        "annotations",
        sa.Column("rect_data", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    # --- Remove annotation columns ---
    op.drop_column("annotations", "rect_data")
    op.drop_column("annotations", "end_cfi")
    op.drop_column("annotations", "start_cfi")
    op.drop_column("annotations", "highlight_color")

    # --- Drop reading_sessions table ---
    op.drop_table("reading_sessions")
