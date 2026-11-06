window.openPostInTelegram = function(url) {
  if (!url) return;
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
};

function formatTransactionDate(rawDate) {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      const parts = String(rawDate).split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
      return rawDate;
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (_) {
    return String(rawDate).split("T")[0];
  }
}

async function loadTransactions() {
  const container = document.getElementById("transactions-list");
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
      // Извлекаем название клуба из объекта, чтобы не было [object Object]
      const teamName = typeof t.team === "object" 
        ? (t.team.displayName || t.team.name || t.team.abbreviation || "") 
        : (t.team || "");

      return `
        <div class="tx-item">
          <div class="tx-date">${escapeHtml(cleanDate)} · <span class="tx-team">${escapeHtml(teamName)}</span></div>
          <div class="tx-desc">${escapeHtml(t.description || "")}</div>
        </div>
      `;
    }).join("");
  } catch (_) {
    container.innerHTML = '<div class="empty">Не удалось загрузить трансферы</div>';
  }
}

async function loadNews() {
  const container = document.getElementById("news-feed-container");
  container.innerHTML = '<div class="loading">Загрузка новостей...</div>';
  try {
    const data = await fetchAPI("/api/news");
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
          <div class="news-meta"><span>📅 ${escapeHtml(item.date)}</span><span>🏒 NHL News</span></div>
          <a class="news-title-link" href="${escapeHtml(item.link)}" onclick="event.preventDefault(); openPostInTelegram('${escapeHtml(item.link)}');">${escapeHtml(item.title)}</a>
          <button class="news-read-btn" type="button" onclick="openPostInTelegram('${escapeHtml(item.link)}')">Читать подробнее ↗</button>
        </div>
      `;
    }).join("");
  } catch (_) {
    container.innerHTML = '<div class="empty">Не удалось загрузить новости</div>';
  }
}
