import time
from typing import Any
import httpx
from backend.config import DEFAULT_HEADERS

_cache: dict[str, tuple[float, Any]] = {}


async def fetch_with_cache(cache_key: str, url: str, ttl: int) -> Any:
    now = time.time()
    cached = _cache.get(cache_key)

    if cached and now - cached[0] < ttl:
        return cached[1]

    async with httpx.AsyncClient(timeout=14, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=DEFAULT_HEADERS)
            if response.status_code == 200:
                data = response.json()
                _cache[cache_key] = (now, data)
                return data
            if cache_key in _cache:
                return _cache[cache_key][1]
            return {"error": f"API status {response.status_code}"}
        except Exception as error:
            if cache_key in _cache:
                return _cache[cache_key][1]
            return {"error": str(error)}


def current_season_id() -> str:
    now = time.localtime()
    start_year = now.tm_year if now.tm_mon >= 9 else now.tm_year - 1
    return f"{start_year}{start_year + 1}"
