/* ============================================================
   1. КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ============================================================ */
const API_BASE = "https://nhlnew.sergvolk504.workers.dev";

if (window.Telegram?.WebApp) {
  try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  } catch (e) {
    console.warn("Telegram WebApp init warning:", e);
  }
}

const NHL_TEAMS_FULL = {
  ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres",
  CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars",
  DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers",
  LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montreal Canadiens",
  NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders",
  NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken",
  STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs",
  UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights",
  WSH: "Washington Capitals", WPG: "Winnipeg Jets"
};

const TEAM_COLORS = {
  ANA: "#F47A38", BOS: "#FFB81C", BUF: "#003087", CGY: "#C8102E",
  CAR: "#CC0000", CHI: "#CF0A2C", COL: "#6F263D", CBJ: "#002654",
  DAL: "#006847", DET: "#CE1126", EDM: "#FF4C00", FLA: "#C8102E",
  LAK: "#A2AAAD", MIN: "#154734", MTL: "#AF1E2D", NSH: "#FFB81C",
  NJD: "#CE1126", NYI: "#00539B", NYR: "#0038A8", OTT: "#DA1A32",
  PHI: "#F74902", PIT: "#FCB514", SJS: "#006D75", SEA: "#001628",
  STL: "#002F87", TBL: "#002868", TOR: "#00205B", UTA: "#69B3E7",
  VAN: "#00205B", VGK: "#B4975A", WSH: "#C8102E", WPG: "#041E42"
};

const HISTORICAL_TEAM_LOGOS = {
  QUE: "https://records.nhle.com/site/asset/public/ext/franchise/logos/17.png",
  ATL: "https://records.nhle.com/site/asset/public/ext/franchise/logos/35.png",
  PHX: "https://records.nhle.com/site/asset/public/ext/franchise/logos/27.png",
  HFD: "https://records.nhle.com/site/asset/public/ext/franchise/logos/26.png",
  WIN: "https://records.nhle.com/site/asset/public/ext/franchise/logos/27.png"
};

let lastMainTab = "schedule";
let currentDate = new Date();
let currentCat = "points";
let currentLimit = 25;
let myFavoriteTeam = "";
try {
  myFavoriteTeam = localStorage.getItem("nhl_my_team") || "";
} catch (_) {}

let currentStandingsData = [];
let currentAdvancedTeamsData = [];
let standingsSortKey = "points";
let standingsSortAsc = false;
let advStandingsSortKey = "satPct";
let advStandingsSortAsc = false;
let standingsViewMode = "all";
let selectedSeasonEndDate = "";

let leadersMode = "skaters";
let currentGoalieSortKey = "wins";
let currentGoalieSortAsc = false;
let cachedGoaliesList = [];
let cachedSkatersList = [];
let skaterRookieOnly = false;
let skaterPositionFilter = "ALL";
let goalieMinGames = true;

let currentDraftYear = "2024";
let currentTeamFullData = null;
const goalieHeadshotCache = new Map();
const h2hTeamCache = new Map();

let navHistory = [];
let isNavigatingBack = false;

