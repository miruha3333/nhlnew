async function openPlayerDetail(playerId, fallbackDataStr = null) {
  pushScreenHistory(() => openPlayerDetail(playerId, fallbackDataStr));
  openDetail();
  const body = document.getElementById("detail-body");
  if (!body) return;
  body.innerHTML = '<div class="loading">Загрузка досье игрока...</div>';

  let fallback = null;
  if (fallbackDataStr) {
    try { fallback = JSON.parse(decodeURIComponent(fallbackDataStr)); } catch (_) {}
  }

  try {
    let p = null;
    if (playerId && playerId !== "0" && playerId !== "null" && playerId !== "undefined") {
      const directUrl = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/landing`;
      const candidateUrls = [
        `${API_BASE}/api/player/${encodeURIComponent(playerId)}`,
        directUrl,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`
      ];

      for (const u of candidateUrls) {
        try {
          const res = await fetch(u);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().startsWith("{")) {
              p = JSON.parse(text);
              if (p && (p.playerId || p.firstName)) break;
            }
          }
        } catch (_) {}
      }
    }

    if (!p) {
      if (fallback) {
        body.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
            <img src="https://assets.nhle.com/mugs/nhl/default-player.png" style="width:62px;height:62px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:2px solid var(--border);">
            <div>
              <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;line-height:1.2;">${escapeHtml(fallback.fullName || "Хоккеист")}</div>
              <div style="font-size:12px;color:var(--silver-dim);margin-top:2px;">${escapeHtml(fallback.teamAbbrev || "")} · ${escapeHtml(fallback.position || "Проспект")}</div>
            </div>
          </div>
          <div class="section-title">Информация о проспекте</div>
          <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:14px;">
            <div><span style="color:var(--silver-dim);">Рост / Вес:</span> <strong>${fallback.height || '—'} / ${fallback.weight || '—'}</strong></div>
            <div><span style="color:var(--silver-dim);">Клуб НХЛ:</span> <strong>${escapeHtml(fallback.teamAbbrev || "—")}</strong></div>
            <div style="grid-column:1/-1;"><span style="color:var(--silver-dim);">Драфт:</span> <strong>${escapeHtml(fallback.draft || "Выбран на драфте")}</strong></div>
          </div>
          <div class="empty">Игрок ещё не дебютировал в официальных матчах регулярного сезона НХЛ.</div>
        `;
        return;
      }
      throw new Error("Игрок не найден");
    }

    const fullName = p.fullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();
    const pos = p.positionCode || p.position || "";
    const isGoalie = (pos === "G");

    let draftText = "На драфте не выбран";
    if (p.draftDetails) {
      const d = p.draftDetails;
      draftText = `${d.year} г. («${d.teamAbbrev || ""}», раунд ${d.round}, №${d.overallPick})`;
    }

    let html = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <img src="${escapeHtml(p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png`)}" style="width:62px;height:62px;border-radius:50%;object-fit:cover;background:var(--surface-2);border:2px solid var(--border);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div>
          <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;line-height:1.2;">${escapeHtml(fullName)}</div>
          <div style="font-size:12px;color:var(--silver-dim);margin-top:2px;">${escapeHtml(p.teamAbbrev || "")} · №${escapeHtml(val(p.sweaterNumber))} · ${escapeHtml(pos)}</div>
        </div>
      </div>

      <div class="section-title">Личные данные</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:14px;">
        <div><span style="color:var(--silver-dim);">Рождение:</span> <strong>${val(p.birthDate)}</strong></div>
        <div><span style="color:var(--silver-dim);">Страна:</span> <strong>${val(p.birthCountry)}</strong></div>
        <div><span style="color:var(--silver-dim);">Рост / Вес:</span> <strong>${p.heightInCentimeters ? p.heightInCentimeters + ' см' : '—'} / ${p.weightInKilograms ? p.weightInKilograms + ' кг' : '—'}</strong></div>
        <div><span style="color:var(--silver-dim);">Хват:</span> <strong>${val(p.shootsCatches)}</strong></div>
        <div style="grid-column:1/-1;"><span style="color:var(--silver-dim);">Драфт:</span> <strong>${escapeHtml(draftText)}</strong></div>
      </div>
    `;

    const history = Array.isArray(p.seasonTotals) ? p.seasonTotals : [];
    if (history.length > 0) {
      const regSeasons = history.filter(s => s.gameTypeId === 2);
      const poSeasons = history.filter(s => s.gameTypeId === 3);

      html += `<div class="section-title">История игровой карьеры</div><div class="table-scroll"><table class="stat-table"><thead><tr><th>Сезон</th><th>Лига</th><th>Клуб</th><th>И</th>${isGoalie ? '<th>В</th><th>П</th><th>%ОБ</th><th>ГКИ</th>' : '<th>Г</th><th>П</th><th>О</th><th>+/-</th><th>Штр</th>'}</tr></thead><tbody>`;

      if (regSeasons.length > 0) {
        html += `<tr class="playoff-header-row"><td colspan="${isGoalie ? 8 : 9}">Регулярные чемпионаты</td></tr>`;
        regSeasons.forEach(s => {
          const sName = String(s.season || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
          const league = s.leagueAbbrev || "Лига";
          const team = s.teamName?.default || s.teamName || s.teamAbbrev || "—";
          const isNHL = (league === "NHL");

          html += `
            <tr style="${isNHL ? 'background:rgba(31,95,206,0.08);' : ''}">
              <td style="${isNHL ? 'font-weight:700;color:#fff;' : ''}">${escapeHtml(sName)}</td>
              <td><span style="padding:1px 5px;border-radius:4px;font-size:10px;background:var(--surface-2);color:${isNHL ? '#29b6f6' : 'var(--silver-dim)'};font-weight:700;">${escapeHtml(league)}</span></td>
              <td>${escapeHtml(team)}</td>
              <td class="num">${val(s.gamesPlayed, 0)}</td>
              ${isGoalie ? `
                <td class="num">${val(s.wins, 0)}</td>
                <td class="num">${val(s.losses, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${typeof (s.savePctg ?? s.savePercentage) === "number" ? Number(s.savePctg ?? s.savePercentage).toFixed(3) : "—"}</td>
                <td class="num">${typeof (s.goalsAgainstAverage ?? s.gaa) === "number" ? Number(s.goalsAgainstAverage ?? s.gaa).toFixed(2) : "—"}</td>
              ` : `
                <td class="num">${val(s.goals, 0)}</td>
                <td class="num">${val(s.assists, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${val(s.points, 0)}</td>
                <td class="num">${val(s.plusMinus, 0)}</td>
                <td class="num">${val(s.pim ?? s.penaltyMinutes, 0)}</td>
              `}
            </tr>
          `;
        });
      }

      if (poSeasons.length > 0) {
        html += `<tr class="playoff-header-row playoff-border"><td colspan="${isGoalie ? 8 : 9}">Плей-офф</td></tr>`;
        poSeasons.forEach(s => {
          const sName = String(s.season || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
          const league = s.leagueAbbrev || "Лига";
          const team = s.teamName?.default || s.teamName || s.teamAbbrev || "—";
          const isNHL = (league === "NHL");

          html += `
            <tr style="${isNHL ? 'background:rgba(31,95,206,0.08);' : ''}">
              <td style="${isNHL ? 'font-weight:700;color:#fff;' : ''}">${escapeHtml(sName)}</td>
              <td><span style="padding:1px 5px;border-radius:4px;font-size:10px;background:var(--surface-2);color:${isNHL ? '#29b6f6' : 'var(--silver-dim)'};font-weight:700;">${escapeHtml(league)}</span></td>
              <td>${escapeHtml(team)}</td>
              <td class="num">${val(s.gamesPlayed, 0)}</td>
              ${isGoalie ? `
                <td class="num">${val(s.wins, 0)}</td>
                <td class="num">${val(s.losses, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${typeof (s.savePctg ?? s.savePercentage) === "number" ? Number(s.savePctg ?? s.savePercentage).toFixed(3) : "—"}</td>
                <td class="num">${typeof (s.goalsAgainstAverage ?? s.gaa) === "number" ? Number(s.goalsAgainstAverage ?? s.gaa).toFixed(2) : "—"}</td>
              ` : `
                <td class="num">${val(s.goals, 0)}</td>
                <td class="num">${val(s.assists, 0)}</td>
                <td class="num" style="color:#fff;font-weight:700;">${val(s.points, 0)}</td>
                <td class="num">${val(s.plusMinus, 0)}</td>
                <td class="num">${val(s.pim ?? s.penaltyMinutes, 0)}</td>
              `}
            </tr>
          `;
        });
      }

      html += `</tbody></table></div>`;
    }

    body.innerHTML = html;
  } catch (_) {
    body.innerHTML = '<div class="empty">Не удалось загрузить карточку игрока</div>';
  }
}
