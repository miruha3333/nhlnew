import { API_BASE } from "../config.js";
import { state } from "../state.js";
import { fmtDate, escapeHtml, getTeamAbbrev } from "../utils.js";
import { openGameDetail, openFutureGamePreview } from "./game_detail.js";
import { openTeamDetail } from "./team_detail.js";

export function isFutureGame(game) {
  return game.gameState === "FUT" || game.gameState === "PRE";
}

function renderTeamRecord(team) {
  const record = team?.currentRecord;
  if (!record) return "";
  return `
    <div class="team-record">
      <strong>${record.wins ?? 0}-${record.losses ?? 0}-${record.otLosses ?? 0}-${record.points ?? 0}</strong>
    </div>
  `;
}

export function renderGame(game) {
  const away = game.awayTeam || {};
  const home = game.homeTeam || {};
  const awayAbbrev = getTeamAbbrev(away);
  const homeAbbrev = getTeamAbbrev(home);

  const isPinned = state.myFavoriteTeam && (awayAbbrev === state.myFavoriteTeam || homeAbbrev === state.myFavoriteTeam);
  const started = game.gameState !== "FUT" && game.gameState !== "PRE";
  const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
  const status = started
    ? (isLive ? "● LIVE" : "Финал")
    : new Date(game.startTimeUTC).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return `
    <div class="card ${isPinned ? 'pinned' : ''}">
      <div class="game-row">
        <div class="team" data-team="${escapeHtml(awayAbbrev)}" data-name="${escapeHtml(away.name || awayAbbrev)}" data-logo="${escapeHtml(away.logo || "")}">
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_dark.svg';">
          <div>
            <div class="abbr">${escapeHtml(awayAbbrev)}</div>
            ${renderTeamRecord(away)}
          </div>
        </div>

        <div class="score-box game-center${started ? " clickable" : ""}" data-game-id="${escapeHtml(game.id)}" data-away="${escapeHtml(awayAbbrev)}" data-home="${escapeHtml(homeAbbrev)}" data-away-logo="${escapeHtml(away.logo || "")}" data-home-logo="${escapeHtml(home.logo || "")}">
          <div class="score" style="color:#ffffff;">${started ? `${away.score ?? 0} : ${home.score ?? 0}` : "vs"}</div>
          <div class="status ${isLive ? 'live-pulse' : ''}">${escapeHtml(status)}</div>
        </div>

        <div class="team right" data-team="${escapeHtml(homeAbbrev)}" data-name="${escapeHtml(home.name || homeAbbrev)}" data-logo="${escapeHtml(home.logo || "")}">
          <div>
            <div class="abbr">${escapeHtml(homeAbbrev)}</div>
            ${renderTeamRecord(home)}
          </div>
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_dark.svg';">
        </div>
      </div>
    </div>
  `;
}

export async function loadSchedule() {
  const games = document.getElementById("games");
  const datePicker = document.getElementById("date-picker");
  const date = fmtDate(state.currentDate);

  if (games) games.innerHTML = '<div class="loading">Загрузка матчей...</div>';
  if (datePicker) datePicker.value = date;

  try {
    const response = await fetch(`${API_BASE}/api/schedule?date=${encodeURIComponent(date)}`);
    const data = await response.json();
    const day = (data.gameWeek || []).find(item => item.date === date);
    let list = day?.games || [];

    if (!list.length) {
      if (games) games.innerHTML = '<div class="empty">В этот день матчей нет</div>';
      return;
    }

    if (state.myFavoriteTeam) {
      list = [...list].sort((a, b) => {
        const aFav = (getTeamAbbrev(a.awayTeam) === state.myFavoriteTeam || getTeamAbbrev(a.homeTeam) === state.myFavoriteTeam);
        const bFav = (getTeamAbbrev(b.awayTeam) === state.myFavoriteTeam || getTeamAbbrev(b.homeTeam) === state.myFavoriteTeam);
        return (bFav ? 1 : 0) - (aFav ? 1 : 0);
      });
    }

    if (games) {
      games.innerHTML = list.map(renderGame).join("");

      games.querySelectorAll(".score-box.game-center").forEach(element => {
        element.addEventListener("click", () => {
          const gameId = element.dataset.gameId;
          const awayAbbrev = element.dataset.away;
          const homeAbbrev = element.dataset.home;
          const awayLogo = element.dataset.awayLogo;
          const homeLogo = element.dataset.homeLogo;

          const game = list.find(item => String(item.id) === String(gameId));
          if (game && isFutureGame(game)) {
            openFutureGamePreview(gameId, awayAbbrev, homeAbbrev, awayLogo, homeLogo, date);
            return;
          }
          openGameDetail(gameId, awayAbbrev, homeAbbrev, awayLogo, homeLogo);
        });
      });

      games.querySelectorAll(".team[data-team]").forEach(team => {
        team.addEventListener("click", event => {
          event.stopPropagation();
          openTeamDetail(team.dataset.team, team.dataset.name, team.dataset.logo);
        });
      });
    }
  } catch (error) {
    if (games) games.innerHTML = '<div class="empty">Не удалось загрузить матчи</div>';
  }
}

export function initScheduleModule() {
  document.getElementById("prev-day")?.addEventListener("click", () => {
    state.currentDate.setDate(state.currentDate.getDate() - 1);
    loadSchedule();
  });

  document.getElementById("next-day")?.addEventListener("click", () => {
    state.currentDate.setDate(state.currentDate.getDate() + 1);
    loadSchedule();
  });

  document.getElementById("date-picker")?.addEventListener("change", event => {
    if (event.target.value) {
      state.currentDate = new Date(`${event.target.value}T12:00:00`);
      loadSchedule();
    }
  });
}
