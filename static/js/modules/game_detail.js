import { API_BASE, TEAM_STAT_LABELS } from "../config.js";
import { escapeHtml, nameStr, val, formatShortName, formatPctCell, getTeamAbbrev, stopAllVideos } from "../utils.js";
import { openPlayerDetail } from "./player_detail.js";

export function openDetail() {
  stopAllVideos();
  document.getElementById("view-schedule").style.display = "none";
  document.getElementById("view-standings").style.display = "none";
  document.getElementById("view-players").style.display = "none";
  document.getElementById("view-transactions").style.display = "none";
  const newsView = document.getElementById("view-news");
  if (newsView) newsView.style.display = "none";
  document.getElementById("view-detail").style.display = "";
  document.getElementById("main-nav").style.display = "none";
  document.getElementById("detail-body").innerHTML = '<div class="loading">Загрузка...</div>';
  window.scrollTo(0, 0);
}

function formatPeriodLabel(descriptor) {
  if (!descriptor) return "Период";
  if (descriptor.periodType === "SO") return "Буллиты";
  if (descriptor.periodType === "OT") {
    const number = descriptor.number && descriptor.number > 3 ? descriptor.number - 3 : 1;
    return number > 1 ? `${number}-й овертайм` : "Овертайм";
  }
  return descriptor.number ? `${descriptor.number}-й период` : "Период";
}

function getGoalStrengthLabel(goal) {
  const raw = String(goal?.strengthCode ?? goal?.strength ?? goal?.situationCode ?? goal?.typeCode ?? goal?.goalType ?? "").toUpperCase();
  if (goal?.isShortHanded === true || goal?.isShorthanded === true || /SH/.test(raw)) return "М";
  if (goal?.isPowerPlay === true || goal?.isPowerplay === true || /PP/.test(raw)) return "Б";
  return "";
}

function isCompletedGame(game) {
  const state = String(game?.gameState || "").toUpperCase();
  return state === "OFF" || state === "FINAL" || state === "F" ||
    (game?.awayTeam?.score !== undefined && game?.homeTeam?.score !== undefined && !["FUT", "PRE", "LIVE", "CRIT"].includes(state));
}

