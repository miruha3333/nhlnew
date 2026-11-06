import { API_BASE } from "../config.js";
import { escapeHtml, nameStr, val } from "../utils.js";
import { openDetail } from "./game_detail.js";

function renderCareerRow(season, position) {
  const seasonName = String(season.season || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
  const teamName = season.teamName?.default || season.teamAbbrev || "—";

  let html = `
    <tr>
      <td>${escapeHtml(seasonName)}</td>
      <td>${escapeHtml(teamName)}</td>
      <td class="num">${escapeHtml(val(season.gamesPlayed, 0))}</td>
  `;

  if (position === "G") {
    const savePct = season.savePctg ?? season.savePercentage;
    const gaa = season.goalsAgainstAverage ?? season.gaa;
    html += `
      <td class="num">${escapeHtml(val(season.wins, 0))}</td>
      <td class="num">${escapeHtml(val(season.losses, 0))}</td>
      <td class="num" style="color:#ffffff !important;font-weight:700;">${typeof savePct === "number" ? savePct.toFixed(3) : escapeHtml(val(savePct))}</td>
      <td class="num">${typeof gaa === "number" ? gaa.toFixed(2) : escapeHtml(val(gaa))}</td>
    `;
  } else {
    html += `
      <td class="num">${escapeHtml(val(season.goals, 0))}</td>
      <td class="num">${escapeHtml(val(season.assists, 0))}</td>
      <td class="num" style="color:#ffffff !important;font-weight:700;">${escapeHtml(val(season.points, 0))}</td>
      <td class="num">${escapeHtml(val(season.plusMinus, 0))}</td>
      <td class="num">${escapeHtml(val(season.pim ?? season.penaltyMinutes, 0))}</td>
    `;
  }

  return `${html}</tr>`;
}

export async function openPlayerDetail(playerId) {
  openDetail();
  const body = document.getElementById("detail-body");

  try {
    const response = await fetch(`${API_BASE}/api/player/${encodeURIComponent(playerId)}`);
    const player = await response.json();

    if (!player || player.error) throw new Error("Игрок не найден");

    const fullName = `${nameStr(player.firstName)} ${nameStr(player.lastName)}`.trim() || "Игрок";
    const position = player.positionCode || player.position || "";
    const birthPlace = [nameStr(player.birthCity), player.birthCountry].filter(Boolean).join(", ");

    let draftText = "На драфте не выбран";
    if (player.draftDetails) {
      const draft = player.draftDetails;
      draftText = `Выбран «${draft.teamAbbrev || ""}» в ${draft.year} г. (раунд ${draft.round}, общий номер ${draft.overallPick})`;
    }

    let html = `
      <div class="detail-head">
        <img class="headshot" src="${escapeHtml(player.headshot || `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png`)}" alt="" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div>
          <div class="title">${escapeHtml(fullName)}</div>
          <div class="subtitle">${escapeHtml(player.teamAbbrev || "")} · №${escapeHtml(val(player.sweaterNumber))} · ${escapeHtml(position)}</div>
        </div>
        <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(player.teamAbbrev || "")}_light.svg" alt="" style="margin-left:auto" onerror="this.style.display='none'">
      </div>

      <div class="section-title">Личные данные</div>
      <div class="bio-grid">
        <div><div class="label">Дата рождения</div><div class="value">${escapeHtml(val(player.birthDate))}</div></div>
        <div><div class="label">Место рождения</div><div class="value">${escapeHtml(birthPlace || "—")}</div></div>
        <div><div class="label">Рост / Вес</div><div class="value">${player.heightInCentimeters ? `${player.heightInCentimeters} см` : "—"} / ${player.weightInKilograms ? `${player.weightInKilograms} кг` : "—"}</div></div>
        <div><div class="label">Хват</div><div class="value">${escapeHtml(val(player.shootsCatches))}</div></div>
        <div style="grid-column:1/-1;"><div class="label">Драфт</div><div class="value">${escapeHtml(draftText)}</div></div>
      </div>
    `;

    const currentStats = player.featuredStats?.regularSeason?.subSeason || player.currentSeasonStat;
    html += '<div class="section-title">Статистика в текущем сезоне</div>';

    if (!currentStats) {
      html += '<div class="empty">Статистика текущего сезона отсутствует</div>';
    } else if (position === "G") {
      html += `
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr><th>И</th><th>В</th><th>П</th><th>%ОБ</th><th>ГКИ</th></tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${escapeHtml(val(currentStats.gamesPlayed))}</td>
                <td class="num">${escapeHtml(val(currentStats.wins))}</td>
                <td class="num">${escapeHtml(val(currentStats.losses))}</td>
                <td class="num" style="color:#ffffff !important;font-weight:700;">${typeof currentStats.savePctg === "number" ? currentStats.savePctg.toFixed(3) : "—"}</td>
                <td class="num">${typeof currentStats.goalsAgainstAverage === "number" ? currentStats.goalsAgainstAverage.toFixed(2) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else {
      html += `
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr><th>И</th><th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th></tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${escapeHtml(val(currentStats.gamesPlayed))}</td>
                <td class="num">${escapeHtml(val(currentStats.goals))}</td>
                <td class="num">${escapeHtml(val(currentStats.assists))}</td>
                <td class="num" style="color:#ffffff !important;font-weight:700;">${escapeHtml(val(currentStats.points))}</td>
                <td class="num">${escapeHtml(val(currentStats.plusMinus))}</td>
                <td class="num">${escapeHtml(val(currentStats.pim ?? currentStats.penaltyMinutes))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    html += '<div class="section-title">История карьеры в NHL</div>';
    const history = Array.isArray(player.seasonTotals) ? player.seasonTotals.filter(item => item.leagueAbbrev === "NHL") : [];

    if (!history.length) {
      html += '<div class="empty">История выступлений в NHL отсутствует</div>';
    } else {
      const regular = history.filter(item => item.gameTypeId === 2 || item.gameTypeCode === 2);
      const playoffs = history.filter(item => item.gameTypeId === 3 || item.gameTypeCode === 3);
      const columns = position === "G" ? 7 : 8;

      html += `
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr>
                <th>Сезон</th><th>Клуб</th><th>И</th>
                ${position === "G" ? "<th>В</th><th>П</th><th>%ОБ</th><th>ГКИ</th>" : "<th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th>"}
              </tr>
            </thead>
            <tbody>
      `;

      if (regular.length) {
        html += `<tr class="playoff-header-row"><td colspan="${columns}">Регулярный сезон</td></tr>`;
        regular.forEach(item => { html += renderCareerRow(item, position); });
      }

      if (playoffs.length) {
        html += `<tr class="playoff-header-row playoff-border"><td colspan="${columns}">Плей-офф</td></tr>`;
        playoffs.forEach(item => { html += renderCareerRow(item, position); });
      }

      html += `</tbody></table></div>`;
    }

    body.innerHTML = html;
  } catch (error) {
    body.innerHTML = `<div class="empty">Не удалось загрузить карточку игрока</div>`;
  }
}
