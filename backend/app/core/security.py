from dataclasses import dataclass
from functools import lru_cache
import logging
import ssl

import certifi
import jwt
from fastapi import Header
from jwt import PyJWKClient

from app.core.config import Settings, get_settings
from app.core.errors import DealUpError


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthenticatedIdentity:
    clerk_user_id: str
    session_id: str | None = None


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> PyJWKClient:
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    return PyJWKClient(url, cache_keys=True, ssl_context=ssl_context)


def verify_clerk_token(token: str, settings: Settings) -> AuthenticatedIdentity:
    if not settings.clerk_jwks_url:
        raise DealUpError(
            "AUTH_NOT_CONFIGURED",
            "L’authentification n’est pas configurée.",
            503,
        )
    try:
        signing_key = _jwks_client(settings.clerk_jwks_url).get_signing_key_from_jwt(
            token
        )
        decode_options: dict[str, object] = {
            "algorithms": ["RS256"],
            "leeway": 5,
        }
        if settings.clerk_issuer:
            decode_options["issuer"] = settings.clerk_issuer
        jwt_options: dict[str, object] = {"require": ["exp", "nbf", "sub"]}
        if settings.clerk_audience:
            decode_options["audience"] = settings.clerk_audience
        else:
            jwt_options["verify_aud"] = False
        decode_options["options"] = jwt_options
        claims = jwt.decode(token, signing_key.key, **decode_options)
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        logger.warning(
            "Clerk token rejected error_type=%s environment=%s",
            type(exc).__name__,
            settings.app_env,
        )
        raise DealUpError(
            "AUTHENTICATION_REQUIRED", "Session invalide ou expirée.", 401
        ) from exc

    authorized_party = claims.get("azp")
    if (
        settings.clerk_authorized_parties
        and authorized_party
        and authorized_party not in settings.clerk_authorized_parties
    ):
        logger.warning(
            "Clerk token rejected error_type=UnauthorizedParty environment=%s",
            settings.app_env,
        )
        raise DealUpError(
            "AUTHENTICATION_REQUIRED", "Origine de session non autorisée.", 401
        )
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise DealUpError("AUTHENTICATION_REQUIRED", "Session invalide.", 401)
    return AuthenticatedIdentity(subject, claims.get("sid"))


def get_identity(
    authorization: str | None = Header(default=None),
    x_test_clerk_user_id: str | None = Header(default=None),
) -> AuthenticatedIdentity:
    settings = get_settings()
    if settings.auth_disabled and settings.app_env in {"local", "test"}:
        return AuthenticatedIdentity(x_test_clerk_user_id or "user_local_dealup")
    if not authorization or not authorization.startswith("Bearer "):
        raise DealUpError(
            "AUTHENTICATION_REQUIRED", "Connecte-toi pour continuer.", 401
        )
    return verify_clerk_token(authorization.removeprefix("Bearer ").strip(), settings)
