// src/utils/dashboardConstants.js

export const TABS = {
  dashboard: "dashboard", // GM + AM home overview
  policy: "policy",
  decision: "decision",
  coaching: "coaching",
  myLogs: "my_logs",
  teamDecisions: "team_decisions",
  teamCoaching: "team_coaching",
  managers: "managers",
  facilities: "facilities",
};

export const ROLE_LEVELS = {
  Manager: 1,
  "General Manager": 2,
  "Area Coach": 3,
  "Area Manager": 3,
};

export const CATEGORIES = ["HR", "Operations", "Food Safety"];

export const ALL_METRIC_DEFS = [
  { key: "pr", label: "PR%", desc: "Policy Reference Rate", target: 78, unit: "%" },
  { key: "pas", label: "PAS%", desc: "Policy Adherence Score", target: 85, unit: "%" },
  { key: "tpr", label: "TPR%", desc: "Team Performance Rating", target: 91, unit: "%" },
  { key: "ppd", label: "PP/D", desc: "Policy Pull / Documented Decision", target: 38, unit: "%" },
];

export const GM_METRIC_DEFS = ALL_METRIC_DEFS.filter((m) => m.key !== "ppd");
export const AM_METRIC_DEFS = ALL_METRIC_DEFS;

export const PALETTE = {
  bg: "#070f1a",
  panel: "#0c1622",
  panelAlt: "#091420",
  border: "#19273a",
  borderStrong: "#243547",
  text: "#e2eaf4",
  textSoft: "#8fa3b8",
  textMuted: "#5d7a94",
  blue: "#3d6899",
  blueSoft: "rgba(61, 104, 153, 0.13)",
  green: "#4a7c61",
  greenSoft: "rgba(74, 124, 97, 0.13)",
  amber: "#9a7840",
  amberSoft: "rgba(154, 120, 64, 0.13)",
  red: "#8a4848",
  redSoft: "rgba(138, 72, 72, 0.13)",
  indigo: "#6878a8",
  indigoSoft: "rgba(104, 120, 168, 0.13)",
};

export const CATEGORY_STYLES = {
  HR: {
    color: "#7a94be",
    bg: "rgba(122, 148, 190, 0.12)",
    border: "rgba(122, 148, 190, 0.24)",
  },
  Operations: {
    color: "#5e8f88",
    bg: "rgba(94, 143, 136, 0.12)",
    border: "rgba(94, 143, 136, 0.24)",
  },
  "Food Safety": {
    color: "#a08454",
    bg: "rgba(160, 132, 84, 0.12)",
    border: "rgba(160, 132, 84, 0.24)",
  },
};

export const FALLBACK_CATEGORY_KEYWORDS = {
  HR: [
    { keyword: "employee", weight: 2 },
    { keyword: "attendance", weight: 3 },
    { keyword: "late", weight: 2 },
    { keyword: "tardy", weight: 2 },
    { keyword: "call out", weight: 2 },
    { keyword: "no call", weight: 3 },
    { keyword: "no show", weight: 3 },
    { keyword: "write up", weight: 4 },
    { keyword: "harassment", weight: 5 },
    { keyword: "termination", weight: 5 },
    { keyword: "discipline", weight: 4 },
    { keyword: "schedule", weight: 2 },
    { keyword: "shift", weight: 2 },
    { keyword: "payroll", weight: 3 },
    { keyword: "hiring", weight: 3 },
    { keyword: "interview", weight: 2 },
  ],
  Operations: [
    { keyword: "deployment", weight: 4 },
    { keyword: "positioning", weight: 3 },
    { keyword: "labor", weight: 3 },
    { keyword: "ticket times", weight: 4 },
    { keyword: "rush", weight: 2 },
    { keyword: "line", weight: 2 },
    { keyword: "bottleneck", weight: 4 },
    { keyword: "staffing", weight: 3 },
    { keyword: "service", weight: 2 },
    { keyword: "customer flow", weight: 3 },
    { keyword: "drawer", weight: 2 },
    { keyword: "cash", weight: 2 },
    { keyword: "register", weight: 2 },
    { keyword: "coverage", weight: 2 },
    { keyword: "floor", weight: 2 },
    { keyword: "inventory", weight: 3 },
  ],
  "Food Safety": [
    { keyword: "temperature", weight: 4 },
    { keyword: "temp", weight: 3 },
    { keyword: "sanitizer", weight: 4 },
    { keyword: "glove", weight: 2 },
    { keyword: "gloves", weight: 2 },
    { keyword: "expired", weight: 4 },
    { keyword: "expiration", weight: 4 },
    { keyword: "dated", weight: 2 },
    { keyword: "holding", weight: 3 },
    { keyword: "contamination", weight: 5 },
    { keyword: "cross contamination", weight: 5 },
    { keyword: "cook temp", weight: 4 },
    { keyword: "raw", weight: 3 },
    { keyword: "thaw", weight: 3 },
    { keyword: "label", weight: 2 },
    { keyword: "clean", weight: 1 },
    { keyword: "hand wash", weight: 3 },
    { keyword: "food safety", weight: 5 },
  ],
};
