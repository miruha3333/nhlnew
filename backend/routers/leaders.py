import httpx
from fastapi import APIRouter
from backend.config import NHL_STATS_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache, current_season_id
from backend.services.teams import normalize_team_abbr

router = APIRouter(prefix="/api", tags=["Leaders"])


@router.get("/skater-leaders-ext")
@router.get("/leaders/{category}")
async def skater_leaders_ext(
    category: str = "points",
    season: str | None = None,
    limit: int = 50,
):
    target_season = season or current_season_id()
    safe_limit = max(1, min(limit, 100))

    sort_prop = "points"
    endpoint = "summary"

    if category == "goals":
        sort_prop = "goals"
    elif category == "assists":
        sort_prop = "assists"
    elif category == "plusMinus":
        sort_prop = "plusMinus"
    elif category in ("shots", "sog"):
        sort_prop = "shots"
    elif category in ("gameWinningGoals", "gwg"):
        sort_prop = "gameWinningGoals"
    elif category in ("penaltyMinutes", "pim"):
        sort_prop = "penaltyMinutes"
    elif category in ("toiPerGame", "atoi"):
        sort_prop = "timeOnIcePerGame"
    elif category in ("hits", "hit"):
        sort_prop = "hits"
        endpoint = "realtime"
    elif category in ("blockedShots", "blk"):
        sort_prop = "blockedShots"
        endpoint = "realtime"

    params = {
        "isAggregate": "false",
        "isGame": "false",
        "cayenneExp": f"gameTypeId=2 and seasonId={target_season}",
        "start": 0,
        "limit": safe_limit,
        "sort": f'[{{"property":"{sort_prop}","direction":"DESC"}}]',
    }

    url = f"{NHL_STATS_BASE}/skater/{endpoint}?{httpx.QueryParams(params)}"
    data = await fetch_with_cache(f"skaters-exact-v30:{target_season}:{category}:{safe_limit}", url, CACHE_TTL["leaders"])
    rows = data.get("data", []) if isinstance(data, dict) else []

    skaters = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        player_id = row.get("playerId")
        first_name = row.get("firstName", "")
        last_name = row.get("lastName", "")
        if isinstance(first_name, dict):
            first_name = first_name.get("default", "")
        if isinstance(last_name, dict):
            last_name = last_name.get("default", "")

        full_name = row.get("skaterFullName") or row.get("playerName") or f"{first_name} {last_name}".strip()
        team_abbr = normalize_team_abbr(row.get("teamAbbrevs") or row.get("teamAbbrev") or "")

        games_played = row.get("gamesPlayed", 0)
        total_toi_sec = row.get("timeOnIce", 0)
        toi_pg_sec = row.get("timeOnIcePerGame", (total_toi_sec / games_played if games_played else 0))

        toi_str = "0:00"
        if isinstance(toi_pg_sec, (int, float)):
            mins = int(toi_pg_sec // 60)
            secs = int(toi_pg_sec % 60)
            toi_str = f"{mins}:{secs:02d}"

        goals = row.get("goals", 0)
        assists = row.get("assists", 0)
        points = row.get("points", goals + assists)
        plus_minus = row.get("plusMinus", 0)
        shots = row.get("shots", row.get("sog", 0))
        hits = row.get("hits", 0)
        blocks = row.get("blockedShots", row.get("blocks", 0))
        gwg = row.get("gameWinningGoals", row.get("gwg", 0))
        pim = row.get("penaltyMinutes", row.get("pim", 0))

        val_to_show = points
        if category == "goals":
            val_to_show = goals
        elif category == "assists":
            val_to_show = assists
        elif category == "plusMinus":
            val_to_show = plus_minus
        elif category in ("shots", "sog"):
            val_to_show = shots
        elif category in ("hits", "hit"):
            val_to_show = hits
        elif category in ("blockedShots", "blk"):
            val_to_show = blocks
        elif category in ("gameWinningGoals", "gwg"):
            val_to_show = gwg
        elif category in ("penaltyMinutes", "pim"):
            val_to_show = pim
        elif category in ("toiPerGame", "atoi"):
            val_to_show = toi_str

        skaters.append({
            "id": player_id,
            "playerId": player_id,
            "name": full_name,
            "firstName": first_name,
            "lastName": last_name,
            "teamAbbrev": team_abbr,
            "headshot": f"https://assets.nhle.com/mugs/nhl/latest/{player_id}.png",
            "gamesPlayed": games_played,
            "goals": goals,
            "assists": assists,
            "points": points,
            "plusMinus": plus_minus,
            "penaltyMinutes": pim,
            "shots": shots,
            "hits": hits,
            "blockedShots": blocks,
            "gameWinningGoals": gwg,
            "toiPerGame": toi_str,
            "value": val_to_show,
        })

    return {
        "season": target_season,
        "category": category,
        category: skaters,
        "skaters": skaters,
    }


@router.get("/goalie-leaders")
async def goalie_leaders(limit: int = 100, season: str | None = None):
    limit = max(1, min(limit, 100))
    target_season = season or current_season_id()

    params = {
        "isAggregate": "false",
        "isGame": "false",
        "cayenneExp": f"seasonId={target_season} and gameTypeId=2",
        "start": 0,
        "limit": limit,
        "sort": '[{"property":"gamesPlayed","direction":"DESC"}]',
    }

    url = f"{NHL_STATS_BASE}/goalie/summary?{httpx.QueryParams(params)}"
    data = await fetch_with_cache(f"goalie-summary:v30:{target_season}:{limit}", url, CACHE_TTL["leaders"])
    rows = data.get("data", []) if isinstance(data, dict) else []

    goalies = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        first_name = row.get("firstName", "")
        last_name = row.get("lastName", "")
        if isinstance(first_name, dict):
            first_name = first_name.get("default", "")
        if isinstance(last_name, dict):
            last_name = last_name.get("default", "")

        player_id = row.get("playerId")
        full_name = row.get("goalieFullName") or row.get("playerName") or f"{first_name} {last_name}".strip()
        team_abbr = normalize_team_abbr(row.get("teamAbbrevs") or row.get("teamAbbrev") or "")

        time_on_ice = row.get("timeOnIce", 0)
        time_in_min = round(time_on_ice / 60) if isinstance(time_on_ice, (int, float)) else 0

        games_started = row.get("gamesStarted", row.get("gamesPlayed", 0))
        sv_pct = float(row.get("savePctg") or row.get("savePct") or 0.0)
        qs = round(games_started * (0.72 if sv_pct >= 0.910 else max(0.2, (sv_pct - 0.85) / 0.09)))

        goalies.append({
            "id": player_id,
            "playerId": player_id,
            "name": full_name,
            "firstName": first_name,
            "lastName": last_name,
            "teamAbbrev": team_abbr,
            "headshot": f"https://assets.nhle.com/mugs/nhl/latest/{player_id}.png",
            "gamesPlayed": row.get("gamesPlayed", 0),
            "gamesStarted": games_started,
            "wins": row.get("wins", 0),
            "losses": row.get("losses", 0),
            "otLosses": row.get("otLosses", 0),
            "savePctg": sv_pct,
            "gaa": row.get("goalsAgainstAverage", row.get("gaa", 0)),
            "shutouts": row.get("shutouts", 0),
            "saves": row.get("saves", 0),
            "shotsAgainst": row.get("shotsAgainst", row.get("shots", 0)),
            "qualityStarts": qs,
            "timeOnIce": time_in_min,
        })

    return {"season": target_season, "goalies": goalies}
