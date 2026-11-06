function switchTab(tab) {
  stopAllVideos();
  const backBtn = document.getElementById("header-back-btn");
  if (backBtn) backBtn.style.display = "none";
  navHistory = [];
  lastMainTab = tab;

  ["schedule", "standings", "players", "transactions", "draft", "news"].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle("active", tab === t);
    const view = document.getElementById(`view-${t}`);
    if (view) view.style.display = (tab === t) ? "" : "none";
  });

  const detailView = document.getElementById("view-detail");
  if (detailView) detailView.style.display = "none";
  const mainNav = document.getElementById("main-nav");
  if (mainNav) mainNav.style.display = "grid";

  if (tab === "schedule") loadSchedule();
  if (tab === "standings") loadStandings();
  if (tab === "players") loadPlayers();
  if (tab === "transactions") loadTransactions();
  if (tab === "draft") loadDraft(currentDraftYear);
  if (tab === "news") loadNews();
}

function renderTeamSelectorModal() {
  const grid = document.getElementById("team-selector-grid");
  if (!grid) return;
  const teams = Object.keys(TEAM_COLORS).sort();

  grid.innerHTML = teams.map(abbr => `
    <button class="pickem-btn ${myFavoriteTeam === abbr ? 'selected' : ''}" data-choose-team="${abbr}" style="padding:10px 4px;display:flex;flex-direction:column;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg" alt="" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg';">
      <span style="margin-top:4px;font-family:'Oswald',sans-serif;font-size:12px;color:var(--silver);">${abbr}</span>
    </button>
  `).join("");

  grid.querySelectorAll("button[data-choose-team]").forEach(btn => {
    btn.onclick = () => {
      const chosen = btn.dataset.chooseTeam;
      myFavoriteTeam = (myFavoriteTeam === chosen) ? "" : chosen;
      if (myFavoriteTeam) localStorage.setItem("nhl_my_team", myFavoriteTeam);
      else localStorage.removeItem("nhl_my_team");
      updateMyTeamButton();
      document.getElementById("my-team-modal").style.display = "none";
      if (lastMainTab === "schedule") loadSchedule();
    };
  });
}

