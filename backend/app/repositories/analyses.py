from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models import Analysis, AnalysisStatus


class AnalysisRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, analysis: Analysis) -> Analysis:
        self.session.add(analysis)
        self.session.flush()
        return analysis

    def get(self, analysis_id: str) -> Analysis | None:
        return self.session.get(Analysis, analysis_id)

    def get_owned(self, analysis_id: str, user_id: str) -> Analysis | None:
        return self.session.scalar(
            select(Analysis).where(
                Analysis.id == analysis_id, Analysis.user_id == user_id
            )
        )

    def get_by_idempotency(self, user_id: str, key: str) -> Analysis | None:
        return self.session.scalar(
            select(Analysis).where(
                Analysis.user_id == user_id, Analysis.idempotency_key == key
            )
        )

    def list_owned(
        self, user_id: str, *, offset: int, limit: int
    ) -> tuple[list[Analysis], int]:
        filters = (
            Analysis.user_id == user_id,
            or_(
                Analysis.root_analysis_id == Analysis.id,
                Analysis.parent_analysis_id.is_(None),
            ),
        )
        items = list(
            self.session.scalars(
                select(Analysis)
                .where(*filters)
                .order_by(Analysis.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        )
        total = (
            self.session.scalar(
                select(func.count()).select_from(Analysis).where(*filters)
            )
            or 0
        )
        return items, total

    def latest_for_root(self, user_id: str, root: Analysis) -> Analysis:
        return (
            self.session.scalar(
                select(Analysis)
                .where(
                    Analysis.user_id == user_id,
                    or_(
                        Analysis.root_analysis_id == (root.root_analysis_id or root.id),
                        Analysis.id == root.id,
                    ),
                )
                .order_by(Analysis.created_at.desc())
                .limit(1)
            )
            or root
        )

    def chain_owned(self, user_id: str, root_id: str) -> list[Analysis]:
        return list(
            self.session.scalars(
                select(Analysis).where(
                    Analysis.user_id == user_id,
                    or_(Analysis.root_analysis_id == root_id, Analysis.id == root_id),
                )
            )
        )

    def delete_chain(self, user_id: str, root_id: str) -> None:
        self.session.execute(
            delete(Analysis).where(
                Analysis.user_id == user_id,
                or_(Analysis.root_analysis_id == root_id, Analysis.id == root_id),
            )
        )

    def mark_pending_for_retry(self, analysis: Analysis) -> None:
        analysis.status = AnalysisStatus.PENDING
        analysis.error_code = None
        analysis.error_message = None
