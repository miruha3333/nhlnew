import time
import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from backend.config import BOT_TOKEN, TELEGRAM_API, WEBAPP_URL, DONATE_URL
from backend.services.news_store import get_all_news, insert_news_item

router = APIRouter(tags=["News & Telegram"])


@router.get("/api/news")
async def get_news():
    return {"news": get_all_news()}


@router.get("/api/news/photo/{file_id}")
async def get_news_photo(file_id: str):
    if not BOT_TOKEN or not file_id:
        return JSONResponse({"error": "No token or file_id"}, status_code=404)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            file_info_resp = await client.get(f"{TELEGRAM_API}/getFile?file_id={file_id}")
            if file_info_resp.status_code != 200:
                return JSONResponse({"error": "Failed to get file info"}, status_code=404)

            file_path = file_info_resp.json().get("result", {}).get("file_path")
            if not file_path:
                return JSONResponse({"error": "File path not found"}, status_code=404)

            img_resp = await client.get(f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}")
            return Response(
                content=img_resp.content,
                media_type=img_resp.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.api_route("/webhook", methods=["GET", "POST"])
async def telegram_webhook(request: Request):
    if request.method == "GET":
        return {"status": "ok", "message": "Webhook is active and listening!"}

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    channel_post = update.get("channel_post")
    if channel_post:
        chat = channel_post.get("chat", {})
        channel_username = chat.get("username", "")
        message_id = channel_post.get("message_id")

        raw_text = channel_post.get("text") or channel_post.get("caption") or ""
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

        if lines:
            title = lines[0]
            if len(title) > 120 and "." in title[:120]:
                title = title[:title[:120].rfind(".") + 1]
            elif len(title) > 120:
                title = title[:117] + "..."
        else:
            title = "⚡ Читайте новую публикацию в Telegram-канале"

        if channel_username:
            post_link = f"https://t.me/{channel_username}/{message_id}"
        else:
            clean_id = str(chat.get("id", "")).replace("-100", "")
            post_link = f"https://t.me/c/{clean_id}/{message_id}"

        photo_id = ""
        photos = channel_post.get("photo", [])
        if isinstance(photos, list) and photos:
            photo_id = photos[-1].get("file_id", "")

        post_ts = channel_post.get("date", time.time())
        date_str = time.strftime("%d.%m в %H:%M", time.localtime(post_ts + 3 * 3600))

        news_item = {
            "id": message_id,
            "title": title,
            "link": post_link,
            "photo_id": photo_id,
            "date": date_str,
            "timestamp": post_ts,
        }

        insert_news_item(news_item)
        return {"ok": True}

    message = update.get("message")
    if not message:
        return {"ok": True}

    chat_id = message["chat"]["id"]
    text = message.get("text", "")

    if text.startswith("/start") or text in ("/matches", "/standings", "/leaders", "/news", "/donate", "/help"):
        keyboard = {
            "inline_keyboard": [
                [{"text": "🏒 ОТКРЫТЬ NHL LIVE", "web_app": {"url": WEBAPP_URL}}],
                [
                    {"text": "📅 Матчи", "web_app": {"url": f"{WEBAPP_URL}?section=matches"}},
                    {"text": "📊 Таблица", "web_app": {"url": f"{WEBAPP_URL}?section=standings"}},
                ],
                [
                    {"text": "🏆 Лидеры", "web_app": {"url": f"{WEBAPP_URL}?section=leaders"}},
                    {"text": "🔄 Трансферы", "web_app": {"url": f"{WEBAPP_URL}?section=transactions"}},
                ],
                [
                    {"text": "📢 Новости", "web_app": {"url": f"{WEBAPP_URL}?section=news"}},
                    {"text": "☕ Поддержать проект", "url": DONATE_URL},
                ],
            ],
        }

        async with httpx.AsyncClient(timeout=12) as client:
            await client.post(
                f"{TELEGRAM_API}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": (
                        "🏒 <b>NHL LIVE</b>\n\n"
                        "Всё главное об NHL — в одном приложении прямо в Telegram:\n\n"
                        "📅 <b>Матчи</b> — счёт live, голы, звёзды и видеообзоры\n"
                        "📊 <b>Таблица</b> — общая, по дивизионам и продвинутая статистика\n"
                        "🏆 <b>Лидеры</b> — гонка бомбардиров и вратарей\n"
                        "🔄 <b>Трансферы</b> — переходы и травмы лиги\n"
                        "📢 <b>Новости</b> — свежие инсайды нашего канала\n\n"
                        "Выбери нужный раздел кнопками ниже:"
                    ),
                    "parse_mode": "HTML",
                    "reply_markup": keyboard,
                },
            )

    return {"ok": True}
