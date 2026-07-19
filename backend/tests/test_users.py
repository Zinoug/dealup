from sqlalchemy.exc import IntegrityError

from app.db.session import session_factory
from app.models import User
from app.integrations import ClerkUserProfile
from app.services.users import UserService


def test_get_or_create_recovers_when_another_request_created_the_user(
    monkeypatch,
) -> None:
    clerk_user_id = "user_concurrent_clerk"
    with session_factory()() as session:
        existing = User(clerk_user_id=clerk_user_id)
        session.add(existing)
        session.commit()
        existing_id = existing.id

    with session_factory()() as session:
        service = UserService(session)

        def lose_insert_race(_: str):
            raise IntegrityError(
                "INSERT INTO users",
                {"clerk_user_id": clerk_user_id},
                Exception("duplicate clerk_user_id"),
            )

        monkeypatch.setattr(service.repo, "get_or_create", lose_insert_race)

        resolved = service.get_or_create(clerk_user_id)

        assert resolved.id == existing_id
        assert resolved.clerk_user_id == clerk_user_id


def test_delete_account_anonymizes_user_and_is_no_longer_addressable(client) -> None:
    created = client.get("/v1/me")
    assert created.status_code == 200
    original_clerk_id = created.json()["clerk_user_id"]

    deleted = client.delete("/v1/me")
    assert deleted.status_code == 204

    with session_factory()() as session:
        assert (
            session.query(User).filter_by(clerk_user_id=original_clerk_id).one_or_none()
            is None
        )
        tombstone = session.query(User).one()
        assert tombstone.deleted_at is not None
        assert tombstone.clerk_user_id.startswith("deleted:")


def test_clerk_profile_is_stored_and_exposed_by_me(client) -> None:
    with session_factory()() as session:
        profile = ClerkUserProfile(
            clerk_user_id="user_local_dealup",
            email="founder@joindealup.com",
            display_name="Zineddine",
            auth_provider="apple",
            clerk_created_at=None,
        )
        UserService(session).sync_profile(profile)

    response = client.get("/v1/me")

    assert response.status_code == 200
    assert response.json()["email"] == "founder@joindealup.com"
    assert response.json()["display_name"] == "Zineddine"
    assert response.json()["auth_provider"] == "apple"