async function fetchAPI(endpoint) {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  try {
    const res = await fetch(`${API_BASE}${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) return data;
    }
  } catch (err) {
    console.error(`FetchAPI error on ${clean}:`, err);
  }
  throw new Error("Не удалось загрузить данные");
}

/* ============================================================
   2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UTILS)
   ============================================================ */
function nameStr(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default || value.name || "";
}

function val(value, fallback = "—") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

function formatShortName(fullName, first, last) {
  const f = nameStr(first);
  const l = nameStr(last);
  if (f && l) return `${f.charAt(0).toUpperCase()}. ${l}`;
  const str = String(fullName || "").trim();
  if (!str) return "Игрок";
  const parts = str.split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

function formatPctCell(v) {
  if (v === undefined || v === null || v === "" || isNaN(v)) return "—";
  const n = Number(v);
  return `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
}

function formatPercentDisplay(num) {
  if (num === undefined || num === null || num === "") return "—";
  const n = Number(num);
  return !Number.isFinite(n) ? String(num) : `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
}

function getTeamAbbrev(team) {
  if (!team) return "";
  if (typeof team === "string") return team.trim().toUpperCase();
  if (typeof team === "object") {
    return String(team.default || team.abbrev || team.abbreviation || team.teamAbbrev || "").trim().toUpperCase();
  }
  return "";
}

function getTeamName(team) {
  if (!team) return "";
  if (typeof team === "string") return team;
  return String(team.default || team.name || team.teamName || "");
}

function getSafeTeamLogoUrl(abbrev, fallbackLogo) {
  const up = String(abbrev || "").toUpperCase();
  if (HISTORICAL_TEAM_LOGOS[up]) return HISTORICAL_TEAM_LOGOS[up];
  if (fallbackLogo && typeof fallbackLogo === "string" && fallbackLogo.startsWith("http")) return fallbackLogo;
  return `https://assets.nhle.com/logos/nhl/svg/${up}_light.svg`;
}

function getPlayerId(player) {
  return String(player?.playerId || player?.id || "");
}

function getHeadshot(player) {
  if (player?.headshot) return player.headshot;
  const playerId = getPlayerId(player);
  if (playerId && goalieHeadshotCache.has(playerId)) return goalieHeadshotCache.get(playerId);
  return "";
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seasonIdFromEndDate(endDate) {
  if (!endDate || typeof endDate !== "string") return null;
  const match = endDate.match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? `${Number(match[1]) - 1}${Number(match[1])}` : null;
}

function stopAllVideos() {
  document.querySelectorAll("#detail-body iframe").forEach(i => i.remove());
}

function applyTeamTheme(teamAbbr) {
  if (!teamAbbr || !TEAM_COLORS[teamAbbr]) {
    document.documentElement.style.setProperty("--accent", "#1f5fce");
    document.documentElement.style.setProperty("--accent-glow", "rgba(31,95,206,0.35)");
    return;
  }
  const color = TEAM_COLORS[teamAbbr];
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-glow", `${color}55`);
}

function updateMyTeamButton() {
  const label = document.getElementById("my-team-label");
  if (!label) return;
  if (myFavoriteTeam) {
    label.innerHTML = `<img src="https://assets.nhle.com/logos/nhl/svg/${myFavoriteTeam}_light.svg" alt=""> ${myFavoriteTeam}`;
    applyTeamTheme(myFavoriteTeam);
  } else {
    label.innerHTML = `Мой клуб`;
    applyTeamTheme("");
  }
}

function pushScreenHistory(renderFunc) {
  if (!isNavigatingBack) {
    navHistory.push(renderFunc);
  }
}

function handleGoBack() {
  stopAllVideos();
  if (navHistory.length > 1) {
    navHistory.pop();
    const prev = navHistory[navHistory.length - 1];
    isNavigatingBack = true;
    try { prev(); } finally { isNavigatingBack = false; }
  } else {
    navHistory = [];
    switchTab(lastMainTab);
  }
}

function openDetail() {
  stopAllVideos();
  const backBtn = document.getElementById("header-back-btn");
  if (backBtn) backBtn.style.display = "inline-flex";

  ["schedule", "standings", "players", "transactions", "draft", "news"].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    if (el) el.style.display = "none";
  });
  const detail = document.getElementById("view-detail");
  if (detail) detail.style.display = "";
  const nav = document.getElementById("main-nav");
  if (nav) nav.style.display = "none";
  const body = document.getElementById("detail-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка...</div>';
  window.scrollTo(0, 0);
}

/* ============================================================
   3. ПРЕДМАТЧЕВЫЙ ЦЕНТР (PREGAME)
   ============================================================ */
function formatStreakDisplay(code, count) {
  if (!code || !count) return "—";
  const num = Number(count) || 0;
  const s = String(code).toUpperCase();

  function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  const winWord = pluralize(num, "победа", "победы", "побед");
  const lossWord = pluralize(num, "поражение", "поражения", "поражений");

  if (s.startsWith("W")) {
    return s.includes("OT") || s.includes("SO") ? `${num} ${winWord} в ОТ` : `${num} ${winWord}`;
  }
  if (s.startsWith("L")) {
    return `${num} ${lossWord}`;
  }
  if (s.startsWith("O")) {
    return `${num} ${lossWord} в ОТ`;
  }
  return `${code}${count}`;
}

function formatPregameLabel(cat) {
  const map = {
    powerPlayPctg: "БОЛЬШИНСТВО (%PP)",
    penaltyKillPctg: "МЕНЬШИНСТВО (%PK)",
    goalsForPerGame: "ЗАБРОШЕНО ЗА ИГРУ (GF/G)",
    goalsAgainstPerGame: "ПРОПУЩЕНО ЗА ИГРУ (GA/G)",
    shotsForPerGame: "БРОСКИ ПО ВОРОТАМ СОПЕРНИКА (SF/G)",
    shotsAgainstPerGame: "БРОСКИ СОПЕРНИКА ПО СВОИМ ВОРОТАМ (SA/G)"
  };
  return map[cat] || cat;
}

function renderProbableGoalieCard(goalie, teamAbbrev) {
  if (!goalie || !goalie.name || goalie.name === "Не объявлен") {
    return `
      <div class="pregame-goalie-box">
        <div class="pregame-goalie-avatar"><img src="https://assets.nhle.com/mugs/nhl/default-player.png"></div>
        <div class="pregame-goalie-name">Не объявлен</div>
        <div class="pregame-goalie-sub">${escapeHtml(teamAbbrev)}</div>
        <span class="pregame-status-badge badge-unannounced">ОЖИДАЕТСЯ</span>
      </div>
    `;
  }
  const isConfirmed = goalie.confirmed || String(goalie.status || "").toLowerCase().includes("подтвержд");
  return `
    <div class="pregame-goalie-box">
      <div class="pregame-goalie-avatar">
        <img src="${escapeHtml(goalie.headshot || 'https://assets.nhle.com/mugs/nhl/default-player.png')}" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        ${goalie.jersey ? `<span style="position:absolute;bottom:-4px;right:-4px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:6px;font-family:'Roboto Mono',monospace;">#${goalie.jersey}</span>` : ''}
      </div>
      <div class="pregame-goalie-name">${escapeHtml(goalie.name)}</div>
      <div class="pregame-goalie-sub">${escapeHtml(teamAbbrev)}</div>
      <span class="pregame-status-badge ${isConfirmed ? 'badge-confirmed' : 'badge-probable'}">${isConfirmed ? 'ПОДТВЕРЖДЁН' : 'ВЕРОЯТЕН'}</span>
    </div>
  `;
}

function renderPregameInjuryList(list) {
  if (!Array.isArray(list) || !list.length) {
    return '<div class="empty" style="padding:10px 0;font-size:11px;">Нет травмированных</div>';
  }
  return list.map(item => {
    const status = String(item.status || "Injured").toUpperCase();
    const isOut = status.includes("OUT") || status.includes("IR");
    const badgeClass = isOut ? "badge-out" : "badge-dtd";
    return `
      <div class="injury-item">
        <div class="injury-item-top">
          <div class="injury-name">${escapeHtml(formatShortName(item.name))} <small style="color:var(--silver-dim);font-weight:normal;">(${escapeHtml(item.position || '')})</small></div>
          <span class="${badgeClass}">${escapeHtml(item.status)}</span>
        </div>
        ${item.details ? `<div class="injury-desc">${escapeHtml(item.details)}</div>` : ''}
      </div>
    `;
  }).join("");
}

function getGameTeamAbbrev(team) {
  if (!team) return "";
  if (typeof team === "string") return team.toUpperCase();
  return String(team.abbrev || team.teamAbbrev?.default || team.teamAbbrev || "").toUpperCase();
}

function getGameScore(game, side) {
  const v = game?.[`${side}Team`]?.score ?? game?.[`${side}Score`];
  return (v !== undefined && v !== null) ? Number(v) : null;
}

function getGameDateValue(game) {
  return game?.gameDate || game?.date || game?.startTimeUTC || "";
}

function isCompletedGame(game) {
  const state = String(game?.gameState || "").toUpperCase();
  return state === "OFF" || state === "FINAL" || state === "F" ||
    (game?.awayTeam?.score !== undefined && game?.homeTeam?.score !== undefined);
}

function getGamePeriodType(game) {
  const period = String(
    game?.gameOutcome?.lastPeriodType ||
    game?.periodDescriptor?.periodType ||
    game?.lastPeriodType ||
    ""
  ).toUpperCase();
  if (period === "OT") return "ОТ";
  if (period === "SO") return "Б";
  return "";
}

function getHistoricalTeamAbbrevs(abbrev) {
  const up = String(abbrev || "").toUpperCase();
  if (up === "UTA") return ["UTA", "ARI"];
  if (up === "ARI") return ["ARI", "UTA"];
  return [up];
}

async function loadMatchupHistory(awayAbbrev, homeAbbrev) {
  const awayAliases = getHistoricalTeamAbbrevs(awayAbbrev);
  const homeAliases = getHistoricalTeamAbbrevs(homeAbbrev);

  let seasonIds = [];
  try {
    const data = await fetchAPI("/api/seasons-list");
    const seasons = Array.isArray(data?.seasons) ? data.seasons : (Array.isArray(data) ? data : []);
    seasonIds = seasons.map(s => String(s?.id || "")).filter(id => /^\d{8}$/.test(id)).sort((a,b) => Number(b) - Number(a));
  } catch (_) {}

  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const currentSeasonId = `${startYear}${startYear + 1}`;
  seasonIds = [currentSeasonId, ...seasonIds].filter((id, i, arr) => arr.indexOf(id) === i).slice(0, 8);

  const allGames = [];
  await Promise.all(seasonIds.map(async seasonId => {
    try {
      const data = await fetchAPI(`/api/team-schedule/${encodeURIComponent(awayAliases[0])}?season=${encodeURIComponent(seasonId)}`);
      const games = Array.isArray(data?.games) ? data.games : [];
      games.forEach(g => {
        if (!isCompletedGame(g)) return;
        const gAway = getGameTeamAbbrev(g.awayTeam);
        const gHome = getGameTeamAbbrev(g.homeTeam);

        const matchAway = awayAliases.includes(gAway);
        const matchHome = homeAliases.includes(gHome);
        const matchAwayRev = awayAliases.includes(gHome);
        const matchHomeRev = homeAliases.includes(gAway);

        if ((matchAway && matchHome) || (matchAwayRev && matchHomeRev)) {
          allGames.push({ ...g, __season: seasonId });
        }
      });
    } catch (_) {}
  }));

  const unique = [];
  const seen = new Set();
  allGames.sort((a, b) => (new Date(getGameDateValue(b)).getTime() || 0) - (new Date(getGameDateValue(a)).getTime() || 0))
    .forEach(g => {
      const key = String(g.id || `${getGameDateValue(g)}:${getGameTeamAbbrev(g.awayTeam)}:${getGameTeamAbbrev(g.homeTeam)}`);
      if (!seen.has(key)) { seen.add(key); unique.push(g); }
    });

  return unique.slice(0, 10);
}

function renderMatchupHistory(games, awayAbbrev, homeAbbrev) {
  if (!games.length) return '<div class="empty">История личных встреч формируется</div>';

  const awayAliases = getHistoricalTeamAbbrevs(awayAbbrev);
  let aWins = 0, hWins = 0;
  games.forEach(g => {
    const a = getGameScore(g, "away");
    const h = getGameScore(g, "home");
    const gAway = getGameTeamAbbrev(g.awayTeam);
    if (a !== null && h !== null) {
      if (a > h) { if (awayAliases.includes(gAway)) aWins++; else hWins++; }
      else if (h > a) { if (awayAliases.includes(gAway)) hWins++; else aWins++; }
    }
  });

  let html = `
    <div class="matchup-summary-box">
      <div class="matchup-side-col left">
        <div class="matchup-team-title">${escapeHtml(awayAbbrev)}</div>
        <div class="matchup-rec-sub">Побед: ${aWins}</div>
      </div>
      <div class="matchup-total-badge">${games.length} матчей</div>
      <div class="matchup-side-col right">
        <div class="matchup-team-title">${escapeHtml(homeAbbrev)}</div>
        <div class="matchup-rec-sub">Побед: ${hWins}</div>
      </div>
    </div>
  `;

  games.forEach(g => {
    const a = getGameScore(g, "away");
    const h = getGameScore(g, "home");
    let gAway = getGameTeamAbbrev(g.awayTeam);
    let gHome = getGameTeamAbbrev(g.homeTeam);
    if (gAway === "ARI") gAway = "UTA";
    if (gHome === "ARI") gHome = "UTA";

    const otType = getGamePeriodType(g);
    const otBadge = otType ? `<span class="ot-label">(${otType})</span>` : "";
    const aWinner = a !== null && h !== null && a > h;
    const hWinner = a !== null && h !== null && h > a;
    const dVal = getGameDateValue(g);
    const dStr = dVal ? new Date(dVal).toLocaleDateString("ru-RU") : "";
    const sStr = g.__season ? String(g.__season).replace(/^(\d{4})(\d{4})$/, "$1-$2") : "";

    html += `
      <div class="h2h-game-row">
        <div class="h2h-team-cell left ${aWinner ? 'team-winner' : 'team-loser'}">${escapeHtml(gAway)}</div>
        <div class="h2h-center-cell">
          <div class="h2h-score-val">${a !== null && h !== null ? `${a} : ${h}` : '—'} ${otBadge}</div>
          ${dStr ? `<div class="h2h-date-sub">${escapeHtml(dStr)}${sStr ? ` · ${escapeHtml(sStr)}` : ''}</div>` : ''}
        </div>
        <div class="h2h-team-cell right ${hWinner ? 'team-winner' : 'team-loser'}">${escapeHtml(gHome)}</div>
      </div>
    `;
  });

  return html;
}

function renderSeasonSeriesBlock(series, awayAbbrev, homeAbbrev) {
  if (!Array.isArray(series) || !series.length) return "";
  let html = `<div class="section-title">ОЧНЫЕ ВСТРЕЧИ В ЭТОМ СЕЗОНЕ</div><div class="card" style="padding:0;">`;
  series.forEach(g => {
    const a = g.awayTeam?.score ?? g.awayScore ?? null;
    const h = g.homeTeam?.score ?? g.homeScore ?? null;
    const aAb = getGameTeamAbbrev(g.awayTeam) || awayAbbrev;
    const hAb = getGameTeamAbbrev(g.homeTeam) || homeAbbrev;
    const dVal = getGameDateValue(g);
    const dStr = dVal ? new Date(dVal).toLocaleDateString("ru-RU") : "";
    const isPlayed = a !== null && h !== null;
    const otType = isPlayed ? getGamePeriodType(g) : "";
    const otBadge = otType ? `<span class="ot-label">(${otType})</span>` : "";

    const aWinner = isPlayed && a > h;
    const hWinner = isPlayed && h > a;

    html += `
      <div class="h2h-game-row">
        <div class="h2h-team-cell left ${isPlayed ? (aWinner ? 'team-winner' : 'team-loser') : ''}">${escapeHtml(aAb)}</div>
        <div class="h2h-center-cell">
          <div class="h2h-score-val">${isPlayed ? `${a} : ${h}` : 'Предстоит'} ${otBadge}</div>
          ${dStr ? `<div class="h2h-date-sub">${escapeHtml(dStr)}</div>` : ''}
        </div>
        <div class="h2h-team-cell right ${isPlayed ? (hWinner ? 'team-winner' : 'team-loser') : ''}">${escapeHtml(hAb)}</div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function renderFullPregameCenter(data, awayAbbrev, homeAbbrev, awayLogo, homeLogo) {
  const body = document.getElementById("detail-body");
  if (!body) return;
  const away = data.awayTeam || {};
  const home = data.homeTeam || {};
  const injuries = data.injuries || { away: [], home: [] };
  const preStats = Array.isArray(data.preGameStats) ? data.preGameStats : [];
  const probables = data.probableGoalies || { away: null, home: null };
  const seasonSeries = Array.isArray(data.seasonSeries) ? data.seasonSeries : [];

  const startTime = data.startTimeUTC
    ? new Date(data.startTimeUTC).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + " (МСК)"
    : "Время уточняется";

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:6px 0;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(away.abbrev || awayAbbrev)}_light.svg" style="width:46px;height:46px;object-fit:contain;">
      <div style="text-align:center;">
        <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:.05em;">${escapeHtml(away.abbrev || awayAbbrev)} — ${escapeHtml(home.abbrev || homeAbbrev)}</div>
        <div style="font-size:12px;color:#2ecc71;font-weight:700;margin-top:2px;">НАЧАЛО: ${escapeHtml(startTime)}</div>
      </div>
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(home.abbrev || homeAbbrev)}_light.svg" style="width:46px;height:46px;object-fit:contain;">
    </div>

    <div class="section-title">СТАРТОВЫЕ ГОЛКИПЕРЫ</div>
    <div class="pregame-probables-grid">
      ${renderProbableGoalieCard(probables.away, away.abbrev || awayAbbrev)}
      ${renderProbableGoalieCard(probables.home, home.abbrev || homeAbbrev)}
    </div>

    <div class="section-title">СРАВНЕНИЕ ПОКАЗАТЕЛЕЙ КОМАНД</div>
    <div class="card" style="padding:10px 14px;">
      ${preStats.map(st => {
        const isPct = (st.category || "").toLowerCase().includes("pct");
        const aVal = isPct ? formatPercentDisplay(st.awayValue) : val(st.awayValue);
        const hVal = isPct ? formatPercentDisplay(st.homeValue) : val(st.homeValue);
        const aNum = Number(st.awayValue ?? -999);
        const hNum = Number(st.homeValue ?? -999);
        const lowerIsBetter = (st.category || "").toLowerCase().includes("against");
        const higherBetter = st.higherIsBetter !== undefined ? st.higherIsBetter : !lowerIsBetter;

        let awayClass = "";
        let homeClass = "";
        if (Number.isFinite(aNum) && Number.isFinite(hNum) && aNum !== -999 && hNum !== -999 && aNum !== hNum) {
          const aIsBetter = higherBetter ? (aNum > hNum) : (aNum < hNum);
          awayClass = aIsBetter ? "val-better" : "val-worse";
          homeClass = aIsBetter ? "val-worse" : "val-better";
        }

        return `
          <div class="comp-row">
            <div class="val away ${awayClass}">${escapeHtml(aVal)}</div>
            <div class="metric">${escapeHtml(formatPregameLabel(st.category))}</div>
            <div class="val home ${homeClass}">${escapeHtml(hVal)}</div>
          </div>
        `;
      }).join("")}
    </div>

    <div class="section-title">СЕРИИ И ФОРМА КОМАНД</div>
    <div class="card" style="padding:10px 14px;">
      <div class="comp-row">
        <div class="val away" style="color:var(--silver);">${escapeHtml(formatStreakDisplay(away.streakCode, away.streakCount))}</div>
        <div class="metric">ТЕКУЩАЯ СЕРИЯ</div>
        <div class="val home" style="color:var(--silver);">${escapeHtml(formatStreakDisplay(home.streakCode, home.streakCount))}</div>
      </div>
      <div class="comp-row">
        <div class="val away">${escapeHtml(away.l10Record || '—')}</div>
        <div class="metric">ФОРМА (ПОСЛ. 10)</div>
        <div class="val home">${escapeHtml(home.l10Record || '—')}</div>
      </div>
      <div class="comp-row">
        <div class="val away">${escapeHtml(away.roadRecord || '—')} (В гостях)</div>
        <div class="metric">ДОМА / В ГОСТЯХ</div>
        <div class="val home">${escapeHtml(home.homeRecord || '—')} (Дома)</div>
      </div>
      <div class="comp-row">
        <div class="val away" style="color:#ffffff !important;">${escapeHtml(away.record?.points ?? '—')} очков (${escapeHtml(away.record?.gamesPlayed ?? '—')} игр)</div>
        <div class="metric">ОЧКИ В СЕЗОНЕ</div>
        <div class="val home" style="color:#ffffff !important;">${escapeHtml(home.record?.points ?? '—')} очков (${escapeHtml(home.record?.gamesPlayed ?? '—')} игр)</div>
      </div>
    </div>

    <div class="section-title">СПИСОК ТРАВМИРОВАННЫХ (INJURIES)</div>
    <div class="pregame-injuries-grid">
      <div class="injury-team-col">
        <h4><img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(away.abbrev || awayAbbrev)}_light.svg" style="width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain;"> ${escapeHtml(away.abbrev || awayAbbrev)}</h4>
        ${renderPregameInjuryList(injuries.away)}
      </div>
      <div class="injury-team-col">
        <h4><img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(home.abbrev || homeAbbrev)}_light.svg" style="width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain;"> ${escapeHtml(home.abbrev || homeAbbrev)}</h4>
        ${renderPregameInjuryList(injuries.home)}
      </div>
    </div>

    <div class="section-title" id="h2h-title-slot">ПОСЛЕДНИЕ 10 МАТЧЕЙ МЕЖДУ КЛУБАМИ</div>
    <div class="card" style="padding:0;" id="pregame-h2h-container">
      <div class="loading">Загрузка очных встреч...</div>
    </div>

    ${renderSeasonSeriesBlock(seasonSeries, away.abbrev || awayAbbrev, home.abbrev || homeAbbrev)}
  `;

  body.innerHTML = html;

  loadMatchupHistory(away.abbrev || awayAbbrev, home.abbrev || homeAbbrev).then(h2hGames => {
    const container = document.getElementById("pregame-h2h-container");
    const titleSlot = document.getElementById("h2h-title-slot");
    if (container) {
      if (titleSlot && h2hGames.length > 0) {
        titleSlot.textContent = `ПОСЛЕДНИЕ ${h2hGames.length} МАТЧЕЙ МЕЖДУ КЛУБАМИ`;
      }
      container.innerHTML = renderMatchupHistory(h2hGames, away.abbrev || awayAbbrev, home.abbrev || homeAbbrev);
    }
  }).catch(() => {
    const container = document.getElementById("pregame-h2h-container");
    if (container) container.innerHTML = '<div class="empty">Очные встречи не найдены</div>';
  });
}

async function openFutureGamePreview(gameId, awayAbbrev, homeAbbrev, awayLogo, homeLogo, dateStr) {
  pushScreenHistory(() => openFutureGamePreview(gameId, awayAbbrev, homeAbbrev, awayLogo, homeLogo, dateStr));
  openDetail();
  const body = document.getElementById("detail-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка предматчевой аналитики...</div>';

  try {
    const data = await fetchAPI(`/api/pregame/${encodeURIComponent(gameId)}?date=${dateStr || ''}&away=${awayAbbrev}&home=${homeAbbrev}`);
    renderFullPregameCenter(data, awayAbbrev, homeAbbrev, awayLogo, homeLogo);
  } catch (err) {
    if (body) {
      body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:6px 0;">
          <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" style="width:46px;height:46px;">
          <div style="text-align:center;">
            <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;">${escapeHtml(awayAbbrev)} — ${escapeHtml(homeAbbrev)}</div>
            <div style="font-size:12px;color:var(--silver-dim);">ПРЕДСТОЯЩИЙ МАТЧ</div>
          </div>
          <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" style="width:46px;height:46px;">
        </div>
        <div class="section-title">ПОСЛЕДНИЕ МАТЧИ МЕЖДУ КЛУБАМИ</div>
        <div class="card" style="padding:0;" id="pregame-h2h-container"><div class="loading">Загрузка очных встреч...</div></div>
      `;
      loadMatchupHistory(awayAbbrev, homeAbbrev).then(h2hGames => {
        const c = document.getElementById("pregame-h2h-container");
        if (c) c.innerHTML = renderMatchupHistory(h2hGames, awayAbbrev, homeAbbrev);
      });
    }
  }
}

