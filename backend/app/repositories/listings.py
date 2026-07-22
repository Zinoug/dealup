from datetime import datetime

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models import Analysis, ListingIdentification, User


class ListingRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, identification: ListingIdentification) -> ListingIdentification:
        self.session.add(identification)
        self.session.flush()
        return identification

    def get_owned(
        self, identification_id: str, user_id: str, *, for_update: bool = False
    ) -> ListingIdentification | None:
        query = select(ListingIdentification).where(
            ListingIdentification.id == identification_id,
            ListingIdentification.user_id == user_id,
        )
        if for_update:
            query = query.with_for_update()
        return self.session.scalar(query)

    def find_owned(
        self, user_id: str, *, external_id: str | None, source_url: str
    ) -> ListingIdentification | None:
        identities = [ListingIdentification.source_url == source_url]
        if external_id:
            identities.append(ListingIdentification.external_id == external_id)
        return self.session.scalar(
            select(ListingIdentification)
            .where(
                ListingIdentification.user_id == user_id,
                or_(*identities),
            )
            .order_by(ListingIdentification.created_at.desc())
            .limit(1)
        )

    def claim_free_identification(self, user_id: str, claimed_at: datetime) -> bool:
        result = self.session.execute(
            update(User)
            .where(
                User.id == user_id,
                User.free_identification_claimed_at.is_(None),
            )
            .values(free_identification_claimed_at=claimed_at)
        )
        return result.rowcount == 1

    def release_free_identification(self, user_id: str, claimed_at: datetime) -> None:
        self.session.execute(
            update(User)
            .where(
                User.id == user_id,
                User.free_identification_claimed_at == claimed_at,
            )
            .values(free_identification_claimed_at=None)
        )

    def latest_analysis_id(self, identification_id: str, user_id: str) -> str | None:
        root = self.session.scalar(
            select(Analysis)
            .where(
                Analysis.user_id == user_id,
                Analysis.identification_id == identification_id,
            )
            .order_by(Analysis.created_at.asc())
            .limit(1)
        )
        if not root:
            return None
        root_id = root.root_analysis_id or root.id
        latest = self.session.scalar(
            select(Analysis)
            .where(
                Analysis.user_id == user_id,
                or_(Analysis.id == root_id, Analysis.root_analysis_id == root_id),
            )
            .order_by(Analysis.created_at.desc())
            .limit(1)
        )
        return latest.id if latest else root.id

    def list_pending_owned(
        self, user_id: str, *, limit: int
    ) -> list[ListingIdentification]:
        analyzed_identifications = select(Analysis.identification_id).where(
            Analysis.user_id == user_id,
            Analysis.identification_id.is_not(None),
        )
        return list(
            self.session.scalars(
                select(ListingIdentification)
                .where(
                    ListingIdentification.user_id == user_id,
                    ListingIdentification.compatibility_status == "SUPPORTED",
                    ListingIdentification.consumed_at.is_(None),
                    ListingIdentification.id.not_in(analyzed_identifications),
                )
                .order_by(ListingIdentification.created_at.desc())
                .limit(limit)
            )
        )
