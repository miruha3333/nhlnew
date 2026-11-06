export const state = {
  currentDate: new Date(),
  lastMainTab: "schedule",
  myFavoriteTeam: localStorage.getItem("nhl_my_team") || "",
  
  // Таблица
  currentStandingsData: [],
  currentAdvancedTeamsData: [],
  standingsSortKey: "points",
  standingsSortAsc: false,
  advStandingsSortKey: "satPct",
  advStandingsSortAsc: false,
  standingsViewMode: "all",
  selectedSeasonEndDate: "",
  bracketLoadedOnce: false,

  // Лидеры
  leadersMode: "skaters",
  currentCat: "points",
  currentLimit: 25,
  currentGoalieSortKey: "wins",
  currentGoalieSortAsc: false,
  cachedGoaliesList: [],
  cachedSkatersList: [],

  // Карточка команды
  currentTeamFullData: null,
  currentTeamType: "regular",
  currentTeamSortKey: "points",
  currentTeamSortAsc: false,
};

export const goalieHeadshotCache = new Map();
export const h2hTeamCache = new Map();