function setupListeners() {
  // Нажатие кнопки "Назад" в шапке
  const backBtn = document.getElementById("header-back-btn");
  if (backBtn) backBtn.onclick = handleGoBack;

  // Переключение дат матчей
  const prevDay = document.getElementById("prev-day");
  if (prevDay) prevDay.onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadSchedule();
  };

  const nextDay = document.getElementById("next-day");
  if (nextDay) nextDay.onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadSchedule();
  };

  document.getElementById("date-picker")?.addEventListener("change", e => {
    if (e.target.value) {
      currentDate = new Date(`${e.target.value}T12:00:00`);
      loadSchedule();
    }
  });

  // Кнопки основного меню навигации
  const btnSched = document.getElementById("tab-schedule"); if (btnSched) btnSched.onclick = () => switchTab("schedule");
  const btnStd = document.getElementById("tab-standings"); if (btnStd) btnStd.onclick = () => switchTab("standings");
  const btnPlay = document.getElementById("tab-players"); if (btnPlay) btnPlay.onclick = () => switchTab("players");
  const btnTx = document.getElementById("tab-transactions"); if (btnTx) btnTx.onclick = () => switchTab("transactions");
  const btnDraft = document.getElementById("tab-draft"); if (btnDraft) btnDraft.onclick = () => switchTab("draft");
  const btnNews = document.getElementById("tab-news"); if (btnNews) btnNews.onclick = () => switchTab("news");

  // Кнопки категорий лидеров (Полевые / Вратари)
  const lSkaters = document.getElementById("leaders-skaters-btn");
  if (lSkaters) lSkaters.onclick = () => {
    leadersMode = "skaters";
    document.getElementById("leaders-skaters-btn")?.classList.add("active");
    document.getElementById("leaders-goalies-btn")?.classList.remove("active");
    const sc = document.getElementById("skater-categories"); if (sc) sc.style.display = "grid";
    const sf = document.getElementById("skater-filters-bar"); if (sf) sf.style.display = "flex";
    const gc = document.getElementById("goalie-categories"); if (gc) gc.style.display = "none";
    const gf = document.getElementById("goalie-filters-bar"); if (gf) gf.style.display = "none";
    loadPlayers();
  };

  const lGoalies = document.getElementById("leaders-goalies-btn");
  if (lGoalies) lGoalies.onclick = () => {
    leadersMode = "goalies";
    document.getElementById("leaders-goalies-btn")?.classList.add("active");
    document.getElementById("leaders-skaters-btn")?.classList.remove("active");
    const sc = document.getElementById("skater-categories"); if (sc) sc.style.display = "none";
    const sf = document.getElementById("skater-filters-bar"); if (sf) sf.style.display = "none";
    const gc = document.getElementById("goalie-categories"); if (gc) gc.style.display = "grid";
    const gf = document.getElementById("goalie-filters-bar"); if (gf) gf.style.display = "flex";
    cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
  };

  // Фильтр «Новички» (Calder)
  const fRookie = document.getElementById("filter-rookie-toggle");
  if (fRookie) fRookie.onclick = () => {
    skaterRookieOnly = !skaterRookieOnly;
    fRookie.classList.toggle("active", skaterRookieOnly);
    loadPlayers();
  };

  // Фильтры позиций «Защитники» / «Форварды»
  const fPosD = document.getElementById("filter-pos-d");
  if (fPosD) fPosD.onclick = () => {
    skaterPositionFilter = (skaterPositionFilter === "D") ? "ALL" : "D";
    fPosD.classList.toggle("active", skaterPositionFilter === "D");
    document.getElementById("filter-pos-f")?.classList.remove("active");
    loadPlayers();
  };

  const fPosF = document.getElementById("filter-pos-f");
  if (fPosF) fPosF.onclick = () => {
    skaterPositionFilter = (skaterPositionFilter === "F") ? "ALL" : "F";
    fPosF.classList.toggle("active", skaterPositionFilter === "F");
    document.getElementById("filter-pos-d")?.classList.remove("active");
    loadPlayers();
  };

  // Фильтр вратарей «Мин. 5 матчей»
  const gMin = document.getElementById("goalie-min-filter");
  if (gMin) gMin.onclick = () => {
    goalieMinGames = !goalieMinGames;
    gMin.classList.toggle("active", goalieMinGames);
    renderGoaliesFromCache();
  };

  // Подкатегории полевых
  document.querySelectorAll("#skater-categories button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#skater-categories button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentCat = b.dataset.cat;
      loadPlayers();
    };
  });

  // Подкатегории вратарей
  document.querySelectorAll("#goalie-categories button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#goalie-categories button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentGoalieSortKey = b.dataset.goalieSort;
      currentGoalieSortAsc = (currentGoalieSortKey === "gaa" || currentGoalieSortKey === "losses");
      cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
    };
  });

  // Выбор года драфта
  document.getElementById("draft-year-select")?.addEventListener("change", e => {
    currentDraftYear = e.target.value;
    loadDraft(currentDraftYear);
  });

  // Режимы таблицы
  const mAll = document.getElementById("std-mode-all"); if (mAll) mAll.onclick = () => setStandingsMode("all");
  const mConf = document.getElementById("std-mode-conf"); if (mConf) mConf.onclick = () => setStandingsMode("conf");
  const mDiv = document.getElementById("std-mode-div"); if (mDiv) mDiv.onclick = () => setStandingsMode("div");
  const mAdv = document.getElementById("std-mode-adv"); if (mAdv) mAdv.onclick = () => setStandingsMode("adv");

  // Выбор сезона таблицы
  document.getElementById("season-select")?.addEventListener("change", e => {
    selectedSeasonEndDate = e.target.value;
    currentStandingsData = [];
    currentAdvancedTeamsData = [];
    standingsViewMode === "adv" ? loadAdvancedStandings() : loadStandings();
  });

  // Модалка любимого клуба
  const myTeamTrigger = document.getElementById("my-team-trigger");
  if (myTeamTrigger) myTeamTrigger.onclick = () => {
    renderTeamSelectorModal();
    const modal = document.getElementById("my-team-modal");
    if (modal) modal.style.display = "flex";
  };

  const closeTeamBtn = document.getElementById("close-team-modal-btn");
  if (closeTeamBtn) closeTeamBtn.onclick = () => {
    const modal = document.getElementById("my-team-modal");
    if (modal) modal.style.display = "none";
  };

  // Донат
  const donateBtn = document.getElementById("donate-header-btn");
  if (donateBtn) donateBtn.onclick = () => {
    const TRIBUTE_URL = "https://t.me/tribute/app?startapp=dTl8";
    window.openPostInTelegram(TRIBUTE_URL);
  };
}

// Запуск
function initApp() {
  setupListeners();
  buildSeasonOptions();
  updateMyTeamButton();
  const params = new URLSearchParams(window.location.search);
  const rawSection = params.get("section") || "schedule";
  switchTab(rawSection);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
