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

  games.innerHTML = '<div class="loading">Загрузка матчей...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/schedule?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    const day = (data.gameWeek || []).find(item => item.date === dateStr);
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

// Загрузка ресурса Gamecenter с каскадным fallback
async function fetchGamecenterEndpoint(gameId, endpoint) {
  const targetUrl = `https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`;
  const urls = [
    `${API_BASE}/v1/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`,
    `${API_BASE}/api/gamecenter/${encodeURIComponent(gameId)}/${endpoint}`,
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

// ПОЛНЫЙ ЭКРАН ПОСЛЕМАТЧЕВОЙ СТАТИСТИКИ (СОГЛАСНО СКРИНШОТАМ)
async function openGameDetail(gameId, awayAbbrev, homeAbbrev) {
  pushScreenHistory(() => openGameDetail(gameId, awayAbbrev, homeAbbrev));
  openDetail();
  const body = document.getElementById("detail-body");

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

    let html = "";

    // 1. ОФИЦИАЛЬНЫЙ ВИДЕООБЗОР МАТЧА (NHL)
    html += `
      <div class="section-title">ОФИЦИАЛЬНЫЙ ВИДЕООБЗОР МАТЧА (NHL)</div>
      <div id="video-recap-slot" style="margin-bottom:18px;">
        <div class="loading" style="padding:16px;">Поиск официального обзора...</div>
      </div>
    `;

    // 2. ТРИ ЗВЕЗДЫ МАТЧА
    const stars = landing?.summary?.threeStars || [];
    if (stars.length > 0) {
      html += `<div class="section-title">ТРИ ЗВЕЗДЫ МАТЧА</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:18px;">`;
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

    // 3. ГОЛЫ ПО ПЕРИОДАМ
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

    // 4. СТАТИСТИКА КОМАНД
    const statsList = landing?.summary?.teamGameStats || [];
    if (statsList.length > 0) {
      const statMapLabels = {
        sog: "БРОСКИ В СТВОР",
        faceoffWinningPctg: "ВБРАСЫВАНИЯ, %",
        faceoffPctg: "ВБРАСЫВАНИЯ, %",
        faceoffsWon: "ВЫИГРАННЫЕ ВБРАСЫВАНИЯ",
        powerPlay: "БОЛЬШИНСТВО",
        powerPlayPctg: "БОЛЬШИНСТВО, %",
        pim: "ШТРАФ (МИН)",
        hits: "СИЛОВЫЕ ПРИЁМЫ",
        blockedShots: "ЗАБЛОКИРОВАНО БРОСКОВ",
        giveaways: "ПОТЕРИ ШАЙБЫ",
        takeaways: "ОТБОРЫ ШАЙБЫ"
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

    // 5. СТАТИСТИКА ИГРОКОВ (ПОЛЕВЫЕ И ВРАТАРИ)
    function renderSkatersTable(teamAbbrev, skatersList) {
      if (!skatersList || !skatersList.length) return "";
      return `
        <div class="section-title">ИГРОКИ — ${escapeHtml(teamAbbrev)}</div>
        <div class="table-scroll" style="margin-bottom:18px;">
          <table class="stat-table">
            <thead>
              <tr>
                <th>ИГРОК</th>
                <th>Г</th>
                <th>П</th>
                <th>О</th>
                <th>+/-</th>
                <th>Б</th>
                <th>В</th>
                <th>Х</th>
                <th>БЛ</th>
                <th>% ВБР</th>
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
              <tr>
                <th>ВРАТАРЬ</th>
                <th>БР</th>
                <th>О</th>
                <th>%ОБ</th>
                <th>В</th>
                <th>ГКИ</th>
              </tr>
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

    const awaySkaters = [...(awayBox.forwards || []), ...(awayBox.defense || [])];
    const homeSkaters = [...(homeBox.forwards || []), ...(homeBox.defense || [])];

    html += renderSkatersTable(awayAbbrev, awaySkaters);
    html += renderSkatersTable(homeAbbrev, homeSkaters);
    html += renderGoaliesTable(awayAbbrev, awayBox.goalies || []);
    html += renderGoaliesTable(homeAbbrev, homeBox.goalies || []);

    container.innerHTML = html;

    // Фоновая загрузка официального YouTube видеообзора
    const gameDate = landing?.gameDate || "";
    if (gameDate) {
      fetch(`${API_BASE}/api/game-youtube-recap?away=${awayAbbrev}&home=${homeAbbrev}&date=${gameDate}`)
        .then(r => r.json())
        .then(vData => {
          const vSlot = document.getElementById("video-recap-slot");
          if (vData?.videoId && vSlot) {
            vSlot.innerHTML = `
              <div class="video-container">
                <iframe src="https://www.youtube.com/embed/${vData.videoId}?playsinline=1&rel=0" allowfullscreen></iframe>
              </div>
            `;
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
