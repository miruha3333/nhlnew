import { API_BASE } from "../config.js";
import { state, goalieHeadshotCache } from "../state.js";
import { escapeHtml, nameStr, val, getPlayerId } from "../utils.js";
import { seasonIdFromEndDate } from "./standings.js";
import { openPlayerDetail } from "./player_detail.js";

export async function loadPlayers() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка лидеров...</div>';

  try {
    const seasonId = seasonIdFromEndDate(state.selectedSeasonEndDate);
    const params = new URLSearchParams({
      limit: String(state.currentLimit),
      category: state.currentCat
    });
    if (seasonId) params.set("season", seasonId);

    const response = await fetch(`${API_BASE}/api/leaders/${encodeURIComponent(state.currentCat)}?${params}`);
    const data = await response.json();
    const list = data[state.currentCat] || data.skaters || data.leaders || data.data || [];

    if (!Array.isArray(list) || !list.length) {
      if (body) body.innerHTML = '<div class="empty">Нет данных игроков</div>';
      return;
    }

    state.cachedSkatersList = list;

    if (body) {
      body.innerHTML = list.map((player, index) => {
        let displayValue = player.value;
        if (displayValue === undefined || displayValue === null) {
          displayValue = player[state.currentCat] ?? "—";
        }
        if (state.currentCat === "plusMinus" && typeof displayValue === "number" && displayValue > 0) {
          displayValue = `+${displayValue}`;
        }

        return `
          <div class="player-row" data-player-id="${escapeHtml(getPlayerId(player))}">
            <div class="rank">${index + 1}</div>
            <img class="headshot" src="${escapeHtml(player.headshot || `https://assets.nhle.com/mugs/nhl/latest/${getPlayerId(player)}.png`)}" alt="" onerror="this.style.visibility='hidden'">
            <div class="info">
              <div class="pname">
                ${escapeHtml(`${nameStr(player.firstName)} ${nameStr(player.lastName)}`.trim() || player.name || "Игрок")}
              </div>
              <div class="pteam">
                <img class="team-logo" src="${escapeHtml(player.teamLogo || "")}" alt="" onerror="this.style.display='none'">
                ${escapeHtml(player.teamAbbrev || "")}
              </div>
            </div>
            <div class="pvalue" style="color:#ffffff !important;">${escapeHtml(val(displayValue))}</div>
          </div>
        `;
      }).join("");

      if (list.length >= state.currentLimit && state.currentLimit < 50) {
        body.insertAdjacentHTML("beforeend", `<button class="show-more" id="show-more-players">Показать больше</button>`);
        document.getElementById("show-more-players")?.addEventListener("click", () => {
          state.currentLimit = 50;
          loadPlayers();
        });
      }

      body.querySelectorAll(".player-row").forEach(row => {
        row.addEventListener("click", () => openPlayerDetail(row.dataset.playerId));
      });
    }
  } catch (error) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить лидеров</div>';
  }
}

function goalieSortValue(player) {
  if (state.currentGoalieSortKey === "savePctg") return Number(player.savePctg ?? player.savePercentage ?? -Infinity);
  if (state.currentGoalieSortKey === "gaa") return Number(player.gaa ?? player.goalsAgainstAverage ?? Infinity);
  return Number(player[state.currentGoalieSortKey] ?? -Infinity);
}

export function renderGoaliesFromCache() {
  const body = document.getElementById("players-body");
  if (!body) return;
  if (!state.cachedGoaliesList.length) {
    body.innerHTML = '<div class="empty">Нет данных вратарей</div>';
    return;
  }

  const rows = [...state.cachedGoaliesList];
  rows.sort((a, b) => {
    const va = goalieSortValue(a);
    const vb = goalieSortValue(b);
    return state.currentGoalieSortAsc ? va - vb : vb - va;
  });

  body.innerHTML = rows.map((player, index) => {
    const savePct = player.savePctg ?? player.savePercentage;
    const gaa = player.gaa ?? player.goalsAgainstAverage;

    let mainValue = player[state.currentGoalieSortKey] ?? player.value ?? "—";
    if (state.currentGoalieSortKey === "savePctg") {
      mainValue = typeof savePct === "number" ? savePct.toFixed(3) : val(mainValue);
    } else if (state.currentGoalieSortKey === "gaa") {
      mainValue = typeof gaa === "number" ? gaa.toFixed(2) : val(mainValue);
    }

    return `
      <div class="player-row" data-player-id="${escapeHtml(getPlayerId(player))}">
        <div class="rank">${index + 1}</div>
        <img class="headshot" src="${escapeHtml(player.headshot || `https://assets.nhle.com/mugs/nhl/latest/${getPlayerId(player)}.png`)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="info">
          <div class="pname">${escapeHtml(`${nameStr(player.firstName)} ${nameStr(player.lastName)}`.trim() || "Вратарь")}</div>
          <div class="pteam">
            <img class="team-logo" src="${escapeHtml(player.teamLogo || "")}" alt="" onerror="this.style.display='none'">
            ${escapeHtml(player.teamAbbrev || "")}
          </div>
        </div>
        <div class="pvalue" style="color:#ffffff !important;">${escapeHtml(mainValue)}</div>
      </div>
    `;
  }).join("");

  body.querySelectorAll(".player-row").forEach(row => {
    row.addEventListener("click", () => openPlayerDetail(row.dataset.playerId));
  });
}

export async function loadGoalieCards() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка статистики вратарей...</div>';

  try {
    const seasonId = seasonIdFromEndDate(state.selectedSeasonEndDate);
    const params = new URLSearchParams({ limit: "100" });
    if (seasonId) params.set("season", seasonId);

    const response = await fetch(`${API_BASE}/api/goalie-leaders?${params}`);
    const data = await response.json();
    state.cachedGoaliesList = Array.isArray(data.goalies) ? [...data.goalies] : [];
    renderGoaliesFromCache();
  } catch (error) {
    if (body) body.innerHTML = `<div class="empty">Не удалось загрузить вратарей</div>`;
  }
}

export function initLeadersModule() {
  document.getElementById("leaders-skaters-btn")?.addEventListener("click", () => {
    state.leadersMode = "skaters";
    document.getElementById("leaders-skaters-btn")?.classList.add("active");
    document.getElementById("leaders-goalies-btn")?.classList.remove("active");
    document.getElementById("skater-categories").style.display = "grid";
    document.getElementById("goalie-categories").style.display = "none";
    loadPlayers();
  });

  document.getElementById("leaders-goalies-btn")?.addEventListener("click", () => {
    state.leadersMode = "goalies";
    document.getElementById("leaders-goalies-btn")?.classList.add("active");
    document.getElementById("leaders-skaters-btn")?.classList.remove("active");
    document.getElementById("skater-categories").style.display = "none";
    document.getElementById("goalie-categories").style.display = "grid";
    state.cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
  });

  document.querySelectorAll("#skater-categories button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#skater-categories button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      state.currentCat = button.dataset.cat;
      state.currentLimit = 25;
      loadPlayers();
    });
  });

  document.querySelectorAll("#goalie-categories button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#goalie-categories button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const key = button.dataset.goalieSort;
      if (state.currentGoalieSortKey === key) {
        state.currentGoalieSortAsc = !state.currentGoalieSortAsc;
      } else {
        state.currentGoalieSortKey = key;
        state.currentGoalieSortAsc = (key === "gaa" || key === "losses");
      }
      renderGoaliesFromCache();
    });
  });
}
