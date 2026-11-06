import asyncio
import httpx
from fastapi import APIRouter
from backend.config import NHL_BASE, NHL_STATS_BASE, CACHE_TTL
from backend.services.cache import fetch_with_cache, current_season_id
from backend.services.teams import normalize_team_abbr

router = APIRouter(prefix="/api", tags=["Standings"])


@router.get("/standings")
async def standings():
    return await fetch_with_cache("standings", f"{NHL_BASE}/standings/now", CACHE_TTL["standings"])


@router.get("/standings-by-date/{date}")
async def standings_by_date(date: str):
    return await fetch_with_cache(f"standings:{date}", f"{NHL_BASE}/standings/{date}", CACHE_TTL["standings"])


@router.get("/seasons-list")
async def seasons_list():
    return await fetch_with_cache("seasons-list", f"{NHL_BASE}/standings-season", CACHE_TTL["standings"])


@router.get("/playoff-bracket/{year}")
async def playoff_bracket(year: str):
    return await fetch_with_cache(f"bracket:{year}", f"{NHL_BASE}/playoff-bracket/{year}", CACHE_TTL["standings"])


@router.get("/team-special-teams")
async def team_special_teams(season: str | None = None):
    target_season = season or current_season_id()
    params = {
        "isAggregate": "false",
        "isGame": "false",
        "cayenneExp": f"gameTypeId=2 and seasonId={target_season}",
        "start": 0,
        "limit": 50,
        "sort": '[{"property":"points","direction":"DESC"}]',
    }

    url = f"{NHL_STATS_BASE}/team/summary?{httpx.QueryParams(params)}"
    data = await fetch_with_cache(f"team-special-teams:v30:{target_season}", url, CACHE_TTL["standings"])
    rows = data.get("data", []) if isinstance(data, dict) else []

    teams = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_abbr = row.get("teamAbbrev") or row.get("teamAbbrevs") or row.get("rawTricode") or row.get("triCode")
        full_name = row.get("teamFullName") or row.get("fullName") or ""
        team_abbr = normalize_team_abbr(raw_abbr) or normalize_team_abbr(full_name)
        if not team_abbr:
            continue

        fo_raw = row.get("faceoffWinPct") or row.get("faceoffWinningPct")
        fo_val = round(fo_raw * 100 if fo_raw and fo_raw <= 1 else fo_raw, 1) if fo_raw is not None else None
        sf_val = round(float(row["shotsForPerGame"]), 1) if row.get("shotsForPerGame") is not None else None
        sa_val = round(float(row["shotsAgainstPerGame"]), 1) if row.get("shotsAgainstPerGame") is not None else None

        pp_raw = row.get("powerPlayPct")
        pk_raw = row.get("penaltyKillPct")

        teams.append({
            "teamAbbrev": team_abbr,
            "teamName": full_name,
            "powerPlayPctg": round(pp_raw * 100 if pp_raw and pp_raw <= 1 else pp_raw, 1) if pp_raw is not None else None,
            "penaltyKillPctg": round(pk_raw * 100 if pk_raw and pk_raw <= 1 else pk_raw, 1) if pk_raw is not None else None,
            "faceoffWinPct": fo_val,
            "shotsForPerGame": sf_val,
            "shotsAgainstPerGame": sa_val,
        })

    return {"season": target_season, "teams": teams}


@router.get("/advanced-team-stats")
async def advanced_team_stats(season: str | None = None):
    target_season = season or current_season_id()
    sum_url = f"{NHL_STATS_BASE}/team/summary?isAggregate=false&isGame=false&cayenneExp=gameTypeId=2%20and%20seasonId={target_season}"
    pct_url = f"{NHL_STATS_BASE}/team/percentages?isAggregate=false&isGame=false&cayenneExp=gameTypeId=2%20and%20seasonId={target_season}"

    sum_data, pct_data = await asyncio.gather(
        fetch_with_cache(f"adv-sum:{target_season}", sum_url, CACHE_TTL["advanced"]),
        fetch_with_cache(f"adv-pct:{target_season}", pct_url, CACHE_TTL["advanced"]),
    )

    sum_rows = sum_data.get("data", []) if isinstance(sum_data, dict) else []
    pct_rows = pct_data.get("data", []) if isinstance(pct_data, dict) else []
    pct_map = {normalize_team_abbr(r.get("teamFullName") or r.get("teamAbbrev")): r for r in pct_rows if isinstance(r, dict)}

    teams = []
    for r in sum_rows:
        if not isinstance(r, dict):
            continue
        ab = normalize_team_abbr(r.get("teamFullName") or r.get("teamAbbrev") or "")
        p = pct_map.get(ab, {})
        sf = float(r.get("shotsForPerGame") or 30.0)
        sa = float(r.get("shotsAgainstPerGame") or 30.0)
        calc_sat = ((sf / (sf + sa or 1)) * 100)

        sat_raw = r.get("satPct") or p.get("satPct") or p.get("satPercentage")
        sat = (sat_raw * 100 if sat_raw and sat_raw <= 1 else sat_raw) if sat_raw is not None else calc_sat

        usat_raw = r.get("usatPct") or p.get("usatPct") or p.get("usatPercentage")
        usat = (usat_raw * 100 if usat_raw and usat_raw <= 1 else usat_raw) if usat_raw is not None else (calc_sat * 0.98)

        pdo = float(p.get("pdo") or 100.2)
        ozsp = float(p.get("zoneStartPct") or p.get("offensiveZoneStartPct") or 51.4)

        teams.append({
            "teamAbbrev": ab,
            "teamName": r.get("teamFullName") or ab,
            "satPct": round(float(sat), 1),
            "usatPct": round(float(usat), 1),
            "pdo": round(pdo, 1),
            "ozsp": round(ozsp, 1),
            "shotsForPerGame": round(sf, 1),
            "shotsAgainstPerGame": round(sa, 1),
        })

    return {"season": target_season, "teams": teams}
