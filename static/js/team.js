let currentTeamSkaters = [];
let currentTeamGoalies = [];
let teamSkaterSortKey = "points";
let teamSkaterSortAsc = false;
let teamGoalieSortKey = "gamesPlayed";
let teamGoalieSortAsc = false;

function renderTeamTablesHTML() {
  const container = document.getElementById("team-tables-container");
  if (!container) return;

  // Сортировка полевых
  const sortedSkaters = [...currentTeamSkaters].sort((a, b) => {
    const va = Number(a[teamSkaterSortKey] ?? 0);
    const vb = Number(b[teamSkaterSortKey] ?? 0);
    return teamSkaterSortAsc ? va - vb : vb - va;
  });

  // Сортировка вратарей
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
  if (teamSkaterSortKey === key) {
    teamSkaterSortAsc = !teamSkaterSortAsc;
  } else {
    teamSkaterSortKey = key;
    teamSkaterSortAsc = false;
  }
  renderTeamTablesHTML();
}

function sortTeamGoalies(key) {
  if (teamGoalieSortKey === key) {
    teamGoalieSortAsc = !teamGoalieSortAsc;
  } else {
    teamGoalieSortKey = key;
    teamGoalieSortAsc = (key === "gaa");
  }
  renderTeamTablesHTML();
}

async function openTeamDetail(teamAbbrev, teamName, teamLogo) {
  const abbrev = getTeamAbbrev(teamAbbrev);
  const fullName = NHL_TEAMS_FULL[abbrev] || (teamName && teamName !== abbrev ? teamName : abbrev);

  pushScreenHistory(() => openTeamDetail(abbrev, fullName, teamLogo));
  openDetail();
  const body = document.getElementById("detail-body");

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
    document.getElementById("team-tables-container").innerHTML = '<div class="empty">Не удалось загрузить состав</div>';
  }
}
