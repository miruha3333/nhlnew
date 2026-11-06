import { API_BASE } from "../config.js";
import { state } from "../state.js";
import { escapeHtml, nameStr, val, getPlayerId } from "../utils.js";
import { openDetail } from "./game_detail.js";
import { openPlayerDetail } from "./player_detail.js";

export async function openTeamDetail(teamAbbrev, teamName) {
  openDetail();
  const body = document.getElementById("detail-body");

  try {
    const res = await fetch(`${API_BASE}/api/roster-stats/${encodeURIComponent(teamAbbrev)}`);
    const data = await res.json();
    state.currentTeamFullData = data;

    body.innerHTML = `
      <div class="detail-head">
        <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(teamAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(teamAbbrev)}_dark.svg';">
        <div>
          <div class="title">${escapeHtml(teamName || teamAbbrev)}</div>
          <div class="subtitle">${escapeHtml(teamAbbrev)}</div>
        </div>
      </div>

      <div class="cat-row" style="margin-top:14px;">
        <button id="btn-team-reg" class="active">Регулярный сезон</button>
        <button id="btn-team-po">Плей-офф</button>
        <button id="btn-team-schedule">Расписание</button>
      </div>
      <div id="team-tables-container"></div>
    `;

    buildTeamTablesBlock();

    document.getElementById("btn-team-reg")?.addEventListener("click", () => {
      document.getElementById("btn-team-reg")?.classList.add("active");
      document.getElementById("btn-team-po")?.classList.remove("active");
      document.getElementById("btn-team-schedule")?.classList.remove("active");
      buildTeamTablesBlock();
    });

    document.getElementById("btn-team-po")?.addEventListener("click", async () => {
      document.getElementById("btn-team-po")?.classList.add("active");
      document.getElementById("btn-team-reg")?.classList.remove("active");
      document.getElementById("btn-team-schedule")?.classList.remove("active");
      const container = document.getElementById("team-tables-container");
      if (container) container.innerHTML = '<div class="loading">Загрузка плей-офф...</div>';

      try {
        const poRes = await fetch(`${API_BASE}/api/roster-stats/${encodeURIComponent(teamAbbrev)}?gameType=3`);
        const poData = await poRes.json();
        buildTeamPlayoffTablesBlock(poData);
      } catch (_) {
        if (container) container.innerHTML = '<div class="empty">Клуб не участвовал в плей-офф</div>';
      }
    });

    document.getElementById("btn-team-schedule")?.addEventListener("click", () => {
      document.getElementById("btn-team-schedule")?.classList.add("active");
      document.getElementById("btn-team-reg")?.classList.remove("active");
      document.getElementById("btn-team-po")?.classList.remove("active");
      openTeamScheduleTab(teamAbbrev);
    });
  } catch (err) {
    body.innerHTML = `<div class="empty">Не удалось загрузить состав команды</div>`;
  }
}

