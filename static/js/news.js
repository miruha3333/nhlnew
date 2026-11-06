window.openPostInTelegram = function(url) {
  if (!url) return;
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
};

// Мгновенный поиск хоккеиста по фамилии в базе НХЛ и переход в его досье
async function searchAndOpenPlayer(name) {
  if (!name) return;
  openDetail();
  const body = document.getElementById("detail-body");
  if (body) body.innerHTML = `<div class="loading">Поиск досье игрока ${escapeHtml(name)}...</div>`;

  try {
    const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=3&q=${encodeURIComponent(name.trim())}`);
    const data = await res.json();
    const results = Array.isArray(data) ? data : (data?.data || []);
    if (results.length > 0 && results[0].playerId) {
      openPlayerDetail(results[0].playerId);
      return;
    }
  } catch (_) {}

  if (body) body.innerHTML = `<div class="empty">Игрок «${escapeHtml(name)}» не найден в базе НХЛ</div>`;
}

function formatTransactionDate(rawDate) {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      const parts = String(rawDate).split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
      return rawDate;
    }
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  } catch (_) {
    return String(rawDate).split("T")[0];
  }
}

const EXCLUDE_WORDS = [
  "New York", "San Diego", "San Jose", "Los Angeles", "Grand Rapids",
  "New Jersey", "Tampa Bay", "St Louis", "Las Vegas", "Colorado Eagles",
  "Wilkes Barre", "Lehigh Valley", "Toronto Marlies", "Springfield Thunderbirds",
  "Free Agent", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

async function loadTransactions() {
  const container = document.getElementById("transactions-list");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка трансферов...</div>';
  try {
    const data = await fetchAPI("/api/transactions");
    const list = data.transactions || [];
    if (!list.length) {
      container.innerHTML = '<div class="empty">Нет последних трансферов</div>';
      return;
    }

    container.innerHTML = list.map(t => {
      const cleanDate = formatTransactionDate(t.date);
      let desc = escapeHtml(t.description);

      let teamStr = "NHL";
      if (typeof t.team === "string") {
        teamStr = t.team;
      } else if (t.team && typeof t.team === "object") {
        teamStr = t.team.displayName || t.team.name || t.team.abbreviation || "NHL";
      }

      desc = desc.replace(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, (match) => {
        if (EXCLUDE_WORDS.includes(match)) return match;
        return `<span class="player-tx-link" onclick="searchAndOpenPlayer('${match}')">${match}</span>`;
      });

      return `
        <div class="tx-item">
          <div class="tx-date">${escapeHtml(cleanDate)} · <span class="tx-team">${escapeHtml(teamStr)}</span></div>
          <div class="tx-desc">${desc}</div>
        </div>
      `;
    }).join("");
  } catch (_) {
    container.innerHTML = '<div class="empty">Не удалось загрузить трансферы</div>';
  }
}

async function loadNews() {
  const container = document.getElementById("news-feed-container");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка новостей...</div>';
  try {
    const data = await fetchAPI("/api/news?channel=xokkey9");
    const list = data.news || [];
    if (!list.length) {
      container.innerHTML = '<div class="empty">Новостей пока нет</div>';
      return;
    }
    container.innerHTML = list.map(item => {
      let imgSrc = item.image || "";
      return `
        <div class="news-card">
          ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" loading="lazy" onerror="this.style.display='none'">` : ""}
          <div class="news-meta"><span>📅 ${escapeHtml(item.date)}</span><span>✈ Telegram</span></div>
          <a class="news-title-link" href="${escapeHtml(item.link)}" onclick="event.preventDefault(); openPostInTelegram('${escapeHtml(item.link)}');">${escapeHtml(item.title)}</a>
          <button class="news-read-btn" type="button" onclick="openPostInTelegram('${escapeHtml(item.link)}')">Читать в канале ↗</button>
        </div>
      `;
    }).join("");
  } catch (_) {
    container.innerHTML = '<div class="empty">Не удалось загрузить новости</div>';
  }
}
