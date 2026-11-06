import { API_BASE } from "./config.js";
import { state } from "./state.js";
import { stopAllVideos, escapeHtml, getPlayerId, nameStr } from "./utils.js";
import { initThemeModule, updateMyTeamButton } from "./modules/theme.js";
import { initScheduleModule, loadSchedule } from "./modules/schedule.js";
import { initStandingsModule, loadStandings, buildSeasonOptions, loadPlayoffBracket } from "./modules/standings.js";
import { initLeadersModule, loadPlayers } from "./modules/leaders.js";
import { loadTransactions } from "./modules/transactions.js";
import { loadNews } from "./modules/news.js";
import { initH2HModule } from "./modules/h2h.js";
import { openPlayerDetail } from "./modules/player_detail.js";

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

export function normalizeInitialSection(section) {
  switch (section) {
    case "schedule":
    case "matches":
      return "schedule";
    case "standings":
    case "table":
      return "standings";
    case "leaders":
    case "players":
    case "goalies":
      return "players";
    case "transactions":
      return "transactions";
    case "news":
      return "news";
    default:
      return "schedule";
  }
}

export function switchTab(tab) {
  stopAllVideos();
  const safeTab = normalizeInitialSection(tab);

  document.getElementById("tab-schedule")?.classList.toggle("active", safeTab === "schedule");
  document.getElementById("tab-standings")?.classList.toggle("active", safeTab === "standings");
  document.getElementById("tab-players")?.classList.toggle("active", safeTab === "players");
  document.getElementById("tab-transactions")?.classList.toggle("active", safeTab === "transactions");
  document.getElementById("tab-news")?.classList.toggle("active", safeTab === "news");

  document.getElementById("view-schedule").style.display = safeTab === "schedule" ? "" : "none";
  document.getElementById("view-standings").style.display = safeTab === "standings" ? "" : "none";
  document.getElementById("view-players").style.display = safeTab === "players" ? "" : "none";
  document.getElementById("view-transactions").style.display = safeTab === "transactions" ? "" : "none";

  const newsView = document.getElementById("view-news");
  if (newsView) newsView.style.display = safeTab === "news" ? "" : "none";

  document.getElementById("view-detail").style.display = "none";
  document.getElementById("main-nav").style.display = "flex";

  state.lastMainTab = safeTab;

  if (safeTab === "schedule") loadSchedule();
  if (safeTab === "standings") {
    loadStandings();
    if (!state.bracketLoadedOnce) {
      const now = new Date();
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const playoffYear = startYear + 1;
      if (now >= new Date(playoffYear, 3, 14)) {
        loadPlayoffBracket(String(playoffYear));
      }
      state.bracketLoadedOnce = true;
    }
  }
  if (safeTab === "players") loadPlayers();
  if (safeTab === "transactions") loadTransactions();
  if (safeTab === "news") loadNews();
}

function initNavigation() {
  document.getElementById("tab-schedule")?.addEventListener("click", () => switchTab("schedule"));
  document.getElementById("tab-standings")?.addEventListener("click", () => switchTab("standings"));
  document.getElementById("tab-players")?.addEventListener("click", () => switchTab("players"));
  document.getElementById("tab-transactions")?.addEventListener("click", () => switchTab("transactions"));
  document.getElementById("tab-news")?.addEventListener("click", () => switchTab("news"));

  document.getElementById("back-btn")?.addEventListener("click", () => {
    stopAllVideos();
    switchTab(state.lastMainTab);
  });
}

function initApp() {
  initThemeModule();
  initScheduleModule();
  initStandingsModule();
  initLeadersModule();
  initH2HModule();
  initNavigation();

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
