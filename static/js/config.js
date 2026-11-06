const API_BASE = "https://nhlnew.sergvolk504.workers.dev";
const RENDER_BACKEND = "https://nhl-miniapp.onrender.com";

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// Полный справочник клубов
const NHL_TEAMS_FULL = {
  ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres",
  CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars",
  DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers",
  LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montreal Canadiens",
  NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders",
  NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken",
  STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs",
  UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights",
  WSH: "Washington Capitals", WPG: "Winnipeg Jets"
};

const TEAM_COLORS = {
  ANA: "#F47A38", BOS: "#FFB81C", BUF: "#003087", CGY: "#C8102E",
  CAR: "#CC0000", CHI: "#CF0A2C", COL: "#6F263D", CBJ: "#002654",
  DAL: "#006847", DET: "#CE1126", EDM: "#FF4C00", FLA: "#C8102E",
  LAK: "#A2AAAD", MIN: "#154734", MTL: "#AF1E2D", NSH: "#FFB81C",
  NJD: "#CE1126", NYI: "#00539B", NYR: "#0038A8", OTT: "#DA1A32",
  PHI: "#F74902", PIT: "#FCB514", SJS: "#006D75", SEA: "#001628",
  STL: "#002F87", TBL: "#002868", TOR: "#00205B", UTA: "#69B3E7",
  VAN: "#00205B", VGK: "#B4975A", WSH: "#C8102E", WPG: "#041E42"
};

const HISTORICAL_TEAM_LOGOS = {
  QUE: "https://records.nhle.com/site/asset/public/ext/franchise/logos/17.png",
  ATL: "https://records.nhle.com/site/asset/public/ext/franchise/logos/35.png",
  PHX: "https://records.nhle.com/site/asset/public/ext/franchise/logos/27.png",
  HFD: "https://records.nhle.com/site/asset/public/ext/franchise/logos/26.png",
  WIN: "https://records.nhle.com/site/asset/public/ext/franchise/logos/27.png"
};

const TEAM_STAT_LABELS = {
  sog: "Броски в створ",
  shotsOnGoal: "Броски в створ",
  faceoffWinningPctg: "Вбрасывания, %",
  powerPlayPctg: "Большинство, %",
  penaltyMinutes: "Штраф (мин)",
  hits: "Силовые приёмы",
  blockedShots: "Заблокировано бросков"
};

// ЕДИНСТВЕННОЕ МЕСТО ОБЪЯВЛЕНИЯ ГЛОБАЛЬНЫХ ПЕРЕМЕННЫХ
let lastMainTab = "schedule";
let currentDate = new Date();
let currentCat = "points";
let currentLimit = 25;
let myFavoriteTeam = localStorage.getItem("nhl_my_team") || "";

let currentStandingsData = [];
let currentAdvancedTeamsData = [];
let standingsSortKey = "points";
let standingsSortAsc = false;
let advStandingsSortKey = "satPct";
let advStandingsSortAsc = false;
let standingsViewMode = "all";
let selectedSeasonEndDate = "";

let leadersMode = "skaters";
let currentGoalieSortKey = "wins";
let currentGoalieSortAsc = false;
let cachedGoaliesList = [];
let cachedSkatersList = [];

let currentTeamFullData = null;
const goalieHeadshotCache = new Map();
const h2hTeamCache = new Map();

let navHistory = [];
let isNavigatingBack = false;

// Безопасный загрузчик
async function fetchAPI(endpoint) {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // 1. Пытаемся получить через Cloudflare Worker
  try {
    const res = await fetch(`${API_BASE}${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) return data;
    }
  } catch (err) {
    console.warn(`[API] Ошибка запроса к ${clean}:`, err);
  }

  // 2. Резервный запрос через Render
  try {
    const res2 = await fetch(`${RENDER_BACKEND}${clean}`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && !data2.error) return data2;
    }
  } catch (_) {}

  throw new Error("Не удалось загрузить данные");
}