/* ============================================================
   4. РАСПИСАНИЕ И МАТЧИ (SCHEDULE)
   ============================================================ */
function renderTeamRecord(team) {
  const record = team?.currentRecord;
  if (!record) return "";
  return `<div class="team-record"><strong>${record.wins ?? 0}-${record.losses ?? 0}-${record.otLosses ?? 0}-${record.points ?? 0}</strong></div>`;
}

function renderGame(game) {
  const away = game.awayTeam || {};
  const home = game.homeTeam || {};
  const awayAbbrev = getTeamAbbrev(away);
  const homeAbbrev = getTeamAbbrev(home);

  const isPinned = myFavoriteTeam && (awayAbbrev === myFavoriteTeam || homeAbbrev === myFavoriteTeam);
  const started = game.gameState !== "FUT" && game.gameState !== "PRE";
  const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
  const status = started
    ? (isLive ? "● LIVE" : "Финал")
    : new Date(game.startTimeUTC).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return `
    <div class="card ${isPinned ? 'pinned' : ''}">
      <div class="game-row">
        <div class="team" data-team="${escapeHtml(awayAbbrev)}" data-name="${escapeHtml(away.name || awayAbbrev)}">
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" alt="">
          <div>
            <div class="abbr">${escapeHtml(awayAbbrev)}</div>
            ${renderTeamRecord(away)}
          </div>
        </div>

        <div class="score-box" data-game-id="${escapeHtml(game.id)}" data-away="${escapeHtml(awayAbbrev)}" data-home="${escapeHtml(homeAbbrev)}">
          <div class="score">${started ? `${away.score ?? 0} : ${home.score ?? 0}` : "vs"}</div>
          <div class="status ${isLive ? 'live-pulse' : ''}">${escapeHtml(status)}</div>
        </div>

        <div class="team right" data-team="${escapeHtml(homeAbbrev)}" data-name="${escapeHtml(home.name || homeAbbrev)}">
          <div>
            <div class="abbr">${escapeHtml(homeAbbrev)}</div>
            ${renderTeamRecord(home)}
          </div>
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" alt="">
        </div>
      </div>
    </div>
  `;
}

async function loadSchedule() {
  const games = document.getElementById("games");
  const dateStr = fmtDate(currentDate);
  const dp = document.getElementById("date-picker");
  if (dp) dp.value = dateStr;

  if (games) games.innerHTML = '<div class="loading">Загрузка матчей...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/schedule?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    const day = (data.gameWeek || []).find(item => item.date === dateStr);
    let list = day?.games || [];

    if (!list.length) {
      if (games) {
        games.innerHTML = '<div class="empty">В этот день матчей нет</div>';
        loadSpotlight();
      }
      return;
    }

    if (myFavoriteTeam) {
      list = [...list].sort((a, b) => {
        const aFav = (getTeamAbbrev(a.awayTeam) === myFavoriteTeam || getTeamAbbrev(a.homeTeam) === myFavoriteTeam);
        const bFav = (getTeamAbbrev(b.awayTeam) === myFavoriteTeam || getTeamAbbrev(b.homeTeam) === myFavoriteTeam);
        return (bFav ? 1 : 0) - (aFav ? 1 : 0);
      });
    }

    if (games) {
      games.innerHTML = list.map(renderGame).join("");

      games.querySelectorAll(".score-box").forEach(el => {
        el.onclick = () => {
          const gId = el.dataset.gameId;
          const away = el.dataset.away;
          const home = el.dataset.home;
          const g = list.find(item => String(item.id) === String(gId));
          if (g && (g.gameState === "FUT" || g.gameState === "PRE")) {
            openFutureGamePreview(gId, away, home, "", "", dateStr);
          } else {
            openGameDetail(gId, away, home);
          }
        };
      });

      games.querySelectorAll(".team[data-team]").forEach(team => {
        team.onclick = (e) => {
          e.stopPropagation();
          openTeamDetail(team.dataset.team, team.dataset.name, "");
        };
      });
    }
  } catch (err) {
    if (games) games.innerHTML = '<div class="empty">Не удалось загрузить матчи</div>';
  }
}

async function fetchGamecenterEndpoint(gameId, endpoint) {
  const targetUrl = `https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`;
  const urls = [
    `${API_BASE}/api/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`,
    `${API_BASE}/v1/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`,
    targetUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) return JSON.parse(text);
      }
    } catch (_) {}
  }
  return null;
}

