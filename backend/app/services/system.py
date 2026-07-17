from sqlalchemy.orm import Session

from app.repositories import SystemRepository


class SystemService:
    def __init__(self, session: Session) -> None:
        self.repository = SystemRepository(session)

    def check_readiness(self) -> None:
        self.repository.check_database()
