// Заполнение списка драфта годами от 2026 до 1963
function buildDraftYearOptions() {
  const sel = document.getElementById("draft-year-select");
  if (!sel) return;

  if (sel.children.length === 0) {
    let html = "";
    for (let y = 2026; y >= 1963; y--) {
      html += `<option value="${y}" ${String(y) === String(currentDraftYear) ? "selected" : ""}>${y}</option>`;
    }
    sel.innerHTML = html;
  }

  if (currentDraftYear) {
    sel.value = currentDraftYear;
  }
}

async function loadDraft(year) {
  buildDraftYearOptions();
  const container = document.getElementById("draft-rounds-list");
  if (!container) return;
  container.innerHTML = '<div class="loading">Загрузка драфта НХЛ...</div>';

  const targetYear = year || currentDraftYear || "2026";
  currentDraftYear = targetYear;

  const sel = document.getElementById("draft-year-select");
  if (sel) sel.value = targetYear;

  try {
    const data = await fetchAPI(`/api/draft/${targetYear}`);

    let picks = [];
    if (Array.isArray(data?.picks)) {
      picks = data.picks;
    } else if (Array.isArray(data?.rounds)) {
      data.rounds.forEach(r => {
        if (Array.isArray(r.picks)) picks.push(...r.picks);
      });
    } else if (Array.isArray(data)) {
      picks = data;
    }

    if (!picks.length) {
      container.innerHTML = `<div class="empty">Данные по драфту ${targetYear} года ещё не опубликованы лигой</div>`;
      return;
    }

    // Группировка пиков по раундам
    const rounds = {};
    picks.forEach(p => {
      const r = p.round || p.roundNumber || 1;
      if (!rounds[r]) rounds[r] = [];
      rounds[r].push(p);
    });

    let html = "";
    Object.keys(rounds).sort((a, b) => Number(a) - Number(b)).forEach(roundNum => {
      html += `<div class="draft-round-title">Раунд ${roundNum}</div>`;
      rounds[roundNum].forEach(pick => {
        const rawAbbr = pick.teamAbbrev?.default || pick.teamAbbrev || pick.triCode || pick.team || "";
        const teamAbbrev = getTeamAbbrev(rawAbbr);
        const logo = getSafeTeamLogoUrl(teamAbbrev, pick.teamLogo || pick.teamLogoLight);

        let name = pick.playerName || "";
        if (!name) {
          const fName = pick.firstName?.default || pick.firstName || pick.playerFirstName || "";
          const lName = pick.lastName?.default || pick.lastName || pick.playerLastName || "";
          name = `${fName} ${lName}`.trim() || "Игрок";
        }

        const pos = pick.positionCode || pick.position || "";
        const amateurClub = pick.amateurClubName?.default || pick.amateurClubName || pick.lastAmateurClub || "";
        const amateurLeague = pick.amateurLeague?.default || pick.amateurLeague || pick.lastAmateurLeague || "";
        const amateur = [amateurClub, amateurLeague].filter(Boolean).join(" · ") || "Юниоры";

        let height = "";
        if (pick.heightInCentimeters) height = `${pick.heightInCentimeters} см`;
        else if (pick.heightInInches || pick.height) height = `${Math.round((pick.heightInInches || pick.height) * 2.54)} см`;

        let weight = "";
        if (pick.weightInKilograms) weight = `${pick.weightInKilograms} кг`;
        else if (pick.weightInPounds || pick.weight) weight = `${Math.round((pick.weightInPounds || pick.weight) * 0.453592)} кг`;

        // Карьерная статистика в НХЛ, если доступна в драфт-ответе
        let nhlStat = "";
        if (pick.careerGamesPlayed) {
          nhlStat = `НХЛ: ${pick.careerGamesPlayed} игр, ${pick.careerPoints || 0} очков`;
        }

        const meta = [pos, nhlStat || amateur, height, weight].filter(Boolean).join(" · ");
        const pId = pick.playerId ? String(pick.playerId) : "";
        const overall = pick.overallPick || pick.overallPickNumber || pick.pick || "—";

        const fallbackJson = encodeURIComponent(JSON.stringify({
          fullName: name,
          teamAbbrev: teamAbbrev,
          position: pos,
          height: height,
          weight: weight,
          draft: `${targetYear} г., раунд ${roundNum}, №${overall}`
        }));

        html += `
          <div class="draft-pick-card" onclick="openPlayerDetail('${pId}', '${fallbackJson}')" style="cursor:pointer;">
            <div class="draft-pick-num">#${overall}</div>
            <img class="draft-team-logo" src="${escapeHtml(logo)}" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/nhl_light.svg'">
            <div class="draft-player-info">
              <div class="draft-player-name">${escapeHtml(name)}</div>
              <div class="draft-player-meta">${escapeHtml(meta)}</div>
            </div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty">Не удалось загрузить драфт ${targetYear} года</div>`;
  }
}