async function openGameDetail(gameId, awayAbbrev, homeAbbrev) {
  pushScreenHistory(() => openGameDetail(gameId, awayAbbrev, homeAbbrev));
  openDetail();
  const body = document.getElementById("detail-body");
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:6px 0;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" style="width:46px;height:46px;object-fit:contain;">
      <div style="text-align:center;">
        <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:.05em;">${escapeHtml(awayAbbrev)} — ${escapeHtml(homeAbbrev)}</div>
        <div style="font-size:12px;color:var(--silver-dim);margin-top:2px;">Статистика и обзор матча</div>
      </div>
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" style="width:46px;height:46px;object-fit:contain;">
    </div>
    <div id="game-detail-content"><div class="loading">Загрузка данных матча...</div></div>
  `;

  try {
    const [landing, boxscore] = await Promise.all([
      fetchGamecenterEndpoint(gameId, "landing"),
      fetchGamecenterEndpoint(gameId, "boxscore")
    ]);

    const container = document.getElementById("game-detail-content");
    if (!container) return;

    let html = `
      <div class="section-title">ОФИЦИАЛЬНЫЙ ВИДЕООБЗОР МАТЧА (NHL)</div>
      <div id="video-recap-slot" style="margin-bottom:18px;">
        <div class="loading" style="padding:16px;">Поиск официального обзора...</div>
      </div>
    `;

    const stars = landing?.summary?.threeStars || [];
    if (stars.length > 0) {
      html += `<div class="section-title">ТРИ ЗВЕЗДЫ МАТЧА</div><div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:18px;">`;
      stars.forEach((s, idx) => {
        const starNum = s.star || (idx + 1);
        const medal = starNum === 1 ? '🥇 1-Я ЗВЕЗДА' : (starNum === 2 ? '🥈 2-Я ЗВЕЗДА' : '🥉 3-Я ЗВЕЗДА');
        const pName = formatShortName(s.name?.default || s.name || "Игрок");
        const tm = s.teamAbbrev || "";
        const pos = s.position || "";
        const statLine = `${s.goals ?? 0} Г, ${s.assists ?? 0} П`;
        const pId = s.playerId ? String(s.playerId) : "";

        html += `
          <div class="card" style="padding:10px 4px;display:flex;flex-direction:column;align-items:center;text-align:center;cursor:${pId ? 'pointer' : 'default'};" ${pId ? `onclick="openPlayerDetail('${pId}')"` : ''}>
            <div style="font-size:10px;font-family:'Oswald',sans-serif;color:var(--silver-dim);text-transform:uppercase;margin-bottom:6px;">${medal}</div>
            <img src="${escapeHtml(s.headshot || 'https://assets.nhle.com/mugs/nhl/default-player.png')}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:1px solid var(--border);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
            <div style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">${escapeHtml(pName)}</div>
            <div style="font-size:10px;color:var(--silver-dim);">${escapeHtml(tm)} · ${escapeHtml(pos)}</div>
            <div style="font-size:11px;font-family:'Roboto Mono',monospace;color:#2ecc71;font-weight:700;margin-top:4px;">${statLine}</div>
          </div>
        `;
      });
      html += `</div>`;
    }

    const periods = landing?.summary?.scoring || [];
    html += `<div class="section-title">ГОЛЫ</div>`;
    if (periods.length === 0) {
      html += `<div class="card"><div class="empty">В основное время голов не забито</div></div>`;
    } else {
      html += `<div class="card" style="padding:4px 14px 10px 14px;margin-bottom:18px;">`;
      periods.forEach((pGroup) => {
        const pNum = pGroup.periodDescriptor?.number;
        const pType = pGroup.periodDescriptor?.periodType;
        let pTitle = `${pNum}-Й ПЕРИОД`;
        if (pType === "OT") pTitle = "ОВЕРТАЙМ";
        if (pType === "SO") pTitle = "БУЛЛИТЫ";

        html += `<div style="font-family:'Oswald',sans-serif;font-size:12px;color:var(--silver-dim);text-transform:uppercase;padding:10px 0 4px 0;border-bottom:1px solid var(--border);">${pTitle}</div>`;

        (pGroup.goals || []).forEach(g => {
          const scorer = `${nameStr(g.firstName)} ${nameStr(g.lastName)}`.trim();
          const team = g.teamAbbrev?.default || g.teamAbbrev || "";
          const str = (g.strength === "pp") ? " (Б)" : ((g.strength === "sh") ? " (М)" : "");
          const assistsList = (g.assists || []).map(a => `${nameStr(a.firstName)} ${nameStr(a.lastName)}`.trim()).filter(Boolean);
          const assistsStr = assistsList.length ? `Передачи: ${assistsList.join(", ")}` : "Без передач";

          html += `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;">
              <div style="color:var(--silver-dim);font-family:'Roboto Mono',monospace;font-size:11px;width:44px;padding-top:2px;">${escapeHtml(g.timeInPeriod || "")}</div>
              <div style="flex:1;padding:0 8px;">
                <div style="font-weight:700;color:#fff;">${escapeHtml(scorer)} (${escapeHtml(team)})${str}</div>
                <div style="font-size:11px;color:var(--silver-dim);margin-top:2px;">${escapeHtml(assistsStr)}</div>
              </div>
              <div style="font-family:'Roboto Mono',monospace;font-size:13px;font-weight:700;color:#fff;white-space:nowrap;">${g.awayScore} : ${g.homeScore}</div>
            </div>
          `;
        });
      });
      html += `</div>`;
    }

    const statsList = landing?.summary?.teamGameStats || [];
    if (statsList.length > 0) {
      const statMapLabels = {
        sog: "БРОСКИ В СТВОР", faceoffWinningPctg: "ВБРАСЫВАНИЯ, %", faceoffPctg: "ВБРАСЫВАНИЯ, %",
        faceoffsWon: "ВЫИГРАННЫЕ ВБРАСЫВАНИЯ", powerPlay: "БОЛЬШИНСТВО", powerPlayPctg: "БОЛЬШИНСТВО, %",
        pim: "ШТРАФ (МИН)", hits: "СИЛОВЫЕ ПРИЁМЫ", blockedShots: "ЗАБЛОКИРОВАНО БРОСКОВ",
        giveaways: "ПОТЕРИ ШАЙБЫ", takeaways: "ОТБОРЫ ШАЙБЫ"
      };

      html += `
        <div class="section-title">СТАТИСТИКА КОМАНД</div>
        <div class="card" style="padding:10px 14px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:6px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;">
              <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" style="width:20px;height:20px;">
              <span>${escapeHtml(awayAbbrev)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;">
              <span>${escapeHtml(homeAbbrev)}</span>
              <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" style="width:20px;height:20px;">
            </div>
          </div>
      `;

      statsList.forEach(st => {
        const cat = st.category || "";
        const label = statMapLabels[cat] || cat.toUpperCase();
        let aVal = st.awayValue ?? "—";
        let hVal = st.homeValue ?? "—";
        if (cat.toLowerCase().includes("pctg") || cat.toLowerCase().includes("pct")) {
          if (typeof aVal === "number" || (!String(aVal).includes("%") && !isNaN(Number(aVal)))) aVal = `${Number(aVal).toFixed(1)}%`;
          if (typeof hVal === "number" || (!String(hVal).includes("%") && !isNaN(Number(hVal)))) hVal = `${Number(hVal).toFixed(1)}%`;
        }

        html += `
          <div class="comp-row">
            <div class="val away" style="font-weight:700;color:#fff;">${escapeHtml(String(aVal))}</div>
            <div class="metric">${escapeHtml(label)}</div>
            <div class="val home" style="font-weight:700;color:#fff;">${escapeHtml(String(hVal))}</div>
          </div>
        `;
      });
      html += `</div>`;
    }

    function renderSkatersTable(teamAbbrev, skatersList) {
      if (!skatersList || !skatersList.length) return "";
      return `
        <div class="section-title">ИГРОКИ — ${escapeHtml(teamAbbrev)}</div>
        <div class="table-scroll" style="margin-bottom:18px;">
          <table class="stat-table">
            <thead>
              <tr>
                <th>ИГРОК</th><th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Б</th><th>В</th><th>Х</th><th>БЛ</th><th>% ВБР</th>
              </tr>
            </thead>
            <tbody>
              ${skatersList.map(p => {
                const pName = formatShortName(p.name?.default || p.name || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`);
                const pos = p.position || "";
                const pId = p.playerId ? String(p.playerId) : "";
                const foPct = (p.faceoffWinningPctg !== undefined && p.faceoffWinningPctg !== null) ? `${Number(p.faceoffWinningPctg).toFixed(1)}%` : "0.0%";

                return `
                  <tr class="clickable-row" ${pId ? `onclick="openPlayerDetail('${pId}')"` : ''}>
                    <td style="font-weight:600;white-space:nowrap;">${escapeHtml(pName)} <small style="color:var(--silver-dim);">(${escapeHtml(pos)})</small></td>
                    <td class="num">${val(p.goals, 0)}</td>
                    <td class="num">${val(p.assists, 0)}</td>
                    <td class="num" style="color:#fff;font-weight:700;">${val(p.points, 0)}</td>
                    <td class="num">${val(p.plusMinus, 0)}</td>
                    <td class="num">${val(p.shots ?? p.sog, 0)}</td>
                    <td class="num" style="font-family:'Roboto Mono',monospace;">${val(p.toi, "00:00")}</td>
                    <td class="num">${val(p.hits, 0)}</td>
                    <td class="num">${val(p.blockedShots ?? p.blocks, 0)}</td>
                    <td class="num">${foPct}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderGoaliesTable(teamAbbrev, goaliesList) {
      if (!goaliesList || !goaliesList.length) return "";
      return `
        <div class="section-title">ВРАТАРИ — ${escapeHtml(teamAbbrev)}</div>
        <div class="table-scroll" style="margin-bottom:18px;">
          <table class="stat-table">
            <thead>
              <tr><th>ВРАТАРЬ</th><th>БР</th><th>О</th><th>%ОБ</th><th>В</th><th>ГКИ</th></tr>
            </thead>
            <tbody>
              ${goaliesList.map(g => {
                const gName = formatShortName(g.name?.default || g.name || `${nameStr(g.firstName)} ${nameStr(g.lastName)}`);
                const pId = g.playerId ? String(g.playerId) : "";
                const sa = g.shotsAgainst ?? g.shots ?? 0;
                const saves = g.saves ?? (sa - (g.goalsAgainst ?? 0));
                const svPct = (g.savePctg !== undefined && g.savePctg !== null) ? `${(Number(g.savePctg) <= 1 ? Number(g.savePctg) * 100 : Number(g.savePctg)).toFixed(1)}%` : "—";
                const gaa = (g.goalsAgainst !== undefined && g.goalsAgainst !== null) ? Number(g.goalsAgainst).toFixed(2) : "—";

                return `
                  <tr class="clickable-row" ${pId ? `onclick="openPlayerDetail('${pId}')"` : ''}>
                    <td style="font-weight:600;white-space:nowrap;">${escapeHtml(gName)}</td>
                    <td class="num">${sa}</td>
                    <td class="num">${saves}</td>
                    <td class="num" style="color:#fff;font-weight:700;">${svPct}</td>
                    <td class="num" style="font-family:'Roboto Mono',monospace;">${val(g.toi, "00:00")}</td>
                    <td class="num">${gaa}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const awayBox = boxscore?.playerByGameStats?.awayTeam || {};
    const homeBox = boxscore?.playerByGameStats?.homeTeam || {};

    html += renderSkatersTable(awayAbbrev, [...(awayBox.forwards || []), ...(awayBox.defense || [])]);
    html += renderSkatersTable(homeAbbrev, [...(homeBox.forwards || []), ...(homeBox.defense || [])]);
    html += renderGoaliesTable(awayAbbrev, awayBox.goalies || []);
    html += renderGoaliesTable(homeAbbrev, homeBox.goalies || []);

    container.innerHTML = html;

    const gameDate = landing?.gameDate || "";
    if (gameDate) {
      fetch(`${API_BASE}/api/game-youtube-recap?away=${awayAbbrev}&home=${homeAbbrev}&date=${gameDate}`)
        .then(r => r.json())
        .then(vData => {
          const vSlot = document.getElementById("video-recap-slot");
          if (vData?.videoId && vSlot) {
            vSlot.innerHTML = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${vData.videoId}?playsinline=1&rel=0" allowfullscreen></iframe></div>`;
          } else if (vSlot) {
            vSlot.style.display = "none";
          }
        }).catch(() => {
          const vSlot = document.getElementById("video-recap-slot");
          if (vSlot) vSlot.style.display = "none";
        });
    }
  } catch (err) {
    const container = document.getElementById("game-detail-content");
    if (container) container.innerHTML = '<div class="empty">Не удалось загрузить полную статистику матча</div>';
  }
}

