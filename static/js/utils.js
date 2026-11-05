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

function getTeamLogo(team) {
  if (!team) return "";
  if (typeof team === "string") return team;
  return String(team.logo || team.teamLogo || team.crest || "");
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

  document.getElementById("view-schedule").style.display = "none";
  document.getElementById("view-standings").style.display = "none";
  document.getElementById("view-players").style.display = "none";
  document.getElementById("view-transactions").style.display = "none";
  document.getElementById("view-draft").style.display = "none";
  document.getElementById("view-news").style.display = "none";
  document.getElementById("view-detail").style.display = "";
  document.getElementById("main-nav").style.display = "none";
  document.getElementById("detail-body").innerHTML = '<div class="loading">Загрузка...</div>';
  window.scrollTo(0, 0);
}
