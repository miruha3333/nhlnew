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

  document.getElementById("view-detail").style.display = "none";
  document.getElementById("main-nav").style.display = "grid";

  if (tab === "schedule") loadSchedule();
  if (tab === "standings") loadStandings();
  if (tab === "players") loadPlayers();
  if (tab === "transactions") loadTransactions();
  if (tab === "draft") loadDraft(currentDraftYear);
  if (tab === "news") loadNews();
}

// Нажатие кнопки "Назад" в шапке
document.getElementById("header-back-btn").onclick = handleGoBack;

// Переключение дат матчей
document.getElementById("prev-day").onclick = () => {
  currentDate.setDate(currentDate.getDate() - 1);
  loadSchedule();
};
document.getElementById("next-day").onclick = () => {
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
document.getElementById("tab-schedule").onclick = () => switchTab("schedule");
document.getElementById("tab-standings").onclick = () => switchTab("standings");
document.getElementById("tab-players").onclick = () => switchTab("players");
document.getElementById("tab-transactions").onclick = () => switchTab("transactions");
document.getElementById("tab-draft").onclick = () => switchTab("draft");
document.getElementById("tab-news").onclick = () => switchTab("news");

// Кнопки категорий лидеров (Полевые / Вратари)
document.getElementById("leaders-skaters-btn").onclick = () => {
  leadersMode = "skaters";
  document.getElementById("leaders-skaters-btn").classList.add("active");
  document.getElementById("leaders-goalies-btn").classList.remove("active");
  document.getElementById("skater-categories").style.display = "grid";
  document.getElementById("skater-filters-bar").style.display = "flex";
  document.getElementById("goalie-categories").style.display = "none";
  document.getElementById("goalie-filters-bar").style.display = "none";
  loadPlayers();
};

document.getElementById("leaders-goalies-btn").onclick = () => {
  leadersMode = "goalies";
  document.getElementById("leaders-goalies-btn").classList.add("active");
  document.getElementById("leaders-skaters-btn").classList.remove("active");
  document.getElementById("skater-categories").style.display = "none";
  document.getElementById("skater-filters-bar").style.display = "none";
  document.getElementById("goalie-categories").style.display = "grid";
  document.getElementById("goalie-filters-bar").style.display = "flex";
  cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
};

// Фильтр «Новички» (Calder)
document.getElementById("filter-rookie-toggle").onclick = () => {
  skaterRookieOnly = !skaterRookieOnly;
  document.getElementById("filter-rookie-toggle").classList.toggle("active", skaterRookieOnly);
  loadPlayers();
};

// Фильтры позиций «Защитники» / «Форварды»
document.getElementById("filter-pos-d").onclick = () => {
  skaterPositionFilter = (skaterPositionFilter === "D") ? "ALL" : "D";
  document.getElementById("filter-pos-d").classList.toggle("active", skaterPositionFilter === "D");
  document.getElementById("filter-pos-f").classList.remove("active");
  loadPlayers();
};

document.getElementById("filter-pos-f").onclick = () => {
  skaterPositionFilter = (skaterPositionFilter === "F") ? "ALL" : "F";
  document.getElementById("filter-pos-f").classList.toggle("active", skaterPositionFilter === "F");
  document.getElementById("filter-pos-d").classList.remove("active");
  loadPlayers();
};

// Фильтр вратарей «Мин. 5 матчей»
document.getElementById("goalie-min-filter").onclick = () => {
  goalieMinGames = !goalieMinGames;
  document.getElementById("goalie-min-filter").classList.toggle("active", goalieMinGames);
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
document.getElementById("std-mode-all").onclick = () => setStandingsMode("all");
document.getElementById("std-mode-conf").onclick = () => setStandingsMode("conf");
document.getElementById("std-mode-div").onclick = () => setStandingsMode("div");
document.getElementById("std-mode-adv").onclick = () => setStandingsMode("adv");

// Выбор сезона таблицы
document.getElementById("season-select")?.addEventListener("change", e => {
  selectedSeasonEndDate = e.target.value;
  currentStandingsData = [];
  currentAdvancedTeamsData = [];
  standingsViewMode === "adv" ? loadAdvancedStandings() : loadStandings();
});

// Модалка любимого клуба
document.getElementById("my-team-trigger").onclick = () => {
  renderTeamSelectorModal();
  document.getElementById("my-team-modal").style.display = "flex";
};
document.getElementById("close-team-modal-btn").onclick = () => {
  document.getElementById("my-team-modal").style.display = "none";
};

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

// Донат
document.getElementById("donate-header-btn").onclick = () => {
  const TRIBUTE_URL = "https://t.me/tribute/app?startapp=dTl8";
  window.openPostInTelegram(TRIBUTE_URL);
};

// Запуск
function initApp() {
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
