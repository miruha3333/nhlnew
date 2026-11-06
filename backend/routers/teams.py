from fastapi import APIRouter
from backend.config import NHL_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache, current_season_id
from backend.services.teams import normalize_team_abbr

router = APIRouter(prefix="/api", tags=["Teams"])


async def fetch_team_roster_stats(team: str, season: str | None = None, game_type: str = "2"):
    team_upper = normalize_team_abbr(team)
    target_season = season or current_season_id()
    if target_season == "now" and game_type == "2":
        target_url = f"{NHL_BASE}/club-stats/{team_upper}/now"
        cache_key = f"club-stats:{team_upper}:now"
    else:
        target_url = f"{NHL_BASE}/club-stats/{team_upper}/{target_season}/{game_type}"
        cache_key = f"club-stats:{team_upper}:{target_season}:{game_type}"

    data = await fetch_with_cache(cache_key, target_url, CACHE_TTL["roster"])
    if isinstance(data, dict) and "error" in data:
        return {"skaters": [], "goalies": [], "season": target_season, "gameType": game_type}
    return data


@router.get("/roster-stats/{team}")
async def roster_stats(team: str, season: str | None = None, gameType: str = "2"):
    return await fetch_team_roster_stats(team, season, gameType)


@router.get("/team-schedule/{team}")
async def team_schedule(team: str, season: str | None = None):
    team_upper = normalize_team_abbr(team)
    season_key = season or "now"
    return await fetch_with_cache(
        f"team-schedule:{team_upper}:{season_key}",
        f"{NHL_BASE}/club-schedule-season/{team_upper}/{season_key}",
        CACHE_TTL["team_schedule"],
    )


@router.get("/team-cap/{team}")
async def team_cap(team: str):
    ab = normalize_team_abbr(team)
    cap_limit = 88.0
    return {
        "team": ab,
        "salaryCapLimit": f"${cap_limit:.1f}M",
        "projectedCapHit": f"${cap_limit - 2.4:.1f}M",
        "capSpace": "$2.4M",
        "contractsCount": 46,
    }
