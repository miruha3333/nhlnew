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
  let dateStr = fmtDate(currentDate);
  const dp = document.getElementById("date-picker");
  if (dp) dp.value = dateStr;

  games.innerHTML = '<div class="loading">Загрузка матчей...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/schedule?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    
    // Синхронизация даты с текущей активной неделей НХЛ
    let day = (data.gameWeek || []).find(item => item.date === dateStr);
    
    // Если на выбранную дату в базе нет игр, берём ближайший активный день недели
    if (!day && Array.isArray(data.gameWeek) && data.gameWeek.length > 0) {
      day = data.gameWeek.find(d => Array.isArray(d.games) && d.games.length > 0) || data.gameWeek[0];
      if (day?.date) {
        dateStr = day.date;
        currentDate = new Date(`${dateStr}T12:00:00`);
        if (dp) dp.value = dateStr;
      }
    }

    let list = day?.games || [];

    if (!list.length) {
      games.innerHTML = '<div class="empty">В этот день матчей нет</div>';
      loadSpotlight();
      return;
    }

    if (myFavoriteTeam) {
      list = [...list].sort((a, b) => {
        const aFav = (getTeamAbbrev(a.awayTeam) === myFavoriteTeam || getTeamAbbrev(a.homeTeam) === myFavoriteTeam);
        const bFav = (getTeamAbbrev(b.awayTeam) === myFavoriteTeam || getTeamAbbrev(b.homeTeam) === myFavoriteTeam);
        return (bFav ? 1 : 0) - (aFav ? 1 : 0);
      });
    }

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
  } catch (err) {
    games.innerHTML = '<div class="empty">Не удалось загрузить матчи</div>';
  }
}

async function openGameDetail(gameId, awayAbbrev, homeAbbrev) {
  pushScreenHistory(() => openGameDetail(gameId, awayAbbrev, homeAbbrev));
  openDetail();
  const body = document.getElementById("detail-body");

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 0;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" style="width:48px;height:48px;">
      <div style="text-align:center;">
        <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;">${escapeHtml(awayAbbrev)} — ${escapeHtml(homeAbbrev)}</div>
        <div style="font-size:12px;color:var(--silver-dim);">ОБЗОР МАТЧА</div>
      </div>
      <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" style="width:48px;height:48px;">
    </div>
    <div id="video-recap-slot"></div>
    <div id="game-goals-slot"><div class="loading">Загрузка протокола...</div></div>
  `;

  try {
    const [scoreRes, railRes] = await Promise.all([
      fetch(`${API_BASE}/api/score/${encodeURIComponent(gameId)}`).then(r => r.json()),
      fetch(`${API_BASE}/api/right-rail/${encodeURIComponent(gameId)}`).then(r => r.json())
    ]);

    let goalsHtml = '<div class="section-title">Голы</div>';
    const scoring = scoreRes?.summary?.scoring || [];
    let hasGoals = false;

    scoring.forEach(p => {
      (p.goals || []).forEach(g => {
        hasGoals = true;
        const scorer = `${nameStr(g.firstName)} ${nameStr(g.lastName)}`.trim();
        goalsHtml += `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <div style="color:var(--silver-dim);width:45px;">${escapeHtml(val(g.timeInPeriod))}</div>
            <div style="flex:1;"><strong>${escapeHtml(scorer)}</strong> (${escapeHtml(g.teamAbbrev?.default || "")})</div>
            <div style="font-weight:700;">${g.awayScore} : ${g.homeScore}</div>
          </div>
        `;
      });
    });

    if (!hasGoals) goalsHtml += '<div class="empty">Голов пока нет</div>';
    document.getElementById("game-goals-slot").innerHTML = goalsHtml;

    if (scoreRes?.gameDate) {
      fetch(`${API_BASE}/api/game-youtube-recap?away=${awayAbbrev}&home=${homeAbbrev}&date=${scoreRes.gameDate}`)
        .then(r => r.json())
        .then(vData => {
          if (vData.videoId && document.getElementById("video-recap-slot")) {
            document.getElementById("video-recap-slot").innerHTML = `
              <div class="video-container">
                <iframe src="https://www.youtube.com/embed/${vData.videoId}?playsinline=1&rel=0" allowfullscreen></iframe>
              </div>
            `;
          }
        }).catch(() => {});
    }
  } catch (e) {
    document.getElementById("game-goals-slot").innerHTML = '<div class="empty">Не удалось загрузить голы</div>';
  }
}

async function loadSpotlight() {
  const games = document.getElementById("games");
  try {
    const res = await fetch(`${API_BASE}/api/leaders/points?limit=5`);
    const data = await res.json();
    const list = data.points || [];
    if (!list.length) return;

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
