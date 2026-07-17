import os
import tempfile
from collections.abc import Generator

import pytest

database_file = tempfile.NamedTemporaryFile(
    prefix="dealup-test-", suffix=".db", delete=False
)
database_file.close()
os.environ["APP_ENV"] = "test"
os.environ["AUTH_DISABLED"] = "true"
os.environ["DATABASE_URL"] = f"sqlite:///{database_file.name}"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["ANALYSIS_INVOKE_MODE"] = "disabled"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, get_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=get_engine())
    Base.metadata.create_all(bind=get_engine())
    yield


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
