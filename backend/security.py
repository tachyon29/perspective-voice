from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class SupabaseUser:
    id: str
    email: str


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> SupabaseUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase is not configured on the backend.")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {credentials.credentials}",
                },
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="Could not verify your Supabase session.") from error
    if response.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Your session expired. Sign in again.", headers={"WWW-Authenticate": "Bearer"})
    if response.is_error:
        raise HTTPException(status_code=503, detail="Supabase could not verify your session.")
    try:
        profile = response.json()
        user_id, email = profile["id"], profile["email"]
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(status_code=401, detail="Supabase returned an invalid session.") from error
    return SupabaseUser(id=user_id, email=email)
