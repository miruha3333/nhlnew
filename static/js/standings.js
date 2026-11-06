function seasonIdFromEndDate(endDate) {
  if (!endDate || typeof endDate !== "string") return null;
  const match = endDate.match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? `${Number(match[1]) - 1}${Number(match[1])}` : null;
}

async function buildSeasonOptions() {
  const sel = document.getElementById("season-select");
  if (!sel) return;
  try {
    const data = await fetchAPI("/api/seasons-list");
    const seasons = Array.isArray(data) ? data : (data?.data || data?.seasons || []);
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

  return `
    <div class="standings-row" onclick="openTeamDetail('${escapeHtml(abbrev)}', '${escapeHtml(teamFullName)}', '${logoSrc}')">
      <div class="num sticky-col sticky-col-1">${rank}</div>
      <div class="sticky-col sticky-col-2">
        <img class="team-logo" src="${escapeHtml(logoSrc)}" alt="" onerror="this.onerror=null; this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(abbrev)}_dark.svg';">
      </div>
      <div class="name sticky-col sticky-col-3">${escapeHtml(abbrev)}</div>
      <div class="num">${team.gamesPlayed ?? 0}</div>
      <div class="num">${team.wins ?? 0}</div>
      <div class="num">${team.otLosses ?? 0}</div>
      <div class="num">${team.losses ?? 0}</div>
      <div class="num">${team.goalFor ?? 0}</div>
      <div class="num">${team.goalAgainst ?? 0}</div>
      <div class="diff" style="color:${diff >= 0 ? '#2ecc71' : '#e74c3c'}">${diff > 0 ? '+' : ''}${diff}</div>
      <div class="pts">${team.points ?? 0}</div>
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
      const g = nameStr(t[field]) || (standingsViewMode === "conf" ? "Конференция" : "Дивизион");
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });

    Object.keys(groups).sort().forEach(gName => {
      html += `<div class="group-header-row">${escapeHtml(gName)}</div>`;
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
    const specialTeamsUrl = seasonId 
      ? `/api/team-special-teams?season=${seasonId}` 
      : `/api/team-special-teams`;

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
    const specialTeams = Array.isArray(specialData?.data) ? specialData.data : (Array.isArray(specialData?.teams) ? specialData.teams : []);
    specialTeams.forEach(r => {
      const ab = getTeamAbbrev(r.teamAbbrev || r.team || r.teamFullName);
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
    currentAdvancedTeamsData = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.teams) ? data.teams : []);
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
    const abbrev = getTeamAbbrev(t.teamAbbrev || t.team);
    const reg = regMap.get(abbrev) || {};
    const gp = reg.gamesPlayed ?? t.gamesPlayed ?? 0;
    const rw = Number(reg.regulationWins ?? reg.wins ?? 0);
    const rpo = Number(reg.regulationPlusOtWins ?? rw);
    const otWins = Math.max(0, rpo - rw);
    const soWins = Number(reg.shootoutWins ?? 0);
    const losses = Number(reg.losses ?? 0);
    const soLosses = Number(reg.shootoutLosses ?? 0);
    const otLosses = Math.max(0, Number(reg.otLosses ?? 0) - soLosses);
    const fullTeam = NHL_TEAMS_FULL[abbrev] || abbrev;

    return `
      <div class="standings-row" onclick="openTeamDetail('${escapeHtml(abbrev)}', '${escapeHtml(fullTeam)}', '')">
        <div class="num sticky-col sticky-col-1">${idx + 1}</div>
        <div class="sticky-col sticky-col-2"><img class="team-logo" src="${escapeHtml(getSafeTeamLogoUrl(abbrev))}"></div>
        <div class="name sticky-col sticky-col-3">${escapeHtml(abbrev)}</div>
        <div class="num">${gp}</div>
        <div class="num" style="color:#2ecc71;font-weight:700;">${rw}</div>
        <div class="num">${otWins}</div>
        <div class="num">${soWins}</div>
        <div class="num" style="color:#e74c3c;font-weight:700;">${losses}</div>
        <div class="num">${otLosses}</div>
        <div class="num">${soLosses}</div>
        <div class="num" style="color:${(t.satPct ?? 50) >= 50 ? '#2ecc71' : '#ff4d4d'};font-weight:700;">${t.satPct ?? '—'}%</div>
        <div class="num">${t.usatPct ?? '—'}%</div>
        <div class="num">${t.pdo ?? '—'}</div>
        <div class="num">${t.ozsp ?? '—'}%</div>
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
