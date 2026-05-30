from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from .config import get_settings


@lru_cache(maxsize=1)
def supabase_anon() -> Client:
    """Return a Supabase client using the anon key for public read operations."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        ),
    )


def supabase_for_user(access_token: str) -> Client:
    """Return a Supabase client that acts as the calling user.

    The user's JWT is forwarded on every PostgREST/Storage request, so Postgres
    RLS policies are what actually gate access — we never need a service-role
    key on the API server.
    """
    settings = get_settings()
    client = create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
            auto_refresh_token=False,
            persist_session=False,
        ),
    )
    client.postgrest.auth(access_token)
    return client
