import { API_BASE } from "../config.js";
import { escapeHtml } from "../utils.js";

export function openPostInTelegram(url) {
  if (!url) return;
  try {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
      return;
    }
  } catch (e) {
    console.error("Telegram link error:", e);
  }
  window.open(url, "_blank");
}

export async function loadNews() {
  const container = document.getElementById("news-feed-container");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка свежих новостей...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/news`);
    const data = await res.json();
    const list = data.news || [];

    if (!list.length) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:28px 14px;">
          <div style="font-size:30px;margin-bottom:10px;">📢</div>
          <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;margin-bottom:6px;text-transform:uppercase;">
            В канале пока нет новостей
          </div>
          <div style="font-size:12px;color:var(--silver-dim);line-height:1.4;">
            Опубликуйте пост в Telegram-канале — он мгновенно появится в этом разделе.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => {
      const imgSrc = item.image || (item.photo_id ? `${API_BASE}/api/news/photo/${escapeHtml(item.photo_id)}` : "");
      const imgHtml = imgSrc 
        ? `<img src="${escapeHtml(imgSrc)}" alt="" loading="lazy" data-link="${escapeHtml(item.link)}">` 
        : "";

      return `
        <div class="news-card">
          ${imgHtml}
          <div class="news-meta">
            <span>📅 ${escapeHtml(item.date)}</span>
            <span class="news-tg-tag">✈ Telegram</span>
          </div>
          <a class="news-title-link" href="${escapeHtml(item.link)}" data-link="${escapeHtml(item.link)}">
            ${escapeHtml(item.title)}
          </a>
          <button class="news-read-btn" type="button" data-link="${escapeHtml(item.link)}">
            Читать полностью ↗
          </button>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-link]").forEach(el => {
      el.addEventListener("click", e => {
        e.preventDefault();
        openPostInTelegram(el.dataset.link);
      });
    });
  } catch (err) {
    container.innerHTML = '<div class="empty">Не удалось загрузить ленту новостей</div>';
  }
}
