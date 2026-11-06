from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import STATIC_DIR, ROOT_INDEX, STATIC_INDEX
from backend.routers.schedule import router as schedule_router
from backend.routers.standings import router as standings_router
from backend.routers.leaders import router as leaders_router
from backend.routers.games import router as games_router
from backend.routers.teams import router as teams_router
from backend.routers.players import router as players_router
from backend.routers.external import router as external_router
from backend.routers.news import router as news_router

app = FastAPI(title="NHL Mini App v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение всех модульных роутеров
app.include_router(schedule_router)
app.include_router(standings_router)
app.include_router(leaders_router)
app.include_router(games_router)
app.include_router(teams_router)
app.include_router(players_router)
app.include_router(external_router)
app.include_router(news_router)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def index():
    no_cache_headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    if STATIC_INDEX.is_file():
        return FileResponse(str(STATIC_INDEX), media_type="text/html", headers=no_cache_headers)
    if ROOT_INDEX.is_file():
        return FileResponse(str(ROOT_INDEX), media_type="text/html", headers=no_cache_headers)
    return {"detail": "index.html not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
