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
      let valToShow = p.value ?? p[currentCat] ?? "—";
      if (currentCat === "plusMinus" && Number(valToShow) > 0) valToShow = `+${valToShow}`;

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

  body.innerHTML = rows.map((p, i) => {
    const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
    const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
    const gp = p.gamesPlayed ?? p.gp ?? "—";
    const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    const pId = getPlayerId(p) || p.playerId || "";

    let valToShow = p[currentGoalieSortKey] ?? "—";
    if (currentGoalieSortKey === "savePctg" && typeof valToShow === "number") valToShow = valToShow.toFixed(3);
    if (currentGoalieSortKey === "gaa" && typeof valToShow === "number") valToShow = valToShow.toFixed(2);

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
        <div class="pvalue">${escapeHtml(valToShow)}</div>
      </div>
    `;
  }).join("");
}
