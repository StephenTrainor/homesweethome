from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from .supabase_client import supabase_for_user

bearer_scheme = HTTPBearer(auto_error=True)


@dataclass(slots=True)
class AuthContext:
    user_id: str
    email: str | None
    access_token: str
    supabase: Client


async def get_auth_context(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthContext:
    """Verify the bearer token with Supabase and return a per-request client.

    `auth.get_user(token)` makes a single round trip to Supabase Auth, which
    cryptographically validates the JWT. We then attach the token to a
    Postgres client so RLS sees `auth.uid()` correctly.
    """
    token = creds.credentials
    supabase = supabase_for_user(token)
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception as exc:  # network or invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        ) from exc

    user = getattr(user_resp, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    user_id = str(user.id)
    email = getattr(user, "email", None)

    # Ensure profile exists (backfill for users who signed up before trigger was created)
    supabase.table("profiles").upsert(
        {"id": user_id, "email": email},
        on_conflict="id",
    ).execute()

    return AuthContext(
        user_id=user_id,
        email=email,
        access_token=token,
        supabase=supabase,
    )


def get_idempotency_key(request: Request) -> str | None:
    """Read `Idempotency-Key` header. Returning None means caller didn't send one."""
    key = request.headers.get("Idempotency-Key") or request.headers.get("idempotency-key")
    if key is None:
        return None
    key = key.strip()
    if not key:
        return None
    if len(key) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key too long (max 200 chars)",
        )
    return key
