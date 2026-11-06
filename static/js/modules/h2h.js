import { API_BASE, TEAM_COLORS } from "../config.js";
import { h2hTeamCache } from "../state.js";
import { escapeHtml, nameStr, getPlayerId } from "../utils.js";

export async function loadH2HRoster(side) {
  const team = document.getElementById(`h2h-team-${side}`)?.value;
  const pSelect = document.getElementById(`h2h-player-${side}`);
  if (!pSelect || !team) return;
  pSelect.innerHTML = "<option>Загрузка...</option>";

  let skaters = h2hTeamCache.get(team);
  if (!skaters) {
    try {
      const res = await fetch(`${API_BASE}/api/roster-stats/${team}`);
      const data = await res.json();
      skaters = data?.regular?.skaters || data?.skaters || [];
      h2hTeamCache.set(team, skaters);
    } catch (_) {
      skaters = [];
    }
  }

  if (!skaters.length) {
    pSelect.innerHTML = "<option>Нет игроков</option>";
    return;
  }

  pSelect.innerHTML = skaters.map(p => `
    <option value="${escapeHtml(getPlayerId(p))}">${escapeHtml(`${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim() || "Игрок")}</option>
  `).join("");

  renderH2HComparison();
}

export function renderH2HComparison() {
  const t1 = document.getElementById("h2h-team-1")?.value;
  const t2 = document.getElementById("h2h-team-2")?.value;
  const p1Id = document.getElementById("h2h-player-1")?.value;
  const p2Id = document.getElementById("h2h-player-2")?.value;
  const container = document.getElementById("h2h-comparison-content");
  if (!container) return;

  const s1 = h2hTeamCache.get(t1) || [];
  const s2 = h2hTeamCache.get(t2) || [];

  const p1 = s1.find(p => String(getPlayerId(p)) === String(p1Id)) || s1[0];
  const p2 = s2.find(p => String(getPlayerId(p)) === String(p2Id)) || s2[0];

  if (!p1 || !p2) {
    container.innerHTML = '<div class="empty">Выберите хоккеистов</div>';
    return;
  }

  function makeBar(label, v1, v2) {
    const n1 = Number(v1) || 0;
    const n2 = Number(v2) || 0;
    const total = Math.max(1, Math.abs(n1) + Math.abs(n2));
    const pct1 = Math.round((Math.max(0, n1) / total) * 100);
    const pct2 = 100 - pct1;

    return `
      <div class="h2h-bar-row">
        <div class="h2h-bar-labels">
          <span style="font-weight:700;color:#ffffff;font-size:13px;">${escapeHtml(v1)}</span>
          <span style="color:var(--silver-dim);text-transform:uppercase;font-family:'Oswald',sans-serif;">${escapeHtml(label)}</span>
          <span style="font-weight:700;color:#ffffff;font-size:13px;">${escapeHtml(v2)}</span>
        </div>
        <div class="h2h-bar-track">
          <div class="h2h-bar-left" style="width:${pct1}%;background:#3a86ff;"></div>
          <div class="h2h-bar-right" style="width:${pct2}%;background:#2ecc71;"></div>
        </div>
      </div>
    `;
  }

  const p1Name = `${nameStr(p1.firstName)} ${nameStr(p1.lastName)}`.trim();
  const p2Name = `${nameStr(p2.firstName)} ${nameStr(p2.lastName)}`.trim();
  const p1Img = `https://assets.nhle.com/mugs/nhl/latest/${getPlayerId(p1)}.png`;
  const p2Img = `https://assets.nhle.com/mugs/nhl/latest/${getPlayerId(p2)}.png`;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="text-align:center;width:45%;">
        <img src="${escapeHtml(p1Img)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #3a86ff;background:var(--surface-2);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:13px;margin-top:4px;color:#fff;">${escapeHtml(p1Name)}</div>
        <div style="font-size:11px;color:var(--silver-dim);">${escapeHtml(t1)}</div>
      </div>
      <div style="font-family:'Oswald',sans-serif;font-weight:700;color:var(--silver-dim);">VS</div>
      <div style="text-align:center;width:45%;">
        <img src="${escapeHtml(p2Img)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #2ecc71;background:var(--surface-2);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:13px;margin-top:4px;color:#fff;">${escapeHtml(p2Name)}</div>
        <div style="font-size:11px;color:var(--silver-dim);">${escapeHtml(t2)}</div>
      </div>
    </div>
    ${makeBar("Очки (PTS)", p1.points ?? 0, p2.points ?? 0)}
    ${makeBar("Голы (G)", p1.goals ?? 0, p2.goals ?? 0)}
    ${makeBar("Передачи (A)", p1.assists ?? 0, p2.assists ?? 0)}
    ${makeBar("+ / -", p1.plusMinus ?? 0, p2.plusMinus ?? 0)}
    ${makeBar("Броски (SOG)", p1.shots ?? p1.sog ?? 0, p2.shots ?? p2.sog ?? 0)}
    ${makeBar("Штраф (PIM)", p1.penaltyMinutes ?? p1.pim ?? 0, p2.penaltyMinutes ?? p2.pim ?? 0)}
  `;
}

export async function openH2HModal() {
  const modal = document.getElementById("h2h-modal");
  const t1 = document.getElementById("h2h-team-1");
  const t2 = document.getElementById("h2h-team-2");
  if (!modal || !t1 || !t2) return;

  modal.style.display = "flex";
  const teams = Object.keys(TEAM_COLORS).sort();
  const options = teams.map(t => `<option value="${t}">${t}</option>`).join("");
  t1.innerHTML = options;
  t2.innerHTML = options;
  t1.value = "EDM";
  t2.value = "COL";

  t1.onchange = () => loadH2HRoster(1);
  t2.onchange = () => loadH2HRoster(2);

  document.getElementById("h2h-player-1").onchange = renderH2HComparison;
  document.getElementById("h2h-player-2").onchange = renderH2HComparison;

  await Promise.all([loadH2HRoster(1), loadH2HRoster(2)]);
}

export function initH2HModule() {
  document.getElementById("open-h2h-btn")?.addEventListener("click", openH2HModal);
  document.getElementById("close-h2h-modal-btn")?.addEventListener("click", () => {
    document.getElementById("h2h-modal").style.display = "none";
  });
}
