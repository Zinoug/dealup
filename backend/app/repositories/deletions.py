from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import DeletionJob


class DeletionRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, *, user_id: str, kind: str, object_keys: list[str]) -> DeletionJob:
        job = DeletionJob(user_id=user_id, kind=kind, object_keys=object_keys)
        self.session.add(job)
        self.session.flush()
        return job

    def complete(self, job: DeletionJob) -> None:
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
        job.object_keys = []
        job.user_id = None

    def fail(self, job: DeletionJob, message: str) -> None:
        job.status = "pending"
        job.attempts += 1
        job.error_message = message[:1000]

    def get(self, job_id: str) -> DeletionJob | None:
        return self.session.get(DeletionJob, job_id)

    def pending(self, limit: int) -> list[DeletionJob]:
        return list(
            self.session.scalars(
                select(DeletionJob)
                .where(DeletionJob.status == "pending")
                .order_by(DeletionJob.created_at)
                .limit(limit)
            )
        )