function renderThreeStarsBlock(stars) {
  if (!Array.isArray(stars) || !stars.length) return "";
  const titles = ["1-я звезда", "2-я звезда", "3-я звезда"];
  const badges = ["🥇", "🥈", "🥉"];

  return `
    <div class="section-title">Три звезды матча</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
      ${stars.map((s, idx) => {
        const rawName = s.name || s.playerName || `${nameStr(s.firstName)} ${nameStr(s.lastName)}`.trim();
        const fullName = nameStr(rawName) || "Игрок";
        const pId = s.playerId || s.id;
        const headshot = s.headshot || (pId ? `https://assets.nhle.com/mugs/nhl/latest/${pId}.png` : "");
        const team = s.teamAbbrev?.default || s.teamAbbrev || "";
        
        let statText = "";
        if (s.goals !== undefined || s.assists !== undefined || s.points !== undefined) {
          statText = `${Number(s.goals || 0)} Г, ${Number(s.assists || 0)} П`;
        } else if (s.savePctg !== undefined || s.savePercentage !== undefined || s.saves !== undefined) {
          const svPct = Number(s.savePctg ?? s.savePercentage ?? 0);
          statText = svPct > 0 ? `${(svPct <= 1 ? svPct * 100 : svPct).toFixed(1)}% ОБ` : (s.saves ? `${s.saves} сейвов` : "");
        }

        return `
          <div class="card clickable-row" style="padding:10px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;" data-star-id="${pId}">
            <div style="font-size:11px;font-family:'Oswald',sans-serif;color:var(--silver-dim);margin-bottom:6px;text-transform:uppercase;">
              ${badges[idx] || "⭐"} ${titles[idx] || `${idx + 1} звезда`}
            </div>
            <img src="${escapeHtml(headshot)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:1px solid var(--border);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
            <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:12px;margin-top:6px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">
              ${escapeHtml(fullName)}
            </div>
            <div style="font-size:10px;color:var(--silver-dim);margin-top:2px;">
              ${escapeHtml(team)} · ${escapeHtml(s.position || "")}
            </div>
            ${statText ? `<div style="font-family:'Roboto Mono',monospace;font-size:10px;color:#2ecc71;font-weight:700;margin-top:4px;">${escapeHtml(statText)}</div>` : ''}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderTeamGameStats(rightRail, awayAbbrev, homeAbbrev) {
  const stats = rightRail?.teamGameStats || [];
  let html = '<div class="section-title">Статистика команд</div>';
  if (!stats.length) return html + '<div class="empty">Статистика команд формируется протоколом лиги</div>';

  html += `
    <div class="card" style="padding:0;">
      <div class="teamstat-header-flex">
        <div class="teamstat-side-flex">
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_dark.svg';">
          <span>${escapeHtml(awayAbbrev)}</span>
        </div>
        <div class="teamstat-side-flex right">
          <span>${escapeHtml(homeAbbrev)}</span>
          <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_dark.svg';">
        </div>
      </div>
  `;

  stats.forEach(stat => {
    const label = TEAM_STAT_LABELS[stat.category] || stat.category;
    let awayValue = stat.awayValue;
    let homeValue = stat.homeValue;

    if (typeof awayValue === "number" && (stat.category === "faceoffWinningPctg" || stat.category === "powerPlayPctg")) {
      awayValue = `${(awayValue * 100).toFixed(1)}%`;
      homeValue = `${(homeValue * 100).toFixed(1)}%`;
    }

    html += `
      <div class="teamstat-row-flex">
        <div class="teamstat-val-flex left" style="color:#ffffff !important;">${escapeHtml(val(awayValue))}</div>
        <div class="teamstat-label-flex">${escapeHtml(label)}</div>
        <div class="teamstat-val-flex right" style="color:#ffffff !important;">${escapeHtml(val(homeValue))}</div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function renderGamePlayerStats(team, teamAbbrev) {
  const skaters = [...(team?.forwards || []), ...(team?.defense || []), ...(team?.skaters || [])];
  let html = `<div class="section-title">Игроки — ${escapeHtml(teamAbbrev)}</div>`;
  if (!skaters.length) return html + '<div class="empty">Статистика полевых игроков недоступна</div>';

  html += `
    <div class="table-scroll game-player-section">
      <table class="stat-table game-player-table">
        <thead>
          <tr>
            <th>Игрок</th><th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Б</th><th>В</th><th>Х</th><th>Бл</th>
          </tr>
        </thead>
        <tbody>
  `;

  skaters.forEach(p => {
    const name = p.name?.default || p.name || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim() || "Игрок";
    html += `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="num">${val(p.goals, 0)}</td>
        <td class="num">${val(p.assists, 0)}</td>
        <td class="num" style="color:#ffffff !important;font-weight:700;">${val(p.points, 0)}</td>
        <td class="num">${val(p.plusMinus, 0)}</td>
        <td class="num">${val(p.sog ?? p.shots, 0)}</td>
        <td class="num">${val(p.toi, "0:00")}</td>
        <td class="num">${val(p.hits, 0)}</td>
        <td class="num">${val(p.blockedShots ?? p.blocks, 0)}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

function renderGameGoalieStats(team, teamAbbrev) {
  const goalies = team?.goalies || [];
  let html = `<div class="section-title">Вратари — ${escapeHtml(teamAbbrev)}</div>`;
  if (!goalies.length) return html + '<div class="empty">Статистика вратарей недоступна</div>';

  html += `
    <div class="table-scroll game-player-section">
      <table class="stat-table game-player-table">
        <thead>
          <tr>
            <th>Вратарь</th><th>Бр</th><th>О</th><th>%ОБ</th><th>В</th><th>ГКИ</th>
          </tr>
        </thead>
        <tbody>
  `;

  goalies.forEach(g => {
    const name = g.name?.default || g.name || `${nameStr(g.firstName)} ${nameStr(g.lastName)}`.trim() || "Вратарь";
    const svPct = g.savePctg ?? g.savePercentage;
    html += `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="num">${val(g.shotsAgainst ?? g.shots, 0)}</td>
        <td class="num" style="color:#ffffff !important;font-weight:700;">${val(g.saves, 0)}</td>
        <td class="num" style="color:#ffffff !important;font-weight:700;">${typeof svPct === "number" ? svPct.toFixed(3) : val(svPct)}</td>
        <td class="num">${val(g.toi, "0:00")}</td>
        <td class="num">${typeof g.goalsAgainstAverage === "number" ? g.goalsAgainstAverage.toFixed(2) : val(g.gaa)}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

export async function openGameDetail(gameId, awayAbbrev, homeAbbrev) {
  openDetail();
  const body = document.getElementById("detail-body");

  let html = `
    <div class="detail-head-game">
      <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_dark.svg';">
      <div>
        <div class="title">${escapeHtml(awayAbbrev)} — ${escapeHtml(homeAbbrev)}</div>
        <div class="subtitle">Статистика и обзор матча</div>
      </div>
      <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_dark.svg';">
    </div>
    <div id="video-recap-slot"></div>
  `;

  try {
    const [scoreRes, railRes, boxRes] = await Promise.all([
      fetch(`${API_BASE}/api/score/${encodeURIComponent(gameId)}`),
      fetch(`${API_BASE}/api/right-rail/${encodeURIComponent(gameId)}`),
      fetch(`${API_BASE}/api/boxscore/${encodeURIComponent(gameId)}`),
    ]);

    const score = await scoreRes.json();
    const rail = await railRes.json();
    const box = await boxRes.json();

    const threeStars = score?.summary?.threeStars || score?.threeStars || [];
    if (Array.isArray(threeStars) && threeStars.length > 0) {
      html += renderThreeStarsBlock(threeStars);
    }

    html += '<div class="section-title">Голы</div>';
    const scoring = score?.summary?.scoring || [];
    let hasGoals = false;

    scoring.forEach(period => {
      const goals = period.goals || [];
      if (!goals.length) return;
      hasGoals = true;

      html += `<div class="period-label">${escapeHtml(formatPeriodLabel(period.periodDescriptor))}</div>`;
      goals.forEach(goal => {
        const scorer = `${nameStr(goal.firstName)} ${nameStr(goal.lastName)}`.trim();
        const strengthLabel = getGoalStrengthLabel(goal);
        const assists = Array.isArray(goal.assists)
          ? goal.assists.map(item => `${nameStr(item.firstName)} ${nameStr(item.lastName)}`).join(", ")
          : "";

        html += `
          <div class="goal-row">
            <div class="time">${escapeHtml(val(goal.timeInPeriod))}</div>
            <div class="desc">
              <div class="scorer">
                ${escapeHtml(scorer)} (${escapeHtml(goal.teamAbbrev?.default || goal.teamAbbrev || "")})${strengthLabel ? ` (${strengthLabel})` : ""}
              </div>
              ${assists ? `<div class="assists">Передачи: ${escapeHtml(assists)}</div>` : ""}
            </div>
            <div class="scoreline" style="color:#ffffff !important;">${escapeHtml(val(goal.awayScore))} : ${escapeHtml(val(goal.homeScore))}</div>
          </div>
        `;
      });
    });

    if (!hasGoals) html += '<div class="empty">Голов пока не было</div>';

    html += renderTeamGameStats(rail, awayAbbrev, homeAbbrev);

    const awayPlayers = box?.playerByGameStats?.awayTeam || {};
    const homePlayers = box?.playerByGameStats?.homeTeam || {};

    html += '<div class="section-title">Статистика игроков</div>';
    html += renderGamePlayerStats(awayPlayers, awayAbbrev);
    html += renderGamePlayerStats(homePlayers, homeAbbrev);
    html += renderGameGoalieStats(awayPlayers, awayAbbrev);
    html += renderGameGoalieStats(homePlayers, homeAbbrev);

    body.innerHTML = html;

    body.querySelectorAll("[data-star-id]").forEach(card => {
      card.addEventListener("click", () => {
        if (card.dataset.starId) openPlayerDetail(card.dataset.starId);
      });
    });

    // Видеообзор
    const slot = document.getElementById("video-recap-slot");
    const isCompleted = isCompletedGame(score) || score?.gameState === "FINAL" || score?.gameState === "OFF";

    if (slot && isCompleted) {
      const officialSources = [
        box?.gameVideo?.threeMinRecap,
        box?.gameVideo?.condensedGame,
        score?.threeMinRecap,
        score?.condensedGame,
        rail?.threeMinRecap
      ];

      let nhlVideoId = null;
      for (const src of officialSources) {
        if (!src) continue;
        const match = String(src).match(/\d{10,14}/);
        if (match) { nhlVideoId = match[0]; break; }
      }

      if (nhlVideoId) {
        slot.innerHTML = `
          <div class="section-title">Официальный видеообзор матча (NHL)</div>
          <div class="video-container">
            <iframe src="https://players.brightcove.net/6415718365001/default_default/index.html?videoId=${nhlVideoId}" allowfullscreen allow="encrypted-media"></iframe>
          </div>
        `;
      } else {
        const gDate = score?.gameDate || "";
        fetch(`${API_BASE}/api/game-youtube-recap?away=${encodeURIComponent(awayAbbrev)}&home=${encodeURIComponent(homeAbbrev)}&date=${encodeURIComponent(gDate)}`)
          .then(res => res.json())
          .then(data => {
            const currentSlot = document.getElementById("video-recap-slot");
            if (currentSlot && data.videoId) {
              currentSlot.innerHTML = `
                <div class="section-title">Видеообзор матча (YouTube)</div>
                <div class="video-container">
                  <iframe src="https://www.youtube.com/embed/${escapeHtml(data.videoId)}?playsinline=1&rel=0&autoplay=0" allowfullscreen></iframe>
                </div>
              `;
            }
          }).catch(() => {});
      }
    }
  } catch (error) {
    html += `<div class="empty">Не удалось загрузить подробности матча</div>`;
    body.innerHTML = html;
  }
}

function renderProbableGoalieCard(goalie, teamAbbrev) {
  if (!goalie || !goalie.name || goalie.name === "Не объявлен") {
    return `
      <div class="pregame-goalie-box">
        <div class="pregame-goalie-avatar"><img src="https://assets.nhle.com/mugs/nhl/default-player.png" alt=""></div>
        <div class="pregame-goalie-name">Не объявлен</div>
        <div class="pregame-goalie-sub">${escapeHtml(teamAbbrev)}</div>
        <span class="pregame-status-badge badge-unannounced">Ожидается</span>
      </div>
    `;
  }

  const isConfirmed = goalie.confirmed || String(goalie.status || "").toLowerCase().includes("подтвержд");
  const badgeClass = isConfirmed ? "badge-confirmed" : "badge-probable";
  const statusText = isConfirmed ? "Подтверждён" : "Вероятен";
  const headshot = goalie.headshot || "https://assets.nhle.com/mugs/nhl/default-player.png";

  return `
    <div class="pregame-goalie-box">
      <div class="pregame-goalie-avatar">
        <img src="${escapeHtml(headshot)}" alt="" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        ${goalie.jersey ? `<span class="pregame-goalie-num">#${escapeHtml(goalie.jersey)}</span>` : ""}
      </div>
      <div class="pregame-goalie-name">${escapeHtml(goalie.name)}</div>
      <div class="pregame-goalie-sub">${escapeHtml(teamAbbrev)}</div>
      <span class="pregame-status-badge ${badgeClass}">${statusText}</span>
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

export async function openFutureGamePreview(gameId, awayAbbrev, homeAbbrev, awayLogo, homeLogo, dateStr) {
  openDetail();
  const body = document.getElementById("detail-body");

  body.innerHTML = `
    <div class="detail-head-game">
      <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(awayAbbrev)}_dark.svg';">
      <div>
        <div class="title">${escapeHtml(awayAbbrev)} — ${escapeHtml(homeAbbrev)}</div>
        <div class="subtitle">ПРЕДМАТЧЕВОЕ ПРЕВЬЮ</div>
      </div>
      <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${escapeHtml(homeAbbrev)}_dark.svg';">
    </div>
    <div class="loading">Загрузка предматчевой аналитики, вратарей и травм...</div>
  `;

  try {
    const params = new URLSearchParams({ date: dateStr || "", away: awayAbbrev || "", home: homeAbbrev || "" });
    const res = await fetch(`${API_BASE}/api/pregame/${encodeURIComponent(gameId)}?${params}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка загрузки");

    const away = data.awayTeam || {};
    const home = data.homeTeam || {};
    const injuries = data.injuries || { away: [], home: [] };
    const preStats = data.preGameStats || [];
    const probables = data.probableGoalies || { away: null, home: null };

    const startTime = data.startTimeUTC
      ? new Date(data.startTimeUTC).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + " (МСК)"
      : "Время уточняется";

    let html = `
      <div class="detail-head-game">
        <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(away.abbrev || awayAbbrev)}_light.svg" alt="">
        <div>
          <div class="title">${escapeHtml(away.abbrev || awayAbbrev)} — ${escapeHtml(home.abbrev || homeAbbrev)}</div>
          <div class="subtitle" style="color:#2ecc71;font-weight:600;">НАЧАЛО: ${escapeHtml(startTime)}</div>
        </div>
        <img class="team-logo" src="https://assets.nhle.com/logos/nhl/svg/${escapeHtml(home.abbrev || homeAbbrev)}_light.svg" alt="">
      </div>

      <div class="section-title">Стартовые голкиперы</div>
      <div class="pregame-probables-grid">
        ${renderProbableGoalieCard(probables.away, away.abbrev || awayAbbrev)}
        ${renderProbableGoalieCard(probables.home, home.abbrev || homeAbbrev)}
      </div>

      <div class="section-title">Сравнение показателей команд</div>
      <div class="card" style="padding:10px 14px;">
    `;

    preStats.forEach(st => {
      const aVal = formatPctCell(st.awayValue);
      const hVal = formatPctCell(st.homeValue);
      html += `
        <div class="comp-row">
          <div class="val away">${escapeHtml(aVal !== "—" ? aVal : val(st.awayValue))}</div>
          <div class="metric">${escapeHtml(st.label || "")}</div>
          <div class="val home">${escapeHtml(hVal !== "—" ? hVal : val(st.homeValue))}</div>
        </div>
      `;
    });

    html += `
      </div>

      <div class="section-title">Список травмированных (Injuries)</div>
      <div class="pregame-injuries-grid">
        <div class="injury-team-col">
          <h4>${escapeHtml(away.abbrev || awayAbbrev)}</h4>
          ${renderPregameInjuryList(injuries.away)}
        </div>
        <div class="injury-team-col">
          <h4>${escapeHtml(home.abbrev || homeAbbrev)}</h4>
          ${renderPregameInjuryList(injuries.home)}
        </div>
      </div>
    `;

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="empty">Не удалось загрузить превью матча</div>`;
  }
}
