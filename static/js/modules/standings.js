import { API_BASE } from "../config.js";
import { state } from "../state.js";
import { escapeHtml, nameStr, formatPctCell, getTeamAbbrev, getSafeTeamLogoUrl } from "../utils.js";
import { openTeamDetail } from "./team_detail.js";

export function seasonIdFromEndDate(endDate) {
  if (!endDate || typeof endDate !== "string") return null;
  const match = endDate.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return null;
  const endYear = Number(match[1]);
  return `${endYear - 1}${endYear}`;
}

export async function buildSeasonOptions() {
  const select = document.getElementById("season-select");
  if (!select) return;
  select.innerHTML = "<option value=''>Загрузка сезонов...</option>";

  try {
    const response = await fetch(`${API_BASE}/api/seasons-list`);
    const data = await response.json();
    const seasons = data?.seasons || [];

    if (!seasons.length) {
      select.innerHTML = "<option value=''>Текущий сезон</option>";
      return;
    }

    let html = "<option value=''>Текущий сезон</option>";
    [...seasons].sort((a, b) => b.id - a.id).forEach(season => {
      const id = String(season.id);
      const startYear = id.slice(0, 4);
      const endYear = id.slice(6, 8);
      html += `
        <option value="${escapeHtml(season.standingsEnd || "")}" data-start-year="${escapeHtml(startYear)}">
          ${escapeHtml(`${startYear}-${endYear}`)}
        </option>
      `;
    });
    select.innerHTML = html;
  } catch (error) {
    select.innerHTML = "<option value=''>Текущий сезон</option>";
  }
}

function renderTeamRow(team, rank) {
  const abbreviation = getTeamAbbrev(team.teamAbbrev || team.abbrev || team.team);
  const teamName = nameStr(team.teamName || team.name) || abbreviation;
  const logo = team.teamLogo || team.logo;

  const goalFor = Number(team.goalFor ?? 0);
  const goalAgainst = Number(team.goalAgainst ?? 0);
  const difference = Number(team.goalDifferential ?? (goalFor - goalAgainst));

  const pp = formatPctCell(team.powerPlayPctg);
  const pk = formatPctCell(team.penaltyKillPctg);
  const fo = formatPctCell(team.faceoffWinPct);
  const sf = (team.shotsForPerGame !== undefined && team.shotsForPerGame !== null) ? Number(team.shotsForPerGame).toFixed(1) : "—";
  const sa = (team.shotsAgainstPerGame !== undefined && team.shotsAgainstPerGame !== null) ? Number(team.shotsAgainstPerGame).toFixed(1) : "—";

  let clinchHtml = "";
  if (team.clinchIndicator) {
    const ci = String(team.clinchIndicator).toLowerCase();
    if (ci === "x" || ci === "y" || ci === "p") {
      clinchHtml = `<span class="clinch-badge clinch-x">${ci.toUpperCase()}</span>`;
    } else if (ci === "e") {
      clinchHtml = `<span class="clinch-badge clinch-e">E</span>`;
    }
  }

  const logoSrc = getSafeTeamLogoUrl(abbreviation, logo);

  return `
    <div class="standings-row" data-team="${escapeHtml(abbreviation)}" data-name="${escapeHtml(teamName)}" data-logo="${escapeHtml(logoSrc)}">
      <div class="num sticky-col sticky-col-1">${rank}</div>
      <div class="sticky-col sticky-col-2">
        <img class="team-logo" src="${escapeHtml(logoSrc)}" alt="" onerror="this.onerror=null; this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(abbreviation)}_dark.svg';">
      </div>
      <div class="name sticky-col sticky-col-3">
        ${escapeHtml(abbreviation)} ${clinchHtml}
      </div>
      <div class="num" style="color:#ffffff;">${team.gamesPlayed ?? 0}</div>
      <div class="num" style="color:#ffffff;">${team.wins ?? 0}</div>
      <div class="num" style="color:#ffffff;">${team.otLosses ?? 0}</div>
      <div class="num" style="color:#ffffff;">${team.losses ?? 0}</div>
      <div class="num" style="color:#ffffff;">${goalFor}</div>
      <div class="num" style="color:#ffffff;">${goalAgainst}</div>
      <div class="diff" style="color:${difference >= 0 ? "#2ecc71" : "#e74c3c"}">
        ${difference > 0 ? "+" : ""}${difference}
      </div>
      <div class="pts" style="color:#ffffff !important;font-weight:700;">${team.points ?? 0}</div>
      <div class="num special-team-pct" style="color:#ffffff !important;">${pp}</div>
      <div class="num special-team-pct" style="color:#ffffff !important;">${pk}</div>
      <div class="num" style="color:#ffffff;">${fo}</div>
      <div class="num" style="color:#ffffff;">${sf}</div>
      <div class="num" style="color:#ffffff;">${sa}</div>
    </div>
  `;
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    let valueA = a[state.standingsSortKey] ?? 0;
    let valueB = b[state.standingsSortKey] ?? 0;
    if (state.standingsSortKey === "goalDifferential") {
      valueA = a.goalDifferential ?? ((a.goalFor ?? 0) - (a.goalAgainst ?? 0));
      valueB = b.goalDifferential ?? ((b.goalFor ?? 0) - (b.goalAgainst ?? 0));
    }
    return state.standingsSortAsc ? Number(valueA) - Number(valueB) : Number(valueB) - Number(valueA);
  });
}