function buildTeamTablesBlock() {
  const container = document.getElementById("team-tables-container");
  if (!container) return;
  const skaters = state.currentTeamFullData?.skaters || [];
  const goalies = state.currentTeamFullData?.goalies || [];

  let html = '<div class="section-title">Полевые игроки</div>';
  if (!skaters.length) {
    html += '<div class="empty">Нет данных игроков</div>';
  } else {
    html += `
      <div class="table-scroll">
        <table class="stat-table">
          <thead>
            <tr><th>Игрок</th><th>И</th><th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th></tr>
          </thead>
          <tbody>
            ${skaters.map(p => `
              <tr class="clickable-row" data-player-id="${escapeHtml(getPlayerId(p))}">
                <td>${escapeHtml(`${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim() || "Игрок")}</td>
                <td class="num">${val(p.gamesPlayed, 0)}</td>
                <td class="num">${val(p.goals, 0)}</td>
                <td class="num">${val(p.assists, 0)}</td>
                <td class="num" style="color:#ffffff !important;font-weight:700;">${val(p.points, 0)}</td>
                <td class="num">${val(p.plusMinus, 0)}</td>
                <td class="num">${val(p.penaltyMinutes ?? p.pim, 0)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (goalies.length) {
    html += '<div class="section-title">Вратари</div>';
    html += `
      <div class="table-scroll">
        <table class="stat-table">
          <thead>
            <tr><th>Игрок</th><th>И</th><th>В</th><th>П</th><th>%ОБ</th><th>ГКИ</th></tr>
          </thead>
          <tbody>
            ${goalies.map(p => {
              const sv = p.savePercentage ?? p.savePctg;
              return `
                <tr class="clickable-row" data-player-id="${escapeHtml(getPlayerId(p))}">
                  <td>${escapeHtml(`${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim() || "Вратарь")}</td>
                  <td class="num">${val(p.gamesPlayed, 0)}</td>
                  <td class="num">${val(p.wins, 0)}</td>
                  <td class="num">${val(p.losses, 0)}</td>
                  <td class="num" style="color:#ffffff !important;font-weight:700;">${typeof sv === "number" ? sv.toFixed(3) : val(sv)}</td>
                  <td class="num">${typeof p.goalsAgainstAverage === "number" ? p.goalsAgainstAverage.toFixed(2) : val(p.gaa)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
  container.querySelectorAll(".clickable-row").forEach(r => {
    r.addEventListener("click", () => {
      if (r.dataset.playerId) openPlayerDetail(r.dataset.playerId);
    });
  });
}

function buildTeamPlayoffTablesBlock(data) {
  const container = document.getElementById("team-tables-container");
  if (!container) return;
  const skaters = data?.skaters || [];

  if (!skaters.length) {
    container.innerHTML = '<div class="empty">Клуб не участвовал в плей-офф в этом сезоне</div>';
    return;
  }

  container.innerHTML = `
    <div class="section-title">Полевые игроки (Плей-офф)</div>
    <div class="table-scroll">
      <table class="stat-table">
        <thead>
          <tr><th>Игрок</th><th>И</th><th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th></tr>
        </thead>
        <tbody>
          ${skaters.map(p => `
            <tr class="clickable-row" data-player-id="${escapeHtml(getPlayerId(p))}">
              <td>${escapeHtml(`${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim() || "Игрок")}</td>
              <td class="num">${val(p.gamesPlayed, 0)}</td>
              <td class="num">${val(p.goals, 0)}</td>
              <td class="num">${val(p.assists, 0)}</td>
              <td class="num" style="color:#ffffff !important;font-weight:700;">${val(p.points, 0)}</td>
              <td class="num">${val(p.plusMinus, 0)}</td>
              <td class="num">${val(p.penaltyMinutes ?? p.pim, 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll(".clickable-row").forEach(r => {
    r.addEventListener("click", () => {
      if (r.dataset.playerId) openPlayerDetail(r.dataset.playerId);
    });
  });
}

async function openTeamScheduleTab(teamAbbrev) {
  const container = document.getElementById("team-tables-container");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка расписания матчей команды...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/team-schedule/${encodeURIComponent(teamAbbrev)}`);
    const data = await res.json();
    const games = data?.games || [];

    if (!games.length) {
      container.innerHTML = '<div class="empty">Матчи не найдены</div>';
      return;
    }

    let html = '<div class="section-title">Календарь матчей команды</div><div class="card" style="padding:0;">';
    games.forEach(g => {
      const away = g.awayTeam?.abbrev || "";
      const home = g.homeTeam?.abbrev || "";
      const aScore = g.awayTeam?.score;
      const hScore = g.homeTeam?.score;
      const isFin = aScore !== undefined && hScore !== undefined;
      const d = g.gameDate ? new Date(g.gameDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";

      html += `
        <div class="h2h-game-row">
          <div style="font-family:'Roboto Mono',monospace;font-size:11px;color:var(--silver-dim);width:45px;">${escapeHtml(d)}</div>
          <div class="h2h-team-cell left">${escapeHtml(away)}</div>
          <div class="h2h-center-cell">
            <span class="h2h-score-val">${isFin ? `${aScore} : ${hScore}` : 'vs'}</span>
          </div>
          <div class="h2h-team-cell right">${escapeHtml(home)}</div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div class="empty">Не удалось загрузить календарь матчей команды</div>';
  }
}
