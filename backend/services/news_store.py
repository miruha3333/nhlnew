import json
from backend.config import NEWS_FILE


def load_saved_news() -> list[dict]:
    if NEWS_FILE.is_file():
        try:
            with open(NEWS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_news_to_disk(news_list: list[dict]):
    try:
        with open(NEWS_FILE, "w", encoding="utf-8") as f:
            json.dump(news_list[:30], f, ensure_ascii=False, indent=2)
    except Exception:
        pass


_news_store: list[dict] = load_saved_news()


def get_all_news() -> list[dict]:
    return _news_store


def insert_news_item(item: dict):
    global _news_store
    msg_id = item.get("id")
    _news_store = [n for n in _news_store if n.get("id") != msg_id]
    _news_store.insert(0, item)
    _news_store = _news_store[:30]
    save_news_to_disk(_news_store)
