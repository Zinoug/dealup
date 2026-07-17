from sqlalchemy.orm import Session

from app.core.errors import DealUpError
from app.integrations import MediaStorage
from app.repositories import DeletionRepository


class DeletionService:
    def __init__(self, session: Session, storage: MediaStorage) -> None:
        self.session = session
        self.storage = storage
        self.repo = DeletionRepository(session)

    def retry_pending(self, limit: int = 50) -> tuple[int, int]:
        jobs = [(job.id, list(job.object_keys)) for job in self.repo.pending(limit)]
        self.session.commit()
        completed = 0
        failed = 0
        for job_id, object_keys in jobs:
            error: str | None = None
            try:
                for object_key in object_keys:
                    self.storage.delete(object_key)
            except DealUpError as exc:
                error = exc.code
            job = self.repo.get(job_id)
            if not job or job.status != "pending":
                self.session.rollback()
                continue
            if error:
                self.repo.fail(job, error)
                failed += 1
            else:
                self.repo.complete(job)
                completed += 1
            self.session.commit()
        return completed, failed
