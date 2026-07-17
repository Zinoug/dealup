from app.core.config import get_settings
from app.db.session import session_factory
from app.integrations import MediaStorage
from app.services.deletions import DeletionService


def main() -> None:
    settings = get_settings()
    with session_factory()() as session:
        completed, failed = DeletionService(
            session, MediaStorage(settings)
        ).retry_pending()
    print(f"deletion_jobs completed={completed} failed={failed}")


if __name__ == "__main__":
    main()
