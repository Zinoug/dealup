from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ListingIdentification


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