async function loadSpotlight() {
  const games = document.getElementById("games");
  try {
    const res = await fetch(`${API_BASE}/api/leaders/points?limit=5`);
    const data = await res.json();
    const list = data.points || [];
    if (!list.length || !games) return;

    let html = '<div class="section-title">Лидеры лиги по очкам</div>';
    html += list.map((p, i) => `
      <div class="player-row" onclick="openPlayerDetail('${getPlayerId(p)}')">
        <div class="rank">${i + 1}</div>
        <img class="headshot" src="${escapeHtml(getHeadshot(p))}" alt="">
        <div class="info">
          <div class="pname">${escapeHtml(p.name)}</div>
          <div class="pteam">${escapeHtml(p.teamAbbrev)} · И: ${p.gamesPlayed ?? "—"}</div>
        </div>
        <div class="pvalue">${p.value}</div>
      </div>
    `).join("");

    games.insertAdjacentHTML("beforeend", html);
  } catch (_) {}
}

/* ============================================================
   5. ТУРНИРНАЯ ТАБЛИЦА (STANDINGS)
   ============================================================ */
async function buildSeasonOptions() {
  const sel = document.getElementById("season-select");
  if (!sel) return;
  try {
    const data = await fetchAPI("/api/seasons-list");
    const seasons = Array.isArray(data) ? data : (data?.seasons || []);
    let html = "<option value=''>Текущий сезон</option>";
    [...seasons].sort((a, b) => (b.id || 0) - (a.id || 0)).forEach(s => {
      const id = String(s.id || "");
      if (id.length >= 8) {
        html += `<option value="${escapeHtml(s.standingsEnd || "")}">${id.slice(0, 4)}-${id.slice(6, 8)}</option>`;
      }
    });
    sel.innerHTML = html;
  } catch (_) {
    sel.innerHTML = "<option value=''>Текущий сезон</option>";
  }
}

function renderTeamRow(team, rank) {
  const abbrev = getTeamAbbrev(team.teamAbbrev || team.abbrev || team.team);
  const teamFullName = NHL_TEAMS_FULL[abbrev] || getTeamName(team.teamName || team.name) || abbrev;
  const logoSrc = getSafeTeamLogoUrl(abbrev, team.logo || team.teamLogo);
  const diff = Number(team.goalDifferential ?? ((team.goalFor ?? 0) - (team.goalAgainst ?? 0)));

  const gp = team.gamesPlayed ?? 0;
  const pts = team.points ?? 0;
  const ptPct = team.pointPctg ?? (gp > 0 ? pts / (gp * 2) : 0);
  const ptPctFormatted = formatPctCell(ptPct);

  return `
    <div class="standings-row" onclick="openTeamDetail('${escapeHtml(abbrev)}', '${escapeHtml(teamFullName)}', '${logoSrc}')">
      <div class="num sticky-col sticky-col-1">${rank}</div>
      <div class="sticky-col sticky-col-2">
        <img class="team-logo" src="${escapeHtml(logoSrc)}" alt="" onerror="this.onerror=null; this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(abbrev)}_dark.svg';">
      </div>
      <div class="name sticky-col sticky-col-3">${escapeHtml(abbrev)}</div>
      <div class="num">${gp}</div>
      <div class="num">${team.wins ?? 0}</div>
      <div class="num">${team.otLosses ?? 0}</div>
      <div class="num">${team.losses ?? 0}</div>
      <div class="num">${team.goalFor ?? 0}</div>
      <div class="num">${team.goalAgainst ?? 0}</div>
      <div class="diff" style="color:${diff >= 0 ? '#2ecc71' : '#e74c3c'}">${diff > 0 ? '+' : ''}${diff}</div>
      <div class="pts">${pts}</div>
      <div class="num" style="color:#ffffff !important;font-weight:700;">${ptPctFormatted}</div>
      <div class="num">${formatPctCell(team.powerPlayPctg)}</div>
      <div class="num">${formatPctCell(team.penaltyKillPctg)}</div>
      <div class="num">${formatPctCell(team.faceoffWinPct)}</div>
      <div class="num">${team.shotsForPerGame ? Number(team.shotsForPerGame).toFixed(1) : "—"}</div>
      <div class="num">${team.shotsAgainstPerGame ? Number(team.shotsAgainstPerGame).toFixed(1) : "—"}</div>
    </div>
  `;
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    let va = a[standingsSortKey] ?? 0;
    let vb = b[standingsSortKey] ?? 0;
    if (standingsSortKey === "goalDifferential") {
      va = a.goalDifferential ?? ((a.goalFor ?? 0) - (a.goalAgainst ?? 0));
      vb = b.goalDifferential ?? ((b.goalFor ?? 0) - (b.goalAgainst ?? 0));
    }
    return standingsSortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });
}

function renderStandings() {
  const body = document.getElementById("standings-body");
  if (!body) return;
  if (!currentStandingsData.length) {
    body.innerHTML = '<div class="empty">Нет данных таблицы</div>';
    return;
  }

  let html = "";
  if (standingsViewMode === "all") {
    html = sortTeams(currentStandingsData).map((t, i) => renderTeamRow(t, i + 1)).join("");
  } else {
    const field = standingsViewMode === "conf" ? "conferenceName" : "divisionName";
    const groups = {};
    currentStandingsData.forEach(t => {
      const g = nameStr(t[field]) || "Конференция / Дивизион";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });

    Object.keys(groups).sort().forEach(gName => {
      html += `<div class="group-header-row"><div>${escapeHtml(gName)}</div></div>`;
      html += sortTeams(groups[gName]).map((t, i) => renderTeamRow(t, i + 1)).join("");
    });
  }

  body.innerHTML = html;
}

async function loadStandings() {
  const body = document.getElementById("standings-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка таблицы...</div>';

  try {
    let standingsUrl = "/api/standings";
    if (selectedSeasonEndDate && selectedSeasonEndDate.trim() !== "") {
      standingsUrl = `/api/standings-by-date/${encodeURIComponent(selectedSeasonEndDate)}`;
    }

    const seasonId = seasonIdFromEndDate(selectedSeasonEndDate);
    const specialTeamsUrl = seasonId ? `/api/team-special-teams?season=${seasonId}` : `/api/team-special-teams`;

    const [data, specialData] = await Promise.all([
      fetchAPI(standingsUrl).catch(() => null),
      fetchAPI(specialTeamsUrl).catch(() => null)
    ]);

    const rawStandings = Array.isArray(data) ? data : (data?.standings || []);
    if (!rawStandings.length) {
      if (body) body.innerHTML = '<div class="empty">Таблица формируется...</div>';
      return;
    }

    const specialMap = new Map();
    const specialTeams = Array.isArray(specialData?.teams) ? specialData.teams : [];
    specialTeams.forEach(r => {
      const ab = getTeamAbbrev(r.teamAbbrev || r.team);
      if (ab) specialMap.set(ab, r);
    });

    currentStandingsData = rawStandings.map(t => {
      const ab = getTeamAbbrev(t.teamAbbrev || t.abbrev || t.team);
      const sp = specialMap.get(ab) || {};
      return {
        ...t,
        teamAbbrev: ab,
        powerPlayPctg: sp.powerPlayPctg ?? sp.powerPlayPct ?? t.powerPlayPctg,
        penaltyKillPctg: sp.penaltyKillPctg ?? sp.penaltyKillPct ?? t.penaltyKillPctg,
        faceoffWinPct: sp.faceoffWinPct ?? t.faceoffWinPct,
        shotsForPerGame: sp.shotsForPerGame ?? t.shotsForPerGame,
        shotsAgainstPerGame: sp.shotsAgainstPerGame ?? t.shotsAgainstPerGame
      };
    });

    renderStandings();
  } catch (err) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить таблицу.</div>';
  }
}