export function renderStandings() {
  const body = document.getElementById("standings-body");
  if (!body) return;
  if (!state.currentStandingsData.length) {
    body.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = "";
  if (state.standingsViewMode === "all") {
    html = sortTeams(state.currentStandingsData).map((team, index) => renderTeamRow(team, index + 1)).join("");
  } else {
    const field = state.standingsViewMode === "conf" ? "conferenceName" : "divisionName";
    const groups = {};
    state.currentStandingsData.forEach(team => {
      const group = nameStr(team[field]) || "Без группы";
      if (!groups[group]) groups[group] = [];
      groups[group].push(team);
    });

    Object.keys(groups).sort().forEach(group => {
      html += `<div class="group-header-row"><div>${escapeHtml(group)}</div></div>`;
      html += sortTeams(groups[group]).map((team, index) => renderTeamRow(team, index + 1)).join("");
    });
  }

  body.innerHTML = html;
  body.querySelectorAll(".standings-row").forEach(row => {
    row.addEventListener("click", () => {
      openTeamDetail(row.dataset.team, row.dataset.name, row.dataset.logo);
    });
  });
}

export async function loadStandings() {
  const body = document.getElementById("standings-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка таблицы...</div>';

  try {
    let standingsUrl = `${API_BASE}/api/standings`;
    if (state.selectedSeasonEndDate && state.selectedSeasonEndDate.trim() !== "") {
      standingsUrl = `${API_BASE}/api/standings-by-date/${encodeURIComponent(state.selectedSeasonEndDate)}`;
    }

    const specialTeamsSeason = seasonIdFromEndDate(state.selectedSeasonEndDate);
    const specialTeamsUrl = specialTeamsSeason
      ? `${API_BASE}/api/team-special-teams?season=${encodeURIComponent(specialTeamsSeason)}`
      : `${API_BASE}/api/team-special-teams`;

    const [dataResp, spResp] = await Promise.all([
      fetch(standingsUrl).catch(() => null),
      fetch(specialTeamsUrl).catch(() => null)
    ]);

    const data = dataResp && dataResp.ok ? await dataResp.json() : await (await fetch(`${API_BASE}/api/standings`)).json();
    const spJson = spResp && spResp.ok ? await spResp.json() : { teams: [] };

    const rawStandings = Array.isArray(data) ? data : (data?.standings || []);
    const specialTeams = Array.isArray(spJson?.teams) ? spJson.teams : [];

    const specialMap = new Map();
    specialTeams.forEach(row => {
      let abbrev = row?.teamAbbrev;
      if (abbrev) specialMap.set(String(abbrev).toUpperCase(), row);
    });

    state.currentStandingsData = rawStandings.map(team => {
      const abbrevStr = String(team.teamAbbrev || team.abbrev || "").toUpperCase();
      const special = specialMap.get(abbrevStr);
      return {
        ...team,
        teamAbbrev: abbrevStr,
        powerPlayPctg: special?.powerPlayPctg ?? team.powerPlayPctg,
        penaltyKillPctg: special?.penaltyKillPctg ?? team.penaltyKillPctg,
        faceoffWinPct: special?.faceoffWinPct ?? team.faceoffWinPct,
        shotsForPerGame: special?.shotsForPerGame ?? team.shotsForPerGame,
        shotsAgainstPerGame: special?.shotsAgainstPerGame ?? team.shotsAgainstPerGame,
        clinchIndicator: team.clinchIndicator || null,
      };
    });

    renderStandings();
  } catch (error) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить таблицу</div>';
  }
}

export async function loadAdvancedStandings() {
  const body = document.getElementById("advanced-standings-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка продвинутой статистики...</div>';

  try {
    const seasonId = seasonIdFromEndDate(state.selectedSeasonEndDate);
    const params = new URLSearchParams();
    if (seasonId) params.set("season", seasonId);

    const res = await fetch(`${API_BASE}/api/advanced-team-stats?${params}`);
    const data = await res.json();
    state.currentAdvancedTeamsData = data.teams || [];
    renderAdvancedStandings();
  } catch (_) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить аналитику</div>';
  }
}

export function renderAdvancedStandings() {
  const body = document.getElementById("advanced-standings-body");
  if (!body) return;
  if (!state.currentAdvancedTeamsData.length) {
    body.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  const sorted = [...state.currentAdvancedTeamsData].sort((a, b) => {
    const va = Number(a[state.advStandingsSortKey] ?? 0);
    const vb = Number(b[state.advStandingsSortKey] ?? 0);
    return state.advStandingsSortAsc ? va - vb : vb - va;
  });

  body.innerHTML = sorted.map((t, idx) => `
    <div class="standings-row" data-team="${escapeHtml(t.teamAbbrev)}">
      <div class="num sticky-col sticky-col-1">${idx + 1}</div>
      <div class="sticky-col sticky-col-2">
        <img class="team-logo" src="${escapeHtml(getSafeTeamLogoUrl(t.teamAbbrev))}" alt="" onerror="this.onerror=null; this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(t.teamAbbrev)}_dark.svg';">
      </div>
      <div class="name sticky-col sticky-col-3">
        <span>${escapeHtml(t.teamAbbrev)}</span>
      </div>
      <div class="num" style="color:${t.satPct >= 50 ? '#2ecc71' : '#ff4d4d'};font-weight:700;">${t.satPct}%</div>
      <div class="num" style="color:#ffffff;">${t.usatPct}%</div>
      <div class="num" style="color:#ffffff;">${t.pdo}</div>
      <div class="num" style="color:#ffffff;">${t.ozsp}%</div>
      <div class="num" style="color:#ffffff;">${t.shotsForPerGame}</div>
      <div class="num" style="color:#ffffff;">${t.shotsAgainstPerGame}</div>
    </div>
  `).join("");

  body.querySelectorAll(".standings-row").forEach(row => {
    row.addEventListener("click", () => {
      openTeamDetail(row.dataset.team, row.dataset.team, `https://assets.nhle.com/logos/nhl/svg/${row.dataset.team}_light.svg`);
    });
  });
}

export async function loadPlayoffBracket(playoffYear) {
  const container = document.getElementById("bracket-container");
  if (!container) return;
  container.innerHTML = `<div class="bracket-wrap"><div class="loading">Загрузка сетки плей-офф...</div></div>`;

  try {
    const response = await fetch(`${API_BASE}/api/playoff-bracket/${encodeURIComponent(playoffYear)}`);
    const data = await response.json();
    const series = data?.series || [];

    if (!series.length) {
      container.innerHTML = `<div class="bracket-wrap"><div class="section-title">Сетка плей-офф</div><div class="empty">Плей-офф недоступен</div></div>`;
      return;
    }

    const rounds = {};
    series.forEach(item => {
      const round = item.round ?? item.roundNumber ?? 1;
      if (!rounds[round]) rounds[round] = [];
      rounds[round].push(item);
    });

    const roundNames = { 1: "1-й раунд", 2: "2-й раунд (полуфинал конференции)", 3: "Финал конференции", 4: "Финал Кубка Стэнли" };
    let html = `<div class="bracket-wrap"><div class="section-title">Сетка плей-офф</div>`;
    Object.keys(rounds).sort((a, b) => Number(a) - Number(b)).forEach(round => {
      html += `<div class="bracket-round-title">${escapeHtml(roundNames[round] || `Раунд ${round}`)}</div>`;
      rounds[round].forEach(item => {
        const top = item.topSeedTeam || item.matchupTeams?.[0] || {};
        const bottom = item.bottomSeedTeam || item.matchupTeams?.[1] || {};
        const topWins = item.topSeedWins ?? item.matchupTeams?.[0]?.seriesWins ?? 0;
        const bottomWins = item.bottomSeedWins ?? item.matchupTeams?.[1]?.seriesWins ?? 0;

        html += `
          <div class="bracket-series">
            <div class="bracket-team-row ${topWins > bottomWins && topWins === 4 ? "winner" : ""}">
              <div class="bt-name"><img src="${escapeHtml(top.logo || "")}" alt=""><span>${escapeHtml(top.abbrev || "TBD")}</span></div>
              <div class="bt-wins">${topWins}</div>
            </div>
            <div class="bracket-team-row ${bottomWins > topWins && bottomWins === 4 ? "winner" : ""}">
              <div class="bt-name"><img src="${escapeHtml(bottom.logo || "")}" alt=""><span>${escapeHtml(bottom.abbrev || "TBD")}</span></div>
              <div class="bt-wins">${bottomWins}</div>
            </div>
          </div>
        `;
      });
    });
    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="bracket-wrap"><div class="empty">Не удалось загрузить сетку плей-офф</div></div>`;
  }
}

export function setStandingsMode(mode) {
  state.standingsViewMode = mode;
  document.getElementById("std-mode-all")?.classList.toggle("active", mode === "all");
  document.getElementById("std-mode-conf")?.classList.toggle("active", mode === "conf");
  document.getElementById("std-mode-div")?.classList.toggle("active", mode === "div");
  document.getElementById("std-mode-adv")?.classList.toggle("active", mode === "adv");

  const regTable = document.getElementById("standings-table-regular");
  const advTable = document.getElementById("standings-table-advanced");

  if (mode === "adv") {
    if (regTable) regTable.style.display = "none";
    if (advTable) advTable.style.display = "grid";
    state.currentAdvancedTeamsData.length ? renderAdvancedStandings() : loadAdvancedStandings();
  } else {
    if (advTable) advTable.style.display = "none";
    if (regTable) regTable.style.display = "grid";
    state.currentStandingsData.length ? renderStandings() : loadStandings();
  }
}

export function initStandingsModule() {
  document.getElementById("std-mode-all")?.addEventListener("click", () => setStandingsMode("all"));
  document.getElementById("std-mode-conf")?.addEventListener("click", () => setStandingsMode("conf"));
  document.getElementById("std-mode-div")?.addEventListener("click", () => setStandingsMode("div"));
  document.getElementById("std-mode-adv")?.addEventListener("click", () => setStandingsMode("adv"));

  document.querySelectorAll("#standings-table-regular .sortable").forEach(header => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (state.standingsSortKey === key) {
        state.standingsSortAsc = !state.standingsSortAsc;
      } else {
        state.standingsSortKey = key;
        state.standingsSortAsc = false;
      }
      renderStandings();
    });
  });

  document.querySelectorAll("#standings-table-advanced .sortable").forEach(header => {
    header.addEventListener("click", () => {
      const key = header.dataset.advSort;
      if (state.advStandingsSortKey === key) {
        state.advStandingsSortAsc = !state.advStandingsSortAsc;
      } else {
        state.advStandingsSortKey = key;
        state.advStandingsSortAsc = false;
      }
      renderAdvancedStandings();
    });
  });

  document.getElementById("season-select")?.addEventListener("change", event => {
    const option = event.target.options[event.target.selectedIndex];
    state.selectedSeasonEndDate = option.value;
    state.currentStandingsData = [];
    state.currentAdvancedTeamsData = [];
    loadStandings();

    let startYear = option.dataset.startYear;
    if (!startYear) {
      const now = new Date();
      startYear = String(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1);
    }
    const playoffYear = String(Number(startYear) + 1);
    if (option.dataset.startYear || new Date() >= new Date(Number(playoffYear), 3, 14)) {
      loadPlayoffBracket(playoffYear);
    }
  });
}
