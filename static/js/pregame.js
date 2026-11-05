// Функция форматирования серий (победы / поражения)
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

// Определение завершения матча в ОТ или по буллитам
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

// Связка исторических франшиз (Юта раньше была Аризоной ARI)
function getHistoricalTeamAbbrevs(abbrev) {
  const up = String(abbrev || "").toUpperCase();
  if (up === "UTA") return ["UTA", "ARI"];
  if (up === "ARI") return ["ARI", "UTA"];
  return [up];
}

// Загрузка 10 последних очных матчей
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
  
  // Ищем в последних 8 сезонах
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
  if (!games.length) {
    return '<div class="empty">История личных встреч формируется</div>';
  }

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
  let html = `
    <div class="section-title">ОЧНЫЕ ВСТРЕЧИ В ЭТОМ СЕЗОНЕ</div>
    <div class="card" style="padding:0;">
  `;
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

    <!-- 1. СТАРТОВЫЕ ГОЛКИПЕРЫ -->
    <div class="section-title">СТАРТОВЫЕ ГОЛКИПЕРЫ</div>
    <div class="pregame-probables-grid">
      ${renderProbableGoalieCard(probables.away, away.abbrev || awayAbbrev)}
      ${renderProbableGoalieCard(probables.home, home.abbrev || homeAbbrev)}
    </div>

    <!-- 2. СРАВНЕНИЕ ПОКАЗАТЕЛЕЙ КОМАНД -->
    <div class="section-title">СРАВНЕНИЕ ПОКАЗАТЕЛЕЙ КОМАНД</div>
    <div class="card" style="padding:10px 14px;">
      ${preStats.map(st => {
        const isPct = (st.category || "").toLowerCase().includes("pct");
        const aVal = isPct ? formatPercentDisplay(st.awayValue) : val(st.awayValue);
        const hVal = isPct ? formatPercentDisplay(st.homeValue) : val(st.homeValue);
        const aNum = Number(st.awayValue ?? -999);
        const hNum = Number(st.homeValue ?? -999);

        const catLower = (st.category || "").toLowerCase();
        const lowerIsBetter = catLower.includes("against");
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

    <!-- 3. СЕРИИ И ФОРМА КОМАНД -->
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

    <!-- 4. СПИСОК ТРАВМИРОВАННЫХ -->
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

    <!-- 5. ПОСЛЕДНИЕ МАТЧИ МЕЖДУ КЛУБАМИ -->
    <div class="section-title" id="h2h-title-slot">ПОСЛЕДНИЕ 10 МАТЧЕЙ МЕЖДУ КЛУБАМИ</div>
    <div class="card" style="padding:0;" id="pregame-h2h-container">
      <div class="loading">Загрузка очных встреч...</div>
    </div>

    <!-- 6. ОЧНЫЕ ВСТРЕЧИ В ЭТОМ СЕЗОНЕ -->
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
  body.innerHTML = '<div class="loading">Загрузка предматчевой аналитики...</div>';

  try {
    const data = await fetchAPI(`/api/pregame/${encodeURIComponent(gameId)}?date=${dateStr || ''}&away=${awayAbbrev}&home=${homeAbbrev}`);
    renderFullPregameCenter(data, awayAbbrev, homeAbbrev, awayLogo, homeLogo);
  } catch (err) {
    console.error("Pregame load error:", err);
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