async function loadAdvancedStandings() {
  const body = document.getElementById("advanced-standings-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка продвинутой статистики...</div>';
  try {
    const seasonId = seasonIdFromEndDate(selectedSeasonEndDate);
    const query = seasonId ? `?season=${seasonId}` : "";
    const data = await fetchAPI(`/api/advanced-team-stats${query}`);
    currentAdvancedTeamsData = Array.isArray(data?.teams) ? data.teams : (Array.isArray(data) ? data : []);
    renderAdvancedStandings();
  } catch (_) {
    if (body) body.innerHTML = '<div class="empty">Продвинутая статистика временно недоступна</div>';
  }
}

function renderAdvancedStandings() {
  const body = document.getElementById("advanced-standings-body");
  if (!body) return;
  if (!currentAdvancedTeamsData.length) {
    body.innerHTML = '<div class="empty">Нет данных продвинутой статистики</div>';
    return;
  }

  const regMap = new Map();
  currentStandingsData.forEach(t => regMap.set(getTeamAbbrev(t.teamAbbrev || t.abbrev), t));

  const sorted = [...currentAdvancedTeamsData].sort((a, b) => {
    const va = Number(a[advStandingsSortKey] ?? 0);
    const vb = Number(b[advStandingsSortKey] ?? 0);
    return advStandingsSortAsc ? va - vb : vb - va;
  });

  body.innerHTML = sorted.map((t, idx) => {
    const reg = regMap.get(t.teamAbbrev) || {};
    const gp = reg.gamesPlayed ?? t.gamesPlayed ?? 0;
    const rw = Number(reg.regulationWins ?? reg.wins ?? 0);
    const rpo = Number(reg.regulationPlusOtWins ?? rw);
    const otWins = Math.max(0, rpo - rw);
    const soWins = Number(reg.shootoutWins ?? 0);
    const losses = Number(reg.losses ?? 0);
    const soLosses = Number(reg.shootoutLosses ?? 0);
    const otLosses = Math.max(0, Number(reg.otLosses ?? 0) - soLosses);
    const fullTeam = NHL_TEAMS_FULL[t.teamAbbrev] || t.teamAbbrev;

    return `
      <div class="standings-row" onclick="openTeamDetail('${escapeHtml(t.teamAbbrev)}', '${escapeHtml(fullTeam)}', '')">
        <div class="num sticky-col sticky-col-1">${idx + 1}</div>
        <div class="sticky-col sticky-col-2"><img class="team-logo" src="${escapeHtml(getSafeTeamLogoUrl(t.teamAbbrev))}"></div>
        <div class="name sticky-col sticky-col-3">${escapeHtml(t.teamAbbrev)}</div>
        <div class="num">${gp}</div>
        <div class="num" style="color:#2ecc71;font-weight:700;">${rw}</div>
        <div class="num">${otWins}</div>
        <div class="num">${soWins}</div>
        <div class="num" style="color:#e74c3c;font-weight:700;">${losses}</div>
        <div class="num">${otLosses}</div>
        <div class="num">${soLosses}</div>
        <div class="num" style="color:${t.satPct >= 50 ? '#2ecc71' : '#ff4d4d'};font-weight:700;">${t.satPct}%</div>
        <div class="num">${t.usatPct}%</div>
        <div class="num">${t.pdo}</div>
        <div class="num">${t.ozsp}%</div>
      </div>
    `;
  }).join("");
}

function setStandingsMode(mode) {
  standingsViewMode = mode;
  document.getElementById("std-mode-all")?.classList.toggle("active", mode === "all");
  document.getElementById("std-mode-conf")?.classList.toggle("active", mode === "conf");
  document.getElementById("std-mode-div")?.classList.toggle("active", mode === "div");
  document.getElementById("std-mode-adv")?.classList.toggle("active", mode === "adv");

  const regTable = document.getElementById("standings-table-regular");
  const advTable = document.getElementById("standings-table-advanced");

  if (mode === "adv") {
    if (regTable) regTable.style.display = "none";
    if (advTable) advTable.style.display = "grid";
    currentAdvancedTeamsData.length ? renderAdvancedStandings() : loadAdvancedStandings();
  } else {
    if (advTable) advTable.style.display = "none";
    if (regTable) regTable.style.display = "grid";
    currentStandingsData.length ? renderStandings() : loadStandings();
  }
}

/* ============================================================
   6. ЛИДЕРЫ (LEADERS)
   ============================================================ */
async function loadPlayers() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка лидеров...</div>';

  try {
    let query = `/api/leaders/${encodeURIComponent(currentCat)}?limit=50`;
    if (skaterRookieOnly) query += `&isRookie=true&cayenneExp=isRookie=1`;
    if (skaterPositionFilter && skaterPositionFilter !== "ALL") query += `&positionCode=${skaterPositionFilter}`;

    let data = null;
    try {
      data = await fetchAPI(query);
    } catch (_) {
      const res = await fetch(`${API_BASE}${query}`);
      if (res.ok) data = await res.json();
    }

    let list = data?.[currentCat] || data?.data || data?.skaters || data?.leaders || [];

    if (skaterPositionFilter && skaterPositionFilter !== "ALL" && list.length > 0) {
      const targetPos = skaterPositionFilter.toUpperCase();
      const posFiltered = list.filter(p => {
        const pos = (p.positionCode || p.position || p.player?.positionCode || "").toUpperCase();
        if (!pos) return true;
        return targetPos === "D" ? pos === "D" : pos !== "D";
      });
      if (posFiltered.length > 0) list = posFiltered;
    }

    if (skaterRookieOnly && list.length > 0) {
      const rookieFiltered = list.filter(p => p.isRookie === true || p.rookie === true || p.player?.isRookie === true);
      if (rookieFiltered.length > 0) list = rookieFiltered;
    }

    list = list.slice(0, currentLimit);

    if (!list.length) {
      if (body) body.innerHTML = '<div class="empty">Нет данных лидеров по выбранным фильтрам</div>';
      return;
    }

    body.innerHTML = list.map((p, i) => {
      let valToShow = p.value ?? p[currentCat] ?? "—";
      if (currentCat === "plusMinus" && Number(valToShow) > 0) valToShow = `+${valToShow}`;

      const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team || p.player?.teamTriCode);
      const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
      const gp = p.gamesPlayed ?? p.gp ?? p.player?.gamesPlayed ?? "—";
      const pName = p.name || p.playerFullName || p.player?.fullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
      const pId = getPlayerId(p) || p.player?.id || "";

      return `
        <div class="player-row" onclick="openPlayerDetail('${pId}')">
          <div class="rank">${i + 1}</div>
          <img class="headshot" src="${escapeHtml(getHeadshot(p))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="info">
            <div class="pname">${escapeHtml(pName)}</div>
            <div class="pteam">
              <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(cleanTeam)}_light.svg" style="width:16px;height:16px;" onerror="this.style.display='none'">
              <span>${escapeHtml(cleanTeam)}</span>
            </div>
          </div>
          <div class="pgames">${gp}</div>
          <div class="pvalue">${escapeHtml(valToShow)}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить лидеров. Повторите попытку позже.</div>';
  }
}

async function loadGoalieCards() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка вратарей...</div>';
  try {
    const data = await fetchAPI("/api/goalie-leaders?limit=100");
    cachedGoaliesList = data.goalies || data.wins || data.data || [];
    renderGoaliesFromCache();
  } catch (err) {
    if (body) body.innerHTML = '<div class="empty">Не удалось загрузить вратарей. Повторите попытку позже.</div>';
  }
}

function renderGoaliesFromCache() {
  const body = document.getElementById("players-body");
  if (!body) return;
  if (!cachedGoaliesList.length) {
    body.innerHTML = '<div class="empty">Нет данных вратарей</div>';
    return;
  }

  let rows = [...cachedGoaliesList];
  if (goalieMinGames) rows = rows.filter(g => (g.gamesPlayed || 0) >= 5);

  rows.sort((a, b) => {
    const ascDefault = (currentGoalieSortKey === "gaa" || currentGoalieSortKey === "losses");
    let va = Number(a[currentGoalieSortKey] ?? (ascDefault ? Infinity : -Infinity));
    let vb = Number(b[currentGoalieSortKey] ?? (ascDefault ? Infinity : -Infinity));
    return currentGoalieSortAsc ? va - vb : vb - va;
  });

  body.innerHTML = rows.map((p, i) => {
    const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
    const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
    const gp = p.gamesPlayed ?? p.gp ?? "—";
    const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    const pId = getPlayerId(p);

    let valToShow = p[currentGoalieSortKey] ?? "—";
    if (currentGoalieSortKey === "savePctg" && typeof valToShow === "number") valToShow = valToShow.toFixed(3);
    if (currentGoalieSortKey === "gaa" && typeof valToShow === "number") valToShow = valToShow.toFixed(2);

    return `
      <div class="player-row" onclick="openPlayerDetail('${pId}')">
        <div class="rank">${i + 1}</div>
        <img class="headshot" src="${escapeHtml(getHeadshot(p))}" alt="" onerror="this.style.visibility='hidden'">
        <div class="info">
          <div class="pname">${escapeHtml(pName)}</div>
          <div class="pteam">
            <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(cleanTeam)}_light.svg" style="width:16px;height:16px;" onerror="this.style.display='none'">
            <span>${escapeHtml(cleanTeam)}</span>
          </div>
        </div>
        <div class="pgames">${gp}</div>
        <div class="pvalue">${escapeHtml(valToShow)}</div>
      </div>
    `;
  }).join("");
}

/* ============================================================
   7. ДРАФТ (DRAFT)
   ============================================================ */
function buildDraftYearOptions() {
  const sel = document.getElementById("draft-year-select");
  if (!sel) return;
  if (sel.children.length === 0) {
    let html = "";
    for (let y = 2024; y >= 1963; y--) {
      html += `<option value="${y}" ${String(y) === String(currentDraftYear) ? "selected" : ""}>${y}</option>`;
    }
    sel.innerHTML = html;
  }
  if (currentDraftYear) sel.value = currentDraftYear;
}

async function loadDraft(year) {
  buildDraftYearOptions();
  const container = document.getElementById("draft-rounds-list");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка драфта НХЛ...</div>';

  const targetYear = year || currentDraftYear || "2024";
  currentDraftYear = targetYear;

  const sel = document.getElementById("draft-year-select");
  if (sel) sel.value = targetYear;

  try {
    const data = await fetchAPI(`/api/draft/${targetYear}`);
    let picks = [];
    if (Array.isArray(data?.picks)) picks = data.picks;
    else if (Array.isArray(data?.rounds)) {
      data.rounds.forEach(r => { if (Array.isArray(r.picks)) picks.push(...r.picks); });
    } else if (Array.isArray(data)) picks = data;

    if (!picks.length) {
      container.innerHTML = `<div class="empty">Данные по драфту ${targetYear} года ещё не опубликованы лигой</div>`;
      return;
    }

    const rounds = {};
    picks.forEach(p => {
      const r = p.round || p.roundNumber || 1;
      if (!rounds[r]) rounds[r] = [];
      rounds[r].push(p);
    });

    let html = "";
    Object.keys(rounds).sort((a, b) => Number(a) - Number(b)).forEach(roundNum => {
      html += `<div class="draft-round-title">Раунд ${roundNum}</div>`;
      rounds[roundNum].forEach(pick => {
        const rawAbbr = pick.teamAbbrev?.default || pick.teamAbbrev || pick.triCode || pick.team || "";
        const teamAbbrev = getTeamAbbrev(rawAbbr);
        const logo = getSafeTeamLogoUrl(teamAbbrev, pick.teamLogo || pick.teamLogoLight);

        let name = pick.playerName || "";
        if (!name) {
          const fName = pick.firstName?.default || pick.firstName || pick.playerFirstName || "";
          const lName = pick.lastName?.default || pick.lastName || pick.playerLastName || "";
          name = `${fName} ${lName}`.trim() || "Игрок";
        }

        const pos = pick.positionCode || pick.position || "";
        const amateurClub = pick.amateurClubName?.default || pick.amateurClubName || pick.lastAmateurClub || "";
        const amateurLeague = pick.amateurLeague?.default || pick.amateurLeague || pick.lastAmateurLeague || "";
        const amateur = [amateurClub, amateurLeague].filter(Boolean).join(" · ") || "Юниоры";

        let height = "";
        if (pick.heightInCentimeters) height = `${pick.heightInCentimeters} см`;
        else if (pick.heightInInches || pick.height) height = `${Math.round((pick.heightInInches || pick.height) * 2.54)} см`;

        let weight = "";
        if (pick.weightInKilograms) weight = `${pick.weightInKilograms} кг`;
        else if (pick.weightInPounds || pick.weight) weight = `${Math.round((pick.weightInPounds || pick.weight) * 0.453592)} кг`;

        const meta = [pos, amateur, height, weight].filter(Boolean).join(" · ");
        const pId = pick.playerId ? String(pick.playerId) : "";
        const overall = pick.overallPick || pick.overallPickNumber || pick.pick || "—";

        const fallbackJson = encodeURIComponent(JSON.stringify({
          fullName: name, teamAbbrev, position: pos, height, weight,
          draft: `${targetYear} г., раунд ${roundNum}, №${overall}`
        }));

        html += `
          <div class="draft-pick-card" onclick="openPlayerDetail('${pId}', '${fallbackJson}')" style="cursor:pointer;">
            <div class="draft-pick-num">#${overall}</div>
            <img class="draft-team-logo" src="${escapeHtml(logo)}" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/nhl_light.svg'">
            <div class="draft-player-info">
              <div class="draft-player-name">${escapeHtml(name)}</div>
              <div class="draft-player-meta">${escapeHtml(meta)}</div>
            </div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty">Не удалось загрузить драфт ${targetYear} года</div>`;
  }
}

/* ============================================================
   8. КОМАНДА (TEAM DETAIL)
   ============================================================ */
let currentTeamSkaters = [];
let currentTeamGoalies = [];
let teamSkaterSortKey = "points";
let teamSkaterSortAsc = false;
let teamGoalieSortKey = "gamesPlayed";
let teamGoalieSortAsc = false;

