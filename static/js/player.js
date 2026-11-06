async function openPlayerDetail(playerId) {
  pushScreenHistory(() => openPlayerDetail(playerId));
  openDetail();
  const body = document.getElementById("detail-body");
  body.innerHTML = '<div class="loading">Загрузка досье игрока...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/player/${encodeURIComponent(playerId)}`);
    const p = await res.json();
    const fullName = p.fullName || `${nameStr(p.firstName)} ${nameStr(p.lastName)}`.trim();

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <img src="${escapeHtml(p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${playerId}.png`)}" style="width:58px;height:58px;border-radius:50%;object-fit:cover;background:var(--surface-2);" onerror="this.src='https://assets.nhle.com/mugs/nhl/default-player.png'">
        <div>
          <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;">${escapeHtml(fullName)}</div>
          <div style="font-size:12px;color:var(--silver-dim);">${escapeHtml(p.teamAbbrev || "")} · №${escapeHtml(val(p.sweaterNumber))} · ${escapeHtml(p.positionCode || "")}</div>
        </div>
      </div>
      <div class="section-title">Данные игрока</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
        <div><span style="color:var(--silver-dim);">Рождение:</span> <strong>${val(p.birthDate)}</strong></div>
        <div><span style="color:var(--silver-dim);">Страна:</span> <strong>${val(p.birthCountry)}</strong></div>
        <div><span style="color:var(--silver-dim);">Рост:</span> <strong>${p.heightInCentimeters ? p.heightInCentimeters + ' см' : '—'}</strong></div>
        <div><span style="color:var(--silver-dim);">Вес:</span> <strong>${p.weightInKilograms ? p.weightInKilograms + ' кг' : '—'}</strong></div>
      </div>
    `;
  } catch (_) {
    body.innerHTML = '<div class="empty">Не удалось загрузить карточку игрока</div>';
  }
}
