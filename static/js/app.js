function switchTab(tab) {
  stopAllVideos();
  const backBtn = document.getElementById("header-back-btn");
  if (backBtn) backBtn.style.display = "none";
  navHistory = [];
  lastMainTab = tab;

  ["schedule", "standings", "players", "transactions", "news"].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle("active", tab === t);
    const view = document.getElementById(`view-${t}`);
    if (view) view.style.display = (tab === t) ? "" : "none";
  });

  const viewDetail = document.getElementById("view-detail");
  if (viewDetail) viewDetail.style.display = "none";
  const mainNav = document.getElementById("main-nav");
  if (mainNav) mainNav.style.display = "flex";

  if (tab === "schedule") loadSchedule();
  if (tab === "standings") loadStandings();
  if (tab === "players") loadPlayers();
  if (tab === "transactions") loadTransactions();
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
document.getElementById("tab-news").onclick = () => switchTab("news");

// Кнопки категорий лидеров (Полевые / Вратари)
document.getElementById("leaders-skaters-btn").onclick = () => {
  leadersMode = "skaters";
  document.getElementById("leaders-skaters-btn").classList.add("active");
  document.getElementById("leaders-goalies-btn").classList.remove("active");
  document.getElementById("skater-categories").style.display = "grid";
  document.getElementById("goalie-categories").style.display = "none";
  loadPlayers();
};

document.getElementById("leaders-goalies-btn").onclick = () => {
  leadersMode = "goalies";
  document.getElementById("leaders-goalies-btn").classList.add("active");
  document.getElementById("leaders-skaters-btn").classList.remove("active");
  document.getElementById("skater-categories").style.display = "none";
  document.getElementById("goalie-categories").style.display = "grid";
  cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
};

// Подкатегории полевых игроков
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
    currentGoalieSortAsc = (currentGoalieSortKey === "gaa");
    cachedGoaliesList.length ? renderGoaliesFromCache() : loadGoalieCards();
  };
});

// Переключатели режимов таблицы
document.getElementById("std-mode-all").onclick = () => setStandingsMode("all");
document.getElementById("std-mode-conf").onclick = () => setStandingsMode("conf");
document.getElementById("std-mode-div").onclick = () => setStandingsMode("div");
document.getElementById("std-mode-adv").onclick = () => setStandingsMode("adv");

// Переключатель исторического сезона таблицы
document.getElementById("season-select")?.addEventListener("change", e => {
  selectedSeasonEndDate = e.target.value;
  currentStandingsData = [];
  currentAdvancedTeamsData = [];
  standingsViewMode === "adv" ? loadAdvancedStandings() : loadStandings();
});

// Модальное окно выбора любимого клуба
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
      if (myFavoriteTeam === chosen) {
        myFavoriteTeam = "";
        localStorage.removeItem("nhl_my_team");
      } else {
        myFavoriteTeam = chosen;
        localStorage.setItem("nhl_my_team", chosen);
      }
      updateMyTeamButton();
      document.getElementById("my-team-modal").style.display = "none";
      if (lastMainTab === "schedule") loadSchedule();
    };
  });
}

// Кнопка доната Tribute
document.getElementById("donate-header-btn").onclick = () => {
  const TRIBUTE_URL = "https://t.me/tribute/app?startapp=dTl8";
  window.openPostInTelegram(TRIBUTE_URL);
};

// Запуск приложения
function initApp() {
  buildSeasonOptions();
  updateMyTeamButton();
  switchTab("schedule");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
