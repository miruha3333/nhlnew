import asyncio
import re
import time
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.config import NHL_BASE, NHL_STATS_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache, current_season_id, _cache
from backend.services.teams import normalize_team_abbr
from backend.routers.external import fetch_injuries_dict
from backend.routers.teams import fetch_team_roster_stats

router = APIRouter(prefix="/api", tags=["Games"])

_votes_store: dict[str, dict[str, int]] = {}


@router.get("/matchup/{game_id}")
async def matchup(game_id: str):
    return await fetch_with_cache(f"matchup:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/landing", CACHE_TTL["matchup"])


@router.get("/boxscore/{game_id}")
async def boxscore(game_id: str):
    return await fetch_with_cache(f"boxscore:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/boxscore", CACHE_TTL["boxscore"])


@router.get("/right-rail/{game_id}")
async def right_rail(game_id: str):
    return await fetch_with_cache(f"rightrail:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/right-rail", CACHE_TTL["rightrail"])


@router.get("/score/{game_id}")
async def score(game_id: str):
    return await fetch_with_cache(f"score:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/landing", CACHE_TTL["score"])


@router.api_route("/vote/{game_id}", methods=["GET", "POST"])
async def vote(game_id: str, request: Request):
    store_key = f"pickem_{game_id}"
    if store_key not in _votes_store:
        _votes_store[store_key] = {"away": 0, "tie": 0, "home": 0}

    current = _votes_store[store_key]

    if request.method == "POST":
        try:
            body = await request.json()
            pick = body.get("pick")
            if pick in current:
                current[pick] += 1
                _votes_store[store_key] = current
        except Exception:
            pass

    total = sum(current.values()) or 1
    away_pct = round((current["away"] / total) * 100)
    tie_pct = round((current["tie"] / total) * 100)
    home_pct = 100 - away_pct - tie_pct

    return JSONResponse({
        "gameId": game_id,
        "votes": current,
        "total": total,
        "awayPct": away_pct,
        "tiePct": tie_pct,
        "homePct": home_pct,
    })


