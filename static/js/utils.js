import { HISTORICAL_TEAM_LOGOS } from "./config.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function nameStr(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default || value.name || "";
}

export function val(value, fallback = "—") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

export function formatShortName(fullName, first, last) {
  const f = nameStr(first);
  const l = nameStr(last);
  if (f && l) return `${f.charAt(0).toUpperCase()}. ${l}`;
  const str = String(fullName || "").trim();
  if (!str) return "Игрок";
  const parts = str.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

export function formatPctCell(val) {
  if (val === undefined || val === null || val === "" || isNaN(val)) return "—";
  const n = Number(val);
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

export function fmtDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTeamAbbrev(team) {
  if (!team) return "";
  if (typeof team === "string") return team.trim().toUpperCase();
  if (typeof team === "object") {
    return String(team.default || team.abbrev || team.abbreviation || team.teamAbbrev || "").trim().toUpperCase();
  }
  return "";
}

export function getPlayerId(player) {
  return String(player?.playerId || player?.id || "");
}

export function getSafeTeamLogoUrl(abbrev, fallbackLogo) {
  const up = String(abbrev || "").toUpperCase();
  if (HISTORICAL_TEAM_LOGOS[up]) return HISTORICAL_TEAM_LOGOS[up];
  if (fallbackLogo && typeof fallbackLogo === "string" && fallbackLogo.startsWith("http")) {
    return fallbackLogo;
  }
  return `https://assets.nhle.com/logos/nhl/svg/${up}_light.svg`;
}

export function stopAllVideos() {
  const container = document.getElementById("detail-body");
  if (container) {
    container.querySelectorAll("iframe").forEach(iframe => {
      iframe.src = "about:blank";
      iframe.remove();
    });
    container.querySelectorAll("video").forEach(v => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  }
}
