import { TEAM_COLORS } from "../config.js";
import { state } from "../state.js";
import { loadSchedule } from "./schedule.js";

export function applyTeamTheme(teamAbbr) {
  if (!teamAbbr || !TEAM_COLORS[teamAbbr]) {
    document.documentElement.style.setProperty("--accent", "#1f5fce");
    document.documentElement.style.setProperty("--accent-glow", "rgba(31,95,206,0.35)");
    return;
  }
  const color = TEAM_COLORS[teamAbbr];
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-glow", `${color}55`);
}

export function updateMyTeamButton() {
  const label = document.getElementById("my-team-label");
  if (!label) return;
  if (state.myFavoriteTeam) {
    label.innerHTML = `<img src="https://assets.nhle.com/logos/nhl/svg/${state.myFavoriteTeam}_light.svg" alt="" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${state.myFavoriteTeam}_dark.svg';"> ${state.myFavoriteTeam}`;
    applyTeamTheme(state.myFavoriteTeam);
  } else {
    label.innerHTML = `<img src="https://assets.nhle.com/logos/nhl/svg/nhl_light.svg" alt="" style="width:18px;height:18px;"> Мой клуб`;
    applyTeamTheme("");
  }
}

export function renderTeamSelectorModal() {
  const grid = document.getElementById("team-selector-grid");
  if (!grid) return;
  const teams = Object.keys(TEAM_COLORS).sort();

  grid.innerHTML = teams.map(abbr => `
    <button class="pickem-btn ${state.myFavoriteTeam === abbr ? 'selected' : ''}" data-choose-team="${abbr}" style="padding:10px 4px;">
      <img src="https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg" alt="" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg';">
      <span style="margin-top:4px;">${abbr}</span>
    </button>
  `).join("");

  grid.querySelectorAll("button[data-choose-team]").forEach(btn => {
    btn.onclick = () => {
      const chosen = btn.dataset.chooseTeam;
      if (state.myFavoriteTeam === chosen) {
        state.myFavoriteTeam = "";
        localStorage.removeItem("nhl_my_team");
      } else {
        state.myFavoriteTeam = chosen;
        localStorage.setItem("nhl_my_team", chosen);
      }
      updateMyTeamButton();
      document.getElementById("my-team-modal").style.display = "none";
      if (state.lastMainTab === "schedule") loadSchedule();
    };
  });
}

export function initThemeModule() {
  document.getElementById("my-team-trigger")?.addEventListener("click", () => {
    renderTeamSelectorModal();
    document.getElementById("my-team-modal").style.display = "flex";
  });
  document.getElementById("close-team-modal-btn")?.addEventListener("click", () => {
    document.getElementById("my-team-modal").style.display = "none";
  });
}
