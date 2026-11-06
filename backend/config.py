import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
ROOT_INDEX = BASE_DIR / "index.html"
STATIC_INDEX = STATIC_DIR / "index.html"
NEWS_FILE = BASE_DIR / "news.json"

NHL_BASE = "https://api-web.nhle.com/v1"
NHL_STATS_BASE = "https://api.nhle.com/stats/rest/en"
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://nhl-miniapp-1.onrender.com")
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"
DONATE_URL = "https://t.me/xokkey9"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

CACHE_TTL = {
    "schedule": 60 * 15,
    "standings": 60 * 30,
    "leaders": 60 * 30,
    "score": 15,
    "pbp": 15,
    "roster": 60 * 45,
    "player": 60 * 45,
    "boxscore": 20,
    "rightrail": 20,
    "matchup": 60 * 30,
    "player_search": 60 * 10,
    "team_schedule": 60 * 10,
    "pregame": 60 * 10,
    "espn": 60 * 15,
    "video": 60 * 30,
    "transactions": 60 * 30,
    "advanced": 60 * 30,
}
