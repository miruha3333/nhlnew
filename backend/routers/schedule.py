import asyncio
from fastapi import APIRouter
from backend.config import NHL_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache
from backend.services.teams import normalize_team_abbr

router = APIRouter(prefix="/api", tags=["Schedule"])


@router.get("/schedule")
async def schedule(date: str):
    schedule_url = f"{NHL_BASE}/schedule/{date}"
    standings_url = f"{NHL_BASE}/standings/now"

    schedule_data, standings_data = await asyncio.gather(
        fetch_with_cache(f"schedule:{date}", schedule_url, CACHE_TTL["schedule"]),
        fetch_with_cache("standings", standings_url, CACHE_TTL["standings"]),
    )

    if not isinstance(schedule_data, dict):
        return schedule_data

    standings_rows = standings_data.get("standings", []) if isinstance(standings_data, dict) else []
    standings_map = {}
    for row in standings_rows:
        if not isinstance(row, dict):
            continue
        abbreviation = normalize_team_abbr(row.get("teamAbbrev"))
        if not abbreviation:
            continue
        standings_map[abbreviation] = {
            "wins": row.get("wins", 0),
            "losses": row.get("losses", 0),
            "otLosses": row.get("otLosses", 0),
            "points": row.get("points", 0),
            "clinchIndicator": row.get("clinchIndicator"),
        }

    game_week = schedule_data.get("gameWeek", [])
    if isinstance(game_week, list):
        for day in game_week:
            if not isinstance(day, dict):
                continue
            for game in day.get("games", []):
                if not isinstance(game, dict):
                    continue
                for side in ("awayTeam", "homeTeam"):
                    team = game.get(side) or {}
                    if not isinstance(team, dict):
                        continue
                    abbrev = normalize_team_abbr(team.get("abbrev") or team.get("teamAbbrev"))
                    if abbrev and abbrev in standings_map:
                        team["currentRecord"] = standings_map[abbrev]

    return schedule_data
