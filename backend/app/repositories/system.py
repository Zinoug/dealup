from sqlalchemy import text
from sqlalchemy.orm import Session


class SystemRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def check_database(self) -> None:
        self.session.execute(text("SELECT 1"))