function renderTeamTablesHTML() {
  const container = document.getElementById("team-tables-container");
  if (!container) return;

  const sortedSkaters = [...currentTeamSkaters].sort((a, b) => {
    const va = Number(a[teamSkaterSortKey] ?? 0);
    const vb = Number(b[teamSkaterSortKey] ?? 0);
    return teamSkaterSortAsc ? va - vb : vb - va;
  });

  const sortedGoalies = [...currentTeamGoalies].sort((a, b) => {
    const va = Number(a[teamGoalieSortKey] ?? 0);
    const vb = Number(b[teamGoalieSortKey] ?? 0);
    return teamGoalieSortAsc ? va - vb : vb - va;
  });

  let html = `
    <div class="section-title">Полевые игроки</div>
    <div class="table-scroll">
      <table class="stat-table">
        <thead>
          <tr>
            <th>Игрок</th>
            <th class="sortable" onclick="sortTeamSkaters('gamesPlayed')">И</th>
            <th class="sortable" onclick="sortTeamSkaters('goals')">Г</th>
            <th class="sortable" onclick="sortTeamSkaters('assists')">П</th>
            <th class="sortable" onclick="sortTeamSkaters('points')">О</th>
            <th class="sortable" onclick="sortTeamSkaters('plusMinus')">+/-</th>
            <th class="sortable" onclick="sortTeamSkaters('penaltyMinutes')">Штр</th>
          </tr>
        </thead>
        <tbody>
          ${sortedSkaters.map(p => `
            <tr class="clickable-row" onclick="openPlayerDetail('${getPlayerId(p)}')">
              <td>${escapeHtml(p.name || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`)}</td>
              <td>${val(p.gamesPlayed, 0)}</td>
              <td>${val(p.goals, 0)}</td>
              <td>${val(p.assists, 0)}</td>
              <td style="color:#fff;font-weight:700;">${val(p.points, 0)}</td>
              <td>${val(p.plusMinus, 0)}</td>
              <td>${val(p.penaltyMinutes ?? p.pim, 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (sortedGoalies.length > 0) {
    html += `
      <div class="section-title" style="margin-top:20px;">Вратари</div>
      <div class="table-scroll">
        <table class="stat-table">
          <thead>
            <tr>
              <th>Игрок</th>
              <th class="sortable" onclick="sortTeamGoalies('gamesPlayed')">И</th>
              <th class="sortable" onclick="sortTeamGoalies('wins')">В</th>
              <th class="sortable" onclick="sortTeamGoalies('losses')">П</th>
              <th class="sortable" onclick="sortTeamGoalies('savePctg')">%ОБ</th>
              <th class="sortable" onclick="sortTeamGoalies('gaa')">ГКИ</th>
              <th class="sortable" onclick="sortTeamGoalies('shutouts')">СУХ</th>
            </tr>
          </thead>
          <tbody>
            ${sortedGoalies.map(g => {
              const sv = g.savePercentage ?? g.savePctg;
              const gaa = g.goalsAgainstAverage ?? g.gaa;
              return `
                <tr class="clickable-row" onclick="openPlayerDetail('${getPlayerId(g)}')">
                  <td>${escapeHtml(g.name || `${nameStr(g.firstName)} ${nameStr(g.lastName)}`)}</td>
                  <td>${val(g.gamesPlayed, 0)}</td>
                  <td>${val(g.wins, 0)}</td>
                  <td>${val(g.losses, 0)}</td>
                  <td style="color:#fff;font-weight:700;">${typeof sv === "number" ? sv.toFixed(3) : val(sv)}</td>
                  <td>${typeof gaa === "number" ? gaa.toFixed(2) : val(gaa)}</td>
                  <td>${val(g.shutouts, 0)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
}

function sortTeamSkaters(key) {
  if (teamSkaterSortKey === key) teamSkaterSortAsc = !teamSkaterSortAsc;
  else { teamSkaterSortKey = key; teamSkaterSortAsc = false; }
  renderTeamTablesHTML();
}

function sortTeamGoalies(key) {
  if (teamGoalieSortKey === key) teamGoalieSortAsc = !teamGoalieSortAsc;
  else { teamGoalieSortKey = key; teamGoalieSortAsc = (key === "gaa"); }
  renderTeamTablesHTML();
}

async function openTeamDetail(teamAbbrev, teamName, teamLogo) {
  const abbrev = getTeamAbbrev(teamAbbrev);
  const fullName = NHL_TEAMS_FULL[abbrev] || (teamName && teamName !== abbrev ? teamName : abbrev);

  pushScreenHistory(() => openTeamDetail(abbrev, fullName, teamLogo));
  openDetail();
  const body = document.getElementById("detail-body");
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(abbrev)}_light.svg" style="width:52px;height:52px;object-fit:contain;">
      <div>
        <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;line-height:1.2;">${escapeHtml(fullName)}</div>
        <div style="font-size:12px;color:var(--silver-dim);font-family:'Roboto Mono',monospace;margin-top:2px;">${escapeHtml(abbrev)}</div>
      </div>
    </div>
    <div id="team-tables-container"><div class="loading">Загрузка состава команды...</div></div>
  `;

  try {
    const data = await fetchAPI(`/api/roster-stats/${encodeURIComponent(abbrev)}`);
    currentTeamSkaters = data?.skaters || data?.regular?.skaters || [];
    currentTeamGoalies = data?.goalies || data?.regular?.goalies || [];
    renderTeamTablesHTML();
  } catch (_) {
    const c = document.getElementById("team-tables-container");
    if (c) c.innerHTML = '<div class="empty">Не удалось загрузить состав</div>';
  }
}

/* ============================================================
   9. ДОСЬЕ ИГРОКА (PLAYER DETAIL)
   ============================================================ */
async function openPlayerDetail(playerId, fallbackDataStr = null) {
  pushScreenHistory(() => openPlayerDetail(playerId, fallbackDataStr));
  openDetail();
  const body = document.getElementById("detail-body");
  if (!body) return;
  body.innerHTML = '<div class="loading">Загрузка досье игрока...</div>';

  let fallback = null;
  if (fallbackDataStr) {
    try { fallback = JSON.parse(decodeURIComponent(fallbackDataStr)); } catch (_) {}
  }

  try {
    let p = null;
    if (playerId && playerId !== "0" && playerId !== "null" && playerId !== "undefined") {
      const directUrl = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/landing`;
      const candidateUrls = [
        `${API_BASE}/api/player/${encodeURIComponent(playerId)}`,
        `${API_BASE}/v1/player/${encodeURIComponent(playerId)}/landing`,
        directUrl,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`
      ];

      for (const u of candidateUrls) {
        try {
          const res = await fetch(u);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().startsWith("{")) {
              p = JSON.parse(text);
              if (p && (p.playerId || p.firstName)) break;
            }
          }
        } catch (_) {}
      }
    }

    if (!p) {
      if (fallback) {
        body.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
            <img src="https://assets.nhle.com/mugs/nhl/default-player.png" style="width:62px;height:62px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:2px solid var(--border);">
            <div>
              <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;line-height:1.2;">${escapeHtml(fallback.fullName || "Хоккеист")}</div>
              <div style="font-size:12px;color:var(--silver-dim);margin-top:2px;">${escapeHtml(fallback.teamAbbrev || "")} · ${escapeHtml(fallback.position || "Проспект")}</div>
            </div>
          </div>
          <div class="section-title">Информация о проспекте</div>
          <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:14px;">
            <div><span style="color:var(--silver-dim);">Рост / Вес:</span> <strong>${fallback.height || '—'} / ${fallback.weight || '—'}</strong></div>
            <div><span style="color:var(--silver-dim);">Клуб НХЛ:</span> <strong>${escapeHtml(fallback.teamAbbrev || "—")}</strong></div>
            <div style="grid-column:1/-1;"><span style="color:var(--silver-dim);">Драфт:</span> <strong>${escapeHtml(fallback.draft || "Выбран на драфте")}</strong></div>
          </div>
          <div class="empty">Игрок ещё не дебютировал в официальных матчах регулярного сезона НХЛ.</div>
        `;
        return;
      }
      throw new Error("Игрок не найден");
    }

    const fullName = p.fullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    const pos = p.positionCode || p.position || "";
    const isGoalie = (pos === "G");

    let draftText = "На драфте не выбран";
    if (p.draftDetails) {
      const d = p.draftDetails;
      draftText = `${d.year} г. («${d.teamAbbrev || ""}», раунд ${d.round}, №${d.overallPick})`;
    }

    let html = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <img src="${escapeHtml(p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png`)}" style="width:62px;height:62px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:2px solid var(--border);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div>
          <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;line-height:1.2;">${escapeHtml(fullName)}</div>
          <div style="font-size:12px;color:var(--silver-dim);margin-top:2px;">${escapeHtml(p.teamAbbrev || "")} · №${escapeHtml(val(p.sweaterNumber))} · ${escapeHtml(pos)}</div>
        </div>
      </div>

      <div class="section-title">Личные данные</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:14px;">
        <div><span style="color:var(--silver-dim);">Рождение:</span> <strong>${val(p.birthDate)}</strong></div>
        <div><span style="color:var(--silver-dim);">Страна:</span> <strong>${val(p.birthCountry)}</strong></div>
        <div><span style="color:var(--silver-dim);">Рост / Вес:</span> <strong>${p.heightInCentimeters ? p.heightInCentimeters + ' см' : '—'} / ${p.weightInKilograms ? p.weightInKilograms + ' кг' : '—'}</strong></div>
        <div><span style="color:var(--silver-dim);">Хват:</span> <strong>${val(p.shootsCatches)}</strong></div>
        <div style="grid-column:1/-1;"><span style="color:var(--silver-dim);">Драфт:</span> <strong>${escapeHtml(draftText)}</strong></div>
      </div>
    `;

    const history = Array.isArray(p.seasonTotals) ? p.seasonTotals : [];
    if (history.length > 0) {
      const regSeasons = history.filter(s => s.gameTypeId === 2);
      const poSeasons = history.filter(s => s.gameTypeId === 3);

      html += `<div class="section-title">История игровой карьеры</div><div class="table-scroll"><table class="stat-table"><thead><tr><th>Сезон</th><th>Лига</th><th>Клуб</th><th>И</th>${isGoalie ? '<th>В</th><th>П</th><th>%ОБ</th><th>ГКИ</th>' : '<th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th>'}</tr></thead><tbody>`;

      if (regSeasons.length > 0) {
        html += `<tr class="playoff-header-row"><td colspan="${isGoalie ? 8 : 9}">Регулярные чемпионаты</td></tr>`;
        regSeasons.forEach(s => {
          const sName = String(s.season || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
          const league = s.leagueAbbrev || "Лига";
          const team = s.teamName?.default || s.teamName || s.teamAbbrev || "—";
          const isNHL = (league === "NHL");

          html += `
            <tr style="${isNHL ? 'background:rgba(31,95,206,0.08);' : ''}">
              <td style="${isNHL ? 'font-weight:700;color:#fff;' : ''}">${escapeHtml(sName)}</td>
              <td><span style="padding:1px 5px;border-radius:4px;font-size:10px;background:var(--surface-2);color:${isNHL ? '#29b6f6' : 'var(--silver-dim)'};font-weight:700;">${escapeHtml(league)}</span></td>
              <td>${escapeHtml(team)}</td>
              <td class="num">${val(s.gamesPlayed, 0)}</td>
              ${isGoalie ? `
                <td class="num">${val(s.wins, 0)}</td>
                <td class="num">${val(s.losses, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${typeof (s.savePctg ?? s.savePercentage) === "number" ? Number(s.savePctg ?? s.savePercentage).toFixed(3) : "—"}</td>
                <td class="num">${typeof (s.goalsAgainstAverage ?? s.gaa) === "number" ? Number(s.goalsAgainstAverage ?? s.gaa).toFixed(2) : "—"}</td>
              ` : `
                <td class="num">${val(s.goals, 0)}</td>
                <td class="num">${val(s.assists, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${val(s.points, 0)}</td>
                <td class="num">${val(s.plusMinus, 0)}</td>
                <td class="num">${val(s.pim ?? s.penaltyMinutes, 0)}</td>
              `}
            </tr>
          `;
        });
      }

      if (poSeasons.length > 0) {
        html += `<tr class="playoff-header-row playoff-border"><td colspan="${isGoalie ? 8 : 9}">Плей-офф</td></tr>`;
        poSeasons.forEach(s => {
          const sName = String(s.season || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
          const league = s.leagueAbbrev || "Лига";
          const team = s.teamName?.default || s.teamName || s.teamAbbrev || "—";
          const isNHL = (league === "NHL");

          html += `
            <tr style="${isNHL ? 'background:rgba(31,95,206,0.08);' : ''}">
              <td style="${isNHL ? 'font-weight:700;color:#fff;' : ''}">${escapeHtml(sName)}</td>
              <td><span style="padding:1px 5px;border-radius:4px;font-size:10px;background:var(--surface-2);color:${isNHL ? '#29b6f6' : 'var(--silver-dim)'};font-weight:700;">${escapeHtml(league)}</span></td>
              <td>${escapeHtml(team)}</td>
              <td class="num">${val(s.gamesPlayed, 0)}</td>
              ${isGoalie ? `
                <td class="num">${val(s.wins, 0)}</td>
                <td class="num">${val(s.losses, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${typeof (s.savePctg ?? s.savePercentage) === "number" ? Number(s.savePctg ?? s.savePercentage).toFixed(3) : "—"}</td>
                <td class="num">${typeof (s.goalsAgainstAverage ?? s.gaa) === "number" ? Number(s.goalsAgainstAverage ?? s.gaa).toFixed(2) : "—"}</td>
              ` : `
                <td class="num">${val(s.goals, 0)}</td>
                <td class="num">${val(s.assists, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${val(s.points, 0)}</td>
                <td class="num">${val(s.plusMinus, 0)}</td>
                <td class="num">${val(s.pim ?? s.penaltyMinutes, 0)}</td>
              `}
            </tr>
          `;
        });
      }

      html += `</tbody></table></div>`;
    }

    body.innerHTML = html;
  } catch (_) {
    body.innerHTML = '<div class="empty">Не удалось загрузить карточку игрока</div>';
  }
}

/* ============================================================
   10. НОВОСТИ И ТРАНСФЕРЫ (NEWS & TRANSACTIONS)
   ============================================================ */
window.openPostInTelegram = function(url) {
  if (!url) return;
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
};

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

      desc = desc.replace(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, (match) => {
        if (EXCLUDE_WORDS.includes(match)) return match;
        return `<span class="player-tx-link" onclick="searchAndOpenPlayer('${match}')">${match}</span>`;
      });

      return `
        <div class="tx-item">
          <div class="tx-date">${escapeHtml(cleanDate)} · <span class="tx-team">${escapeHtml(t.team)}</span></div>
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
    const data = await fetchAPI("/api/news");
    const list = data.news || [];
    if (!list.length) {
      container.innerHTML = '<div class="empty">Новостей пока нет</div>';
      return;
    }
    container.innerHTML = list.map(item => {
      let imgSrc = item.image || "";
      if (!imgSrc && item.photo_id) {
        imgSrc = `https://nhl-miniapp.onrender.com/api/news/photo/${encodeURIComponent(item.photo_id)}`;
      }
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

/* ============================================================
   11. НАВИГАЦИЯ И ИНИЦИАЛИЗАЦИЯ (APP INIT)
   ============================================================ */
function switchTab(tab) {
  stopAllVideos();
  const backBtn = document.getElementById("header-back-btn");
  if (backBtn) backBtn.style.display = "none";
  navHistory = [];
  lastMainTab = tab;

  ["schedule", "standings", "players", "transactions", "draft", "news"].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle("active", tab === t);
    const view = document.getElementById(`view-${t}`);
    if (view) view.style.display = (tab === t) ? "" : "none";
  });

  const detailView = document.getElementById("view-detail");
  if (detailView) detailView.style.display = "none";
  const mainNav = document.getElementById("main-nav");
  if (mainNav) mainNav.style.display = "grid";

  if (tab === "schedule") loadSchedule();
  if (tab === "standings") loadStandings();
  if (tab === "players") loadPlayers();
  if (tab === "transactions") loadTransactions();
  if (tab === "draft") loadDraft(currentDraftYear);
  if (tab === "news") loadNews();
}

function renderTeamSelectorModal() {
  const grid = document.getElementById("team-selector-grid");
  if (!grid) return;
  const teams = Object.keys(TEAM_COLORS).sort();

  grid.innerHTML = teams.map(abbr => `
    <button class="pickem-btn ${myFavoriteTeam === abbr ? 'selected' : ''}" data-choose-team="${abbr}" style="padding:10px 4px;display:flex;flex-direction:column;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg" alt="" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg';">
      <span style="margin-top:4px;font-family:'Oswald',sans-serif;font-size:12px;color:var(--silver);">${abbr}</span>
    </button>
  `).join("");

  grid.querySelectorAll("button[data-choose-team]").forEach(btn => {
    btn.onclick = () => {
      const chosen = btn.dataset.chooseTeam;
      myFavoriteTeam = (myFavoriteTeam === chosen) ? "" : chosen;
      try {
        if (myFavoriteTeam) localStorage.setItem("nhl_my_team", myFavoriteTeam);
        else localStorage.removeItem("nhl_my_team");
      } catch (_) {}
      updateMyTeamButton();
      const modal = document.getElementById("my-team-modal");
      if (modal) modal.style.display = "none";
      if (lastMainTab === "schedule") loadSchedule();
    };
  });
}

function setupEventListeners() {
  document.getElementById("header-back-btn")?.addEventListener("click", handleGoBack);

  document.getElementById("prev-day")?.addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadSchedule();
  });
  document.getElementById("next-day")?.addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadSchedule();
  });
  document.getElementById("date-picker")?.addEventListener("change", e => {
    if (e.target.value) {
      currentDate = new Date(`${e.target.value}T12:00:00`);
      loadSchedule();
    }
  });

  document.getElementById("tab-schedule")?.addEventListener("click", () => switchTab("schedule"));
  document.getElementById("tab-standings")?.addEventListener("click", () => switchTab("standings"));
  document.getElementById("tab-players")?.addEventListener("click", () => switchTab("players"));
  document.getElementById("tab-transactions")?.addEventListener("click", () => switchTab("transactions"));
  document.getElementById("tab-draft")?.addEventListener("click", () => switchTab("draft"));
  document.getElementById("tab-news")?.addEventListener("click", () => switchTab("news"));

  document.getElementById("leaders-skaters-btn")?.addEventListener("click", () => {
    leadersMode = "skaters";
    document.getElementById("leaders-skaters-btn")?.classList.add("active");
    document.getElementById("leaders-goalies-btn")?.classList.remove("active");
    const sc = document.getElementById("skater-categories"); if (sc) sc.style.display = "grid";
    const sf = document.getElementById("skater-filters-bar"); if (sf) sf.style.display = "flex";
    const gc = document.getElementById("goalie-categories"); if (gc) gc.style.display = "none";
    const gf = document.getElementById("goalie-filters-bar"); if (gf) gf.style.display = "none";
    loadPlayers();
  });

  document.getElementById("leaders-goalies-btn")?.addEventListener("click", () => {
    leadersMode = "goalies";
    document.getElementById("leaders-goalies-btn")?.classList.add("active");
    document.getElementById("leaders-skaters-btn")?.classList.remove("active");
    const sc = document.getElementById("skater-categories"); if (sc) sc.style.display = "none";
    const sf = document.getElementById("skater-filters-bar"); if (sf) sf.style.display = "none";
    const gc = document.getElementById("goalie-categories"); if (gc) gc.style.display = "grid";
    const gf = document.getElementById("goalie-filters-bar"); if (gf) gf.style.display = "flex";
    cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
  });

  document.getElementById("filter-rookie-toggle")?.addEventListener("click", () => {
    skaterRookieOnly = !skaterRookieOnly;
    document.getElementById("filter-rookie-toggle")?.classList.toggle("active", skaterRookieOnly);
    loadPlayers();
  });

  document.getElementById("filter-pos-d")?.addEventListener("click", () => {
    skaterPositionFilter = (skaterPositionFilter === "D") ? "ALL" : "D";
    document.getElementById("filter-pos-d")?.classList.toggle("active", skaterPositionFilter === "D");
    document.getElementById("filter-pos-f")?.classList.remove("active");
    loadPlayers();
  });

  document.getElementById("filter-pos-f")?.addEventListener("click", () => {
    skaterPositionFilter = (skaterPositionFilter === "F") ? "ALL" : "F";
    document.getElementById("filter-pos-f")?.classList.toggle("active", skaterPositionFilter === "F");
    document.getElementById("filter-pos-d")?.classList.remove("active");
    loadPlayers();
  });

  document.getElementById("goalie-min-filter")?.addEventListener("click", () => {
    goalieMinGames = !goalieMinGames;
    document.getElementById("goalie-min-filter")?.classList.toggle("active", goalieMinGames);
    renderGoaliesFromCache();
  });

  document.querySelectorAll("#skater-categories button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#skater-categories button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentCat = b.dataset.cat;
      loadPlayers();
    };
  });

  document.querySelectorAll("#goalie-categories button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#goalie-categories button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentGoalieSortKey = b.dataset.goalieSort;
      currentGoalieSortAsc = (currentGoalieSortKey === "gaa" || currentGoalieSortKey === "losses");
      cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
    };
  });

  document.getElementById("draft-year-select")?.addEventListener("change", e => {
    currentDraftYear = e.target.value;
    loadDraft(currentDraftYear);
  });

  document.getElementById("std-mode-all")?.addEventListener("click", () => setStandingsMode("all"));
  document.getElementById("std-mode-conf")?.addEventListener("click", () => setStandingsMode("conf"));
  document.getElementById("std-mode-div")?.addEventListener("click", () => setStandingsMode("div"));
  document.getElementById("std-mode-adv")?.addEventListener("click", () => setStandingsMode("adv"));

  document.getElementById("season-select")?.addEventListener("change", e => {
    selectedSeasonEndDate = e.target.value;
    currentStandingsData = [];
    currentAdvancedTeamsData = [];
    standingsViewMode === "adv" ? loadAdvancedStandings() : loadStandings();
  });

  document.querySelectorAll(".standings-head .sortable[data-sort]").forEach(el => {
    el.onclick = () => {
      const key = el.dataset.sort;
      if (standingsSortKey === key) standingsSortAsc = !standingsSortAsc;
      else {
        standingsSortKey = key;
        standingsSortAsc = (key === "losses" || key === "goalAgainst" || key === "shotsAgainstPerGame");
      }
      renderStandings();
    };
  });

  document.querySelectorAll(".standings-head .sortable[data-adv-sort]").forEach(el => {
    el.onclick = () => {
      const key = el.dataset.advSort;
      if (advStandingsSortKey === key) advStandingsSortAsc = !advStandingsSortAsc;
      else {
        advStandingsSortKey = key;
        advStandingsSortAsc = false;
      }
      renderAdvancedStandings();
    };
  });

  document.getElementById("my-team-trigger")?.addEventListener("click", () => {
    renderTeamSelectorModal();
    const modal = document.getElementById("my-team-modal");
    if (modal) modal.style.display = "flex";
  });
  document.getElementById("close-team-modal-btn")?.addEventListener("click", () => {
    const modal = document.getElementById("my-team-modal");
    if (modal) modal.style.display = "none";
  });

  document.getElementById("donate-header-btn")?.addEventListener("click", () => {
    const TRIBUTE_URL = "https://t.me/tribute/app?startapp=dTl8";
    window.openPostInTelegram(TRIBUTE_URL);
  });
}

function initApp() {
  setupEventListeners();
  buildSeasonOptions();
  updateMyTeamButton();
  const params = new URLSearchParams(window.location.search);
  const rawSection = params.get("section") || "schedule";
  switchTab(rawSection);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
