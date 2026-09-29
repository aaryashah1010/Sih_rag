from dataclasses import dataclass

import jwt
from fastapi import Depends, Request

from rag_service.api.problems import ProblemError
from rag_service.config import Settings, get_settings


@dataclass(frozen=True)
class ServiceCaller:
    subject: str
    user_id: str | None
    roles: tuple[str, ...]


def _unauthorized(detail: str) -> ProblemError:
    return ProblemError(401, "SERVICE_TOKEN_INVALID", "Service authentication required", detail)


def require_service_token(request: Request, settings: Settings = Depends(get_settings)) -> ServiceCaller:
    """Accept only short-lived tokens minted by the Node.js API for this internal audience.

    Browser access tokens are signed with a different secret and carry a different audience,
    so they fail verification here.
    """
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("A bearer service token is required.")
    try:
        claims = jwt.decode(
            token,
            settings.rag_service_token_secret,
            algorithms=["HS256"],
            audience=settings.service_token_audience,
            issuer=settings.service_token_issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=5,
        )
    except jwt.PyJWTError:
        raise _unauthorized("The service token is invalid or expired.") from None
    if claims["exp"] - claims["iat"] > settings.service_token_max_lifetime_seconds:
        raise _unauthorized("The service token lifetime exceeds the allowed maximum.")
    roles = claims.get("roles", [])
    return ServiceCaller(
        subject=str(claims["sub"]),
        user_id=claims.get("uid"),
        roles=tuple(str(role) for role in roles) if isinstance(roles, list) else (),
    )