@router.get("/game-youtube-recap")
async def game_youtube_recap(away: str, home: str, date: str):
    query = f"NHL highlights {away} vs {home} {date}"
    cache_key = f"yt:recap:{away}:{home}:{date}"
    now = time.time()
    cached = _cache.get(cache_key)

    if cached and now - cached[0] < CACHE_TTL["video"]:
        return cached[1]

    search_url = f"https://www.youtube.com/results?search_query={httpx.QueryParams({'search_query': query})}"

    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        try:
            resp = await client.get(
                search_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            if resp.status_code == 200:
                html = resp.text
                match = re.search(r'"videoRenderer"\s*:\s*\{[^}]*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"', html)
                if not match:
                    match = re.search(r'"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"', html)

                video_id = match.group(1) if match else None
                result = {
                    "videoId": video_id,
                    "embedUrl": f"https://www.youtube.com/embed/{video_id}?playsinline=1&rel=0" if video_id else None,
                }
                _cache[cache_key] = (now, result)
                return result
        except Exception:
            pass

    return {"videoId": None, "embedUrl": None}


@router.get("/pregame/{game_id}")
async def pregame(
    game_id: str,
    date: str | None = None,
    away: str | None = None,
    home: str | None = None,
):
    current_season = current_season_id()

    rail_task = fetch_with_cache(f"rightrail:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/right-rail", CACHE_TTL["rightrail"])
    landing_task = fetch_with_cache(f"landing:{game_id}", f"{NHL_BASE}/gamecenter/{game_id}/landing", CACHE_TTL["score"])
    standings_task = fetch_with_cache("standings", f"{NHL_BASE}/standings/now", CACHE_TTL["standings"])
    injuries_task = fetch_injuries_dict()
    summary_task = fetch_with_cache(
        f"team-summary:{current_season}",
        f"{NHL_STATS_BASE}/team/summary?isAggregate=false&isGame=false&cayenneExp=gameTypeId=2%20and%20seasonId={current_season}",
        CACHE_TTL["standings"],
    )

    rail_data, landing_data, standings_data, injuries_data, summary_data = await asyncio.gather(
        rail_task,
        landing_task,
        standings_task,
        injuries_task,
        summary_task,
        return_exceptions=True,
    )

    rail_data = rail_data if isinstance(rail_data, dict) else {}
    landing_data = landing_data if isinstance(landing_data, dict) else {}
    standings_data = standings_data if isinstance(standings_data, dict) else {}
    injuries_data = injuries_data if isinstance(injuries_data, dict) else {}
    summary_data = summary_data if isinstance(summary_data, dict) else {}

    away_team_obj = landing_data.get("awayTeam") or {}
    home_team_obj = landing_data.get("homeTeam") or {}

    away_abbr = normalize_team_abbr(away or away_team_obj.get("abbrev") or away_team_obj.get("teamAbbrev"))
    home_abbr = normalize_team_abbr(home or home_team_obj.get("abbrev") or home_team_obj.get("teamAbbrev"))
    game_date = date or landing_data.get("gameDate") or ""

    away_roster_task = fetch_team_roster_stats(away_abbr) if away_abbr else asyncio.sleep(0, result={})
    home_roster_task = fetch_team_roster_stats(home_abbr) if home_abbr else asyncio.sleep(0, result={})

    away_roster, home_roster = await asyncio.gather(away_roster_task, home_roster_task)
    away_roster = away_roster if isinstance(away_roster, dict) else {}
    home_roster = home_roster if isinstance(home_roster, dict) else {}

    standings_rows = standings_data.get("standings", []) if isinstance(standings_data, dict) else []
    standings_map = {}
    for row in standings_rows:
        if isinstance(row, dict):
            abbr = normalize_team_abbr(row.get("teamAbbrev"))
            if abbr:
                standings_map[abbr] = row

    away_st = standings_map.get(away_abbr, {})
    home_st = standings_map.get(home_abbr, {})

    summary_rows = summary_data.get("data", []) if isinstance(summary_data, dict) else []
    summary_map = {}
    for r in summary_rows:
        if isinstance(r, dict):
            ab = normalize_team_abbr(r.get("teamFullName") or r.get("teamAbbrev") or "")
            if ab:
                summary_map[ab] = {
                    "pp": r.get("powerPlayPct"),
                    "pk": r.get("penaltyKillPct"),
                    "sfPg": round(float(r["shotsForPerGame"]), 1) if r.get("shotsForPerGame") is not None else None,
                    "saPg": round(float(r["shotsAgainstPerGame"]), 1) if r.get("shotsAgainstPerGame") is not None else None,
                }

    away_spec = summary_map.get(away_abbr, {})
    home_spec = summary_map.get(home_abbr, {})

    away_gp = away_st.get("gamesPlayed") or 1
    home_gp = home_st.get("gamesPlayed") or 1

    away_gf_pg = round((away_st.get("goalFor", 0) / away_gp), 2) if away_gp else 0
    home_gf_pg = round((home_st.get("goalFor", 0) / home_gp), 2) if home_gp else 0
    away_ga_pg = round((away_st.get("goalAgainst", 0) / away_gp), 2) if away_gp else 0
    home_ga_pg = round((home_st.get("goalAgainst", 0) / home_gp), 2) if home_gp else 0

    def make_comp(cat, label, away_val, home_val, higher_is_better=True):
        return {
            "category": cat,
            "label": label,
            "awayValue": away_val,
            "homeValue": home_val,
            "higherIsBetter": higher_is_better,
        }

    pregame_stats = [
        make_comp("powerPlayPctg", "Большинство (%PP)", away_spec.get("pp") or away_st.get("powerPlayPctg"), home_spec.get("pp") or home_st.get("powerPlayPctg"), True),
        make_comp("penaltyKillPctg", "Меньшинство (%PK)", away_spec.get("pk") or away_st.get("penaltyKillPctg"), home_spec.get("pk") or home_st.get("penaltyKillPctg"), True),
        make_comp("goalsForPerGame", "Заброшено за игру (GF/G)", away_gf_pg, home_gf_pg, True),
        make_comp("goalsAgainstPerGame", "Пропущено за игру (GA/G)", away_ga_pg, home_ga_pg, False),
        make_comp("shotsForPerGame", "Броски по воротам соперника (SF/G)", away_spec.get("sfPg"), home_spec.get("sfPg"), True),
        make_comp("shotsAgainstPerGame", "Броски соперника по своим воротам (SA/G)", away_spec.get("saPg"), home_spec.get("saPg"), False),
    ]

    away_streak_code = away_st.get("streakCode") or ""
    away_streak_count = away_st.get("streakCount") or 0
    home_streak_code = home_st.get("streakCode") or ""
    home_streak_count = home_st.get("streakCount") or 0

    rail_streaks = rail_data.get("streaks") or {}
    if isinstance(rail_streaks, dict):
        if "awayTeam" in rail_streaks:
            away_streak_code = rail_streaks["awayTeam"].get("type") or away_streak_code
            away_streak_count = rail_streaks["awayTeam"].get("count") or away_streak_count
        if "homeTeam" in rail_streaks:
            home_streak_code = rail_streaks["homeTeam"].get("type") or home_streak_code
            home_streak_count = rail_streaks["homeTeam"].get("count") or home_streak_count

    season_series = rail_data.get("seasonSeries") or landing_data.get("seasonSeries") or []
    if isinstance(season_series, dict):
        season_series = season_series.get("games") or [season_series]

    return {
        "gameId": game_id,
        "gameDate": game_date,
        "startTimeUTC": landing_data.get("startTimeUTC"),
        "awayTeam": {
            "abbrev": away_abbr,
            "name": away_team_obj.get("name") or away_team_obj.get("placeName", {}).get("default") or away_abbr,
            "logo": away_team_obj.get("logo") or f"https://assets.nhle.com/logos/nhl/svg/{away_abbr}_light.svg",
            "record": {
                "wins": away_st.get("wins", 0),
                "losses": away_st.get("losses", 0),
                "otLosses": away_st.get("otLosses", 0),
                "points": away_st.get("points", 0),
                "gamesPlayed": away_st.get("gamesPlayed", 0),
            },
            "homeRecord": f"{away_st.get('homeWins', 0)}-{away_st.get('homeLosses', 0)}-{away_st.get('homeOtLosses', 0)}",
            "roadRecord": f"{away_st.get('roadWins', 0)}-{away_st.get('roadLosses', 0)}-{away_st.get('roadOtLosses', 0)}",
            "l10Record": f"{away_st.get('l10Wins', 0)}-{away_st.get('l10Losses', 0)}-{away_st.get('l10OtLosses', 0)}",
            "streak": f"{away_streak_code}{away_streak_count}" if away_streak_code else "—",
            "streakCode": away_streak_code,
            "streakCount": away_streak_count,
        },
        "homeTeam": {
            "abbrev": home_abbr,
            "name": home_team_obj.get("name") or home_team_obj.get("placeName", {}).get("default") or home_abbr,
            "logo": home_team_obj.get("logo") or f"https://assets.nhle.com/logos/nhl/svg/{home_abbr}_light.svg",
            "record": {
                "wins": home_st.get("wins", 0),
                "losses": home_st.get("losses", 0),
                "otLosses": home_st.get("otLosses", 0),
                "points": home_st.get("points", 0),
                "gamesPlayed": home_st.get("gamesPlayed", 0),
            },
            "homeRecord": f"{home_st.get('homeWins', 0)}-{home_st.get('homeLosses', 0)}-{home_st.get('homeOtLosses', 0)}",
            "roadRecord": f"{home_st.get('roadWins', 0)}-{home_st.get('roadLosses', 0)}-{home_st.get('roadOtLosses', 0)}",
            "l10Record": f"{home_st.get('l10Wins', 0)}-{home_st.get('l10Losses', 0)}-{home_st.get('l10OtLosses', 0)}",
            "streak": f"{home_streak_code}{home_streak_count}" if home_streak_code else "—",
            "streakCode": home_streak_code,
            "streakCount": home_streak_count,
        },
        "preGameStats": pregame_stats,
        "injuries": {
            "away": injuries_data.get(away_abbr, []),
            "home": injuries_data.get(home_abbr, []),
        },
        "seasonSeries": season_series,
    }
