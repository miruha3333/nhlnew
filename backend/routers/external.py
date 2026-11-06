from fastapi import APIRouter
from backend.config import ESPN_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache
from backend.services.teams import normalize_team_abbr

router = APIRouter(prefix="/api", tags=["External"])


async def fetch_injuries_dict() -> dict:
    url = f"{ESPN_BASE}/injuries"
    data = await fetch_with_cache("espn:injuries", url, CACHE_TTL["espn"])
    if not isinstance(data, dict):
        return {}

    teams_data = data.get("injuries", [])
    result = {}
    if not isinstance(teams_data, list):
        return {}

    for item in teams_data:
        if not isinstance(item, dict):
            continue
        team_abbr = normalize_team_abbr(item.get("displayName") or item.get("name") or "")
        injuries_list = item.get("injuries", [])
        if not isinstance(injuries_list, list):
            continue

        team_injuries = []
        for inj in injuries_list:
            if not isinstance(inj, dict):
                continue
            athlete = inj.get("athlete", {}) or {}
            pos = athlete.get("position", {})
            pos_code = pos.get("abbreviation") if isinstance(pos, dict) else str(pos or "")
            details = inj.get("details", {})
            detail_desc = details.get("type") or details.get("detail") or inj.get("type") or inj.get("shortComment") or ""
            status = inj.get("status") or "Injured"
            headshot = athlete.get("headshot", {}).get("href", "") if isinstance(athlete.get("headshot"), dict) else (athlete.get("headshot") or "")

            team_injuries.append({
                "id": athlete.get("id"),
                "name": athlete.get("displayName") or athlete.get("name") or "Игрок",
                "position": pos_code,
                "status": status,
                "details": detail_desc,
                "headshot": headshot,
            })
        if team_abbr and team_injuries:
            result[team_abbr] = team_injuries

    return result


@router.get("/injuries")
async def get_injuries():
    return await fetch_injuries_dict()


@router.get("/transactions")
async def transactions():
    url = f"{ESPN_BASE}/transactions"
    data = await fetch_with_cache("espn:transactions", url, CACHE_TTL["transactions"])
    if not isinstance(data, dict):
        return {"transactions": []}

    raw_tx = data.get("transactions", [])
    if not isinstance(raw_tx, list):
        return {"transactions": []}

    result = []
    for t in raw_tx[:50]:
        if not isinstance(t, dict):
            continue
        team_obj = t.get("team") or {}
        team_name = team_obj.get("displayName") or team_obj.get("name") or ""
        result.append({
            "date": t.get("date", ""),
            "description": t.get("description") or t.get("text") or "",
            "team": normalize_team_abbr(team_name),
        })

    return {"transactions": result}


@router.get("/scoreboard-espn")
async def get_scoreboard_espn(date: str | None = None):
    params = f"?dates={date.replace('-', '')}" if date else ""
    url = f"{ESPN_BASE}/scoreboard{params}"
    cache_key = f"espn:scoreboard:{date or 'today'}"
    data = await fetch_with_cache(cache_key, url, CACHE_TTL["espn"])
    if not isinstance(data, dict):
        return []
    return data.get("events", []) if isinstance(data.get("events"), list) else []
