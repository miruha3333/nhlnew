// Конвертация секунд в минуты (например, 1713 сек -> 28:33)
function formatToiMinutes(val) {
  if (val === undefined || val === null || val === "" || isNaN(val)) return "—";
  const totalSec = Math.round(Number(val));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

async function loadPlayers() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка лидеров...</div>';

  try {
    let query = `/api/leaders/${encodeURIComponent(currentCat)}?limit=50`;
    if (skaterRookieOnly) query += `&isRookie=true`;
    if (skaterPositionFilter && skaterPositionFilter !== "ALL") query += `&positionCode=${skaterPositionFilter}`;

    const data = await fetchAPI(query);
    let list = data?.[currentCat] || data?.skaters || data?.data || data?.leaders || [];

    if (!list.length) {
      if (body) body.innerHTML = '<div class="empty">Нет данных лидеров по выбранным фильтрам</div>';
      return;
    }

    body.innerHTML = list.map((p, i) => {
      let valToShow = p.value ?? p[currentCat] ?? 0;

      // Форматирование ATOI в минуты:секунды
      if (currentCat === "toiPerGame") {
        valToShow = formatToiMinutes(valToShow);
      } else if (currentCat === "pointsPerGame") {
        valToShow = (typeof valToShow === "number") ? valToShow.toFixed(2) : Number(valToShow).toFixed(2);
      } else if (currentCat === "plusMinus" && Number(valToShow) > 0) {
        valToShow = `+${valToShow}`;
      }

      const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
      const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
      const gp = p.gamesPlayed ?? p.gp ?? p.games ?? "—";
      const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
      const pId = getPlayerId(p) || p.playerId || "";

      return `
        <div class="player-row" onclick="openPlayerDetail('${pId}', '${encodeURIComponent(JSON.stringify({ fullName: pName, teamAbbrev: cleanTeam }))}')">
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
          <div class="pvalue">${escapeHtml(String(valToShow))}</div>
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
    const data = await fetchAPI("/api/goalie-leaders");
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
  if (goalieMinGames) {
    rows = rows.filter(g => (g.gamesPlayed || g.gp || 0) >= 5);
  }

  rows.sort((a, b) => {
    const ascDefault = (currentGoalieSortKey === "gaa" || currentGoalieSortKey === "losses");
    let va = Number(a[currentGoalieSortKey] ?? (ascDefault ? Infinity : -Infinity));
    let vb = Number(b[currentGoalieSortKey] ?? (ascDefault ? Infinity : -Infinity));
    return currentGoalieSortAsc ? va - vb : vb - va;
  });

  // Заголовок таблицы вратарей с колонками И, В, П, ПО, %ОБ, ГКИ, СУХ
  let tableHtml = `
    <div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);color:var(--silver-dim);font-size:10px;text-transform:uppercase;font-family:'Oswald',sans-serif;">
      <div style="width:24px;text-align:center;">#</div>
      <div style="width:42px;"></div>
      <div style="flex:1;padding-left:10px;">ВРАТАРЬ</div>
      <div style="width:34px;text-align:center;">И</div>
      <div style="width:34px;text-align:center;">В</div>
      <div style="width:34px;text-align:center;">П</div>
      <div style="width:48px;text-align:center;">%ОБ</div>
      <div style="width:42px;text-align:center;">ГКИ</div>
      <div style="width:34px;text-align:center;">СУХ</div>
    </div>
  `;

  tableHtml += rows.map((p, i) => {
    const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
    const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
    const gp = p.gamesPlayed ?? p.gp ?? "—";
    const wins = p.wins ?? 0;
    const losses = p.losses ?? 0;
    const svPct = (typeof p.savePctg === "number") ? p.savePctg.toFixed(3) : (p.savePctg || "—");
    const gaa = (typeof p.gaa === "number") ? p.gaa.toFixed(2) : (p.gaa || "—");
    const shutouts = p.shutouts ?? 0;

    const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    const pId = getPlayerId(p) || p.playerId || "";

    return `
      <div class="player-row" style="padding:8px 0;display:flex;align-items:center;" onclick="openPlayerDetail('${pId}', '${encodeURIComponent(JSON.stringify({ fullName: pName, teamAbbrev: cleanTeam }))}')">
        <div class="rank" style="width:24px;text-align:center;">${i + 1}</div>
        <img class="headshot" src="${escapeHtml(getHeadshot(p))}" alt="" onerror="this.style.visibility='hidden'">
        <div class="info" style="flex:1;padding-left:10px;">
          <div class="pname">${escapeHtml(pName)}</div>
          <div class="pteam">
            <img src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(cleanTeam)}_light.svg" style="width:14px;height:14px;" onerror="this.style.display='none'">
            <span>${escapeHtml(cleanTeam)}</span>
          </div>
        </div>
        <div style="width:34px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:var(--silver-dim);">${gp}</div>
        <div style="width:34px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:#2ecc71;font-weight:700;">${wins}</div>
        <div style="width:34px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:#e74c3c;">${losses}</div>
        <div style="width:48px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:#ffffff;font-weight:700;">${svPct}</div>
        <div style="width:42px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:var(--silver-dim);">${gaa}</div>
        <div style="width:34px;text-align:center;font-family:'Roboto Mono',monospace;font-size:12px;color:var(--silver);">${shutouts}</div>
      </div>
    `;
  }).join("");

  body.innerHTML = tableHtml;
}
