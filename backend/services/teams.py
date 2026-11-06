from typing import Any

TEAM_NAME_TO_ABBREV = {
    "anaheim ducks": "ANA", "ducks": "ANA", "ana": "ANA",
    "boston bruins": "BOS", "bruins": "BOS", "bos": "BOS",
    "buffalo sabres": "BUF", "sabres": "BUF", "buf": "BUF",
    "calgary flames": "CGY", "flames": "CGY", "cgy": "CGY", "cal": "CGY",
    "carolina hurricanes": "CAR", "hurricanes": "CAR", "car": "CAR",
    "chicago blackhawks": "CHI", "blackhawks": "CHI", "chi": "CHI",
    "colorado avalanche": "COL", "avalanche": "COL", "col": "COL",
    "columbus blue jackets": "CBJ", "blue jackets": "CBJ", "cbj": "CBJ", "clb": "CBJ",
    "dallas stars": "DAL", "stars": "DAL", "dal": "DAL",
    "detroit red wings": "DET", "red wings": "DET", "det": "DET",
    "edmonton oilers": "EDM", "oilers": "EDM", "edm": "EDM",
    "florida panthers": "FLA", "panthers": "FLA", "fla": "FLA",
    "los angeles kings": "LAK", "kings": "LAK", "lak": "LAK", "la": "LAK",
    "minnesota wild": "MIN", "wild": "MIN", "min": "MIN",
    "montreal canadiens": "MTL", "canadiens": "MTL", "mtl": "MTL", "mon": "MTL", "montréal canadiens": "MTL",
    "nashville predators": "NSH", "predators": "NSH", "nsh": "NSH", "nas": "NSH",
    "new jersey devils": "NJD", "devils": "NJD", "njd": "NJD", "nj": "NJD",
    "new york islanders": "NYI", "islanders": "NYI", "nyi": "NYI",
    "new york rangers": "NYR", "rangers": "NYR", "nyr": "NYR",
    "ottawa senators": "OTT", "senators": "OTT", "ott": "OTT",
    "philadelphia flyers": "PHI", "flyers": "PHI", "phi": "PHI",
    "pittsburgh penguins": "PIT", "penguins": "PIT", "pit": "PIT",
    "san jose sharks": "SJS", "sharks": "SJS", "sjs": "SJS", "sj": "SJS",
    "seattle kraken": "SEA", "kraken": "SEA", "sea": "SEA",
    "st. louis blues": "STL", "st louis blues": "STL", "blues": "STL", "stl": "STL",
    "tampa bay lightning": "TBL", "lightning": "TBL", "tbl": "TBL", "tb": "TBL",
    "toronto maple leafs": "TOR", "maple leafs": "TOR", "tor": "TOR",
    "utah hockey club": "UTA", "utah": "UTA", "uta": "UTA", "utah mammoth": "UTA",
    "vancouver canucks": "VAN", "canucks": "VAN", "van": "VAN",
    "vegas golden knights": "VGK", "golden knights": "VGK", "vgk": "VGK",
    "washington capitals": "WSH", "capitals": "WSH", "wsh": "WSH", "was": "WSH",
    "winnipeg jets": "WPG", "jets": "WPG", "wpg": "WPG", "win": "WPG",
}

TEAM_ABBREV_ALIASES = {
    "TB": "TBL",
    "NJ": "NJD",
    "SJ": "SJS",
    "LA": "LAK",
    "WAS": "WSH",
    "MON": "MTL",
    "MTL": "MTL",
    "CLB": "CBJ",
    "NAS": "NSH",
    "WIN": "WPG",
    "CAL": "CGY",
}


def normalize_team_abbr(raw: Any) -> str:
    if not raw:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("default") or raw.get("abbrev") or raw.get("triCode") or raw.get("rawTricode") or ""
    val_str = str(raw).strip()
    upper = val_str.upper()
    if upper in TEAM_ABBREV_ALIASES:
        return TEAM_ABBREV_ALIASES[upper]
    if upper in TEAM_NAME_TO_ABBREV.values():
        return upper
    clean_key = val_str.lower().replace("é", "e")
    return TEAM_NAME_TO_ABBREV.get(clean_key, TEAM_NAME_TO_ABBREV.get(val_str.lower(), upper))
