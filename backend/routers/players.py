from fastapi import APIRouter
from backend.config import NHL_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache

router = APIRouter(prefix="/api", tags=["Players"])


@router.get("/player/{player_id}")
async def player(player_id: str):
    return await fetch_with_cache(
        f"player:{player_id}",
        f"{NHL_BASE}/player/{player_id}/landing",
        CACHE_TTL["player"],
    )
