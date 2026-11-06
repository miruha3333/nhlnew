import { API_BASE } from "../config.js";
import { escapeHtml } from "../utils.js";

export async function loadTransactions() {
  const container = document.getElementById("transactions-list");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка свежих трансферов...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/transactions`);
    const data = await res.json();
    const list = data.transactions || [];

    if (!list.length) {
      container.innerHTML = '<div class="empty">Нет последних трансферов</div>';
      return;
    }

    container.innerHTML = list.map(t => {
      const d = t.date ? new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "";
      return `
        <div class="tx-item">
          <div class="tx-date">${escapeHtml(d)} · <span class="tx-team">${escapeHtml(t.team)}</span></div>
          <div class="tx-desc">${escapeHtml(t.description)}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty">Не удалось загрузить трансферы</div>`;
  }
}
