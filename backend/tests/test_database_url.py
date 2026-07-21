from app.db.url import sqlalchemy_database_url


def test_railway_postgresql_url_uses_psycopg3_driver() -> None:
    assert sqlalchemy_database_url("postgresql://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )


def test_explicit_driver_url_is_unchanged() -> None:
    url = "postgresql+psycopg://user:pass@host/db"
    assert sqlalchemy_database_url(url) == url
