async function loadPlayers() {
  const body = document.getElementById("players-body");
  if (body) body.innerHTML = '<div class="loading">Загрузка лидеров...</div>';

  try {
    const data = await fetchAPI(`/api/leaders/${encodeURIComponent(currentCat)}?limit=${currentLimit}`);
    const list = data?.[currentCat] || data?.data || data?.skaters || data?.leaders || [];

    if (!list.length) {
      if (body) body.innerHTML = '<div class="empty">Нет данных лидеров</div>';
      return;
    }

    body.innerHTML = list.map((p, i) => {
      let valToShow = p.value ?? p[currentCat] ?? "—";
      if (currentCat === "plusMinus" && Number(valToShow) > 0) valToShow = `+${valToShow}`;
      
      const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
      const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
      const gp = p.gamesPlayed ?? p.gp ?? "—";
      const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();

      return `
        <div class="player-row" onclick="openPlayerDetail('${getPlayerId(p)}')">
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
    cachedGoaliesList = data?.wins || data?.goalies || data?.data || [];
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

  const sorted = [...cachedGoaliesList].sort((a, b) => {
    let va = Number(a[currentGoalieSortKey] ?? (currentGoalieSortKey === "gaa" ? Infinity : -Infinity));
    let vb = Number(b[currentGoalieSortKey] ?? (currentGoalieSortKey === "gaa" ? Infinity : -Infinity));
    return currentGoalieSortAsc ? va - vb : vb - va;
  });

  body.innerHTML = sorted.map((p, i) => {
    const rawTeam = getTeamAbbrev(p.teamAbbrev || p.team);
    const cleanTeam = rawTeam.replace(/[^A-Za-z]/gi, "").trim();
    const gp = p.gamesPlayed ?? p.gp ?? "—";
    const pName = p.name || p.playerFullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    
    let valToShow = p[currentGoalieSortKey] ?? p.value ?? "—";
    if (currentGoalieSortKey === "savePctg" && typeof valToShow === "number") valToShow = valToShow.toFixed(3);
    if (currentGoalieSortKey === "gaa" && typeof valToShow === "number") valToShow = valToShow.toFixed(2);

    return `
      <div class="player-row" onclick="openPlayerDetail('${getPlayerId(p)}')">
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
