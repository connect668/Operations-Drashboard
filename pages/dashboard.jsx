import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = {
  dashboard: "dashboard",       // GM + AM home overview
  policy: "policy",
  decision: "decision",
  coaching: "coaching",
  myLogs: "my_logs",
  teamDecisions: "team_decisions",
  teamCoaching: "team_coaching",
  managers: "managers",
  facilities: "facilities",
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE LEVELS
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_LEVELS = {
  Manager: 1,
  "General Manager": 2,
  "Area Coach": 3,
  "Area Manager": 3,
};

const CATEGORIES = ["HR", "Operations", "Food Safety"];

// ─────────────────────────────────────────────────────────────────────────────
// METRIC DEFINITIONS
// GM sees PR / PAS / TPR only.  AM sees all four including PP/D.
// ─────────────────────────────────────────────────────────────────────────────
const ALL_METRIC_DEFS = [
  { key: "pr",  label: "PR%",  desc: "Policy Reference Rate",             target: 78, unit: "%" },
  { key: "pas", label: "PAS%", desc: "Policy Adherence Score",            target: 85, unit: "%" },
  { key: "tpr", label: "TPR%", desc: "Team Performance Rating",           target: 91, unit: "%" },
  { key: "ppd", label: "PP/D", desc: "Policy Pull / Documented Decision", target: 38, unit: "%" },
];

const GM_METRIC_DEFS = ALL_METRIC_DEFS.filter((m) => m.key !== "ppd");
const AM_METRIC_DEFS = ALL_METRIC_DEFS;

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE  — muted, executive, dark SaaS
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:           "#070f1a",
  panel:        "#0c1622",
  panelAlt:     "#091420",
  border:       "#19273a",
  borderStrong: "#243547",
  text:         "#e2eaf4",
  textSoft:     "#8fa3b8",
  textMuted:    "#5d7a94",
  // blues — deep navy
  blue:         "#3d6899",
  blueSoft:     "rgba(61, 104, 153, 0.13)",
  // greens — deeper forest
  green:        "#4a7c61",
  greenSoft:    "rgba(74, 124, 97, 0.13)",
  // ambers — earthy, not neon
  amber:        "#9a7840",
  amberSoft:    "rgba(154, 120, 64, 0.13)",
  // reds — dark, serious
  red:          "#8a4848",
  redSoft:      "rgba(138, 72, 72, 0.13)",
  // indigo accent
  indigo:       "#6878a8",
  indigoSoft:   "rgba(104, 120, 168, 0.13)",
};

const CATEGORY_STYLES = {
  HR: {
    color:  "#7a94be",
    bg:     "rgba(122, 148, 190, 0.12)",
    border: "rgba(122, 148, 190, 0.24)",
  },
  Operations: {
    color:  "#5e8f88",
    bg:     "rgba(94, 143, 136, 0.12)",
    border: "rgba(94, 143, 136, 0.24)",
  },
  "Food Safety": {
    color:  "#a08454",
    bg:     "rgba(160, 132, 84, 0.12)",
    border: "rgba(160, 132, 84, 0.24)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD MAP (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_CATEGORY_KEYWORDS = {
  HR: [
    { keyword: "employee",   weight: 2 },
    { keyword: "attendance", weight: 3 },
    { keyword: "late",       weight: 2 },
    { keyword: "tardy",      weight: 2 },
    { keyword: "call out",   weight: 2 },
    { keyword: "no call",    weight: 3 },
    { keyword: "no show",    weight: 3 },
    { keyword: "write up",   weight: 4 },
    { keyword: "harassment", weight: 5 },
    { keyword: "termination",weight: 5 },
    { keyword: "discipline", weight: 4 },
    { keyword: "schedule",   weight: 2 },
    { keyword: "shift",      weight: 2 },
    { keyword: "payroll",    weight: 3 },
    { keyword: "hiring",     weight: 3 },
    { keyword: "interview",  weight: 2 },
  ],
  Operations: [
    { keyword: "deployment",   weight: 4 },
    { keyword: "positioning",  weight: 3 },
    { keyword: "labor",        weight: 3 },
    { keyword: "ticket times", weight: 4 },
    { keyword: "rush",         weight: 2 },
    { keyword: "line",         weight: 2 },
    { keyword: "bottleneck",   weight: 4 },
    { keyword: "staffing",     weight: 3 },
    { keyword: "service",      weight: 2 },
    { keyword: "customer flow",weight: 3 },
    { keyword: "drawer",       weight: 2 },
    { keyword: "cash",         weight: 2 },
    { keyword: "register",     weight: 2 },
    { keyword: "coverage",     weight: 2 },
    { keyword: "floor",        weight: 2 },
    { keyword: "inventory",    weight: 3 },
  ],
  "Food Safety": [
    { keyword: "temperature",       weight: 4 },
    { keyword: "temp",              weight: 3 },
    { keyword: "sanitizer",         weight: 4 },
    { keyword: "glove",             weight: 2 },
    { keyword: "gloves",            weight: 2 },
    { keyword: "expired",           weight: 4 },
    { keyword: "expiration",        weight: 4 },
    { keyword: "dated",             weight: 2 },
    { keyword: "holding",           weight: 3 },
    { keyword: "contamination",     weight: 5 },
    { keyword: "cross contamination",weight: 5 },
    { keyword: "cook temp",         weight: 4 },
    { keyword: "raw",               weight: 3 },
    { keyword: "thaw",              weight: 3 },
    { keyword: "label",             weight: 2 },
    { keyword: "clean",             weight: 1 },
    { keyword: "hand wash",         weight: 3 },
    { keyword: "food safety",       weight: 5 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getNextRole(role) {
  if (role === "Manager") return "General Manager";
  if (role === "General Manager") return "Area Coach";
  return null;
}

function formatDate(value) {
  if (!value) return "Unknown date";
  try { return new Date(value).toLocaleString(); }
  catch { return value; }
}

function applyCompanyScope(query, scope) {
  if (scope?.company_id) return query.eq("company_id", scope.company_id);
  if (scope?.company)    return query.eq("company",    scope.company);
  return query;
}

function getCategoryStyle(category) {
  return (
    CATEGORY_STYLES[category] || {
      color:  PALETTE.textSoft,
      bg:     "rgba(148, 163, 184, 0.08)",
      border: "rgba(148, 163, 184, 0.18)",
    }
  );
}

// PP/D: < 38 green · 38–55 amber · > 55 red
// All other metrics: ≥ 85 green · ≥ 70 amber · < 70 red
function scoreMetricColor(metricKey, value) {
  if (metricKey === "ppd") {
    if (value < 38) return PALETTE.green;
    if (value > 55) return PALETTE.red;
    return PALETTE.amber;
  }
  if (value >= 85) return PALETTE.green;
  if (value >= 70) return PALETTE.amber;
  return PALETTE.red;
}

function resolveCategory(item) { return item?.category || null; }

function buildKeywordMapFromRows(rows) {
  const map = { HR: [], Operations: [], "Food Safety": [] };
  rows.forEach((row) => {
    if (map[row.category]) map[row.category].push({ keyword: row.keyword, weight: row.weight || 1 });
  });
  return map;
}

function detectCategory(situation = "", action = "", keywordMap = FALLBACK_CATEGORY_KEYWORDS) {
  const text = `${situation} ${action}`.toLowerCase().trim();
  if (!text) return { category: "", confidence: "review", score: 0 };

  const scores = Object.entries(keywordMap).map(([category, keywords]) => ({
    category,
    score: keywords.reduce(
      (t, e) => (text.includes(String(e.keyword).toLowerCase()) ? t + Number(e.weight || 1) : t),
      0
    ),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];

  if (!top || top.score <= 0) return { category: "", confidence: "review", score: 0 };
  if (second && top.score === second.score) return { category: "", confidence: "review", score: top.score };
  if (top.score >= 8) return { category: top.category, confidence: "high",   score: top.score };
  if (top.score >= 4) return { category: top.category, confidence: "medium", score: top.score };
  return { category: top.category, confidence: "low", score: top.score };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────
// These functions provide deterministic mock values seeded from facility number.
// SWAP these with real Supabase queries when the backend is ready.
// Each returns: { pr, pas, tpr, ppd }   (ppd optional)
// ─────────────────────────────────────────────────────────────────────────────

function seedFromFacility(facilityNumber = "") {
  const cleaned = String(facilityNumber).replace(/\D/g, "");
  const base = cleaned ? Number(cleaned) : 7;
  return Number.isNaN(base) ? 7 : base;
}

/** GM facility-level snapshot — PR, PAS, TPR */
function getMockGmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr:  72 + (s % 10),
    pas: 80 + (s % 8),
    tpr: 85 + (s % 9),
    ppd: null,
  };
}

/** AM area-level aggregate — PR, PAS, TPR, PP/D */
function getMockAmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr:  74 + (s % 8),
    pas: 82 + (s % 7),
    tpr: 87 + (s % 7),
    ppd: 33  + (s % 12),
  };
}

/** AM territory table — 4 mock facilities */
function getMockTerritoryFacilities(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return [
    { number: `#${1040 + (s % 7)}`,           pr: 76 + (s % 8),        pas: 83 + (s % 6),        tpr: 88 + (s % 6),        ppd: 29 + (s % 10) },
    { number: `#${1048 + ((s + 3) % 7)}`,      pr: 70 + ((s * 2) % 10), pas: 80 + (s % 7),        tpr: 85 + ((s * 2) % 6),  ppd: 40 + (s % 14) },
    { number: `#${1060 + (s % 9)}`,            pr: 78 + (s % 7),        pas: 85 + (s % 5),        tpr: 90 + (s % 5),        ppd: 27 + ((s * 3) % 8) },
    { number: `#${1070 + ((s + 5) % 9)}`,      pr: 66 + ((s * 3) % 12), pas: 77 + (s % 8),        tpr: 83 + (s % 7),        ppd: 52 + (s % 10) },
  ];
}

/** Facility-level metrics used in the Facilities tab (Area Manager) */
function getMockFacilityMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return { pr: 72 + (s % 9), pas: 80 + (s % 8), tpr: 84 + (s % 10), ppd: 34 + (s % 9) };
}

/** Category breakdown for a single facility */
function getMockBreakdown(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  const hr  = 32 + (s % 18);
  const ops = 28 + ((s * 2) % 20);
  const food = Math.max(15, 100 - hr - ops);
  const total = hr + ops + food;
  return [
    { category: "HR",          category_percent: +((hr   / total) * 100).toFixed(2) },
    { category: "Operations",  category_percent: +((ops  / total) * 100).toFixed(2) },
    { category: "Food Safety", category_percent: +((food / total) * 100).toFixed(2) },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC LOADING  (async wrappers — swap internals for real queries later)
// ─────────────────────────────────────────────────────────────────────────────

/** Load GM dashboard metrics. Replace body with real Supabase query. */
async function loadGmDashboardMetrics(profile) {
  // TODO: real query →
  // const { data } = await supabase.from("facility_metrics")
  //   .select("pr_percent, pas_percent, tpr_percent")
  //   .eq("facility_number", profile.facility_number)
  //   .eq("company_id", profile.company_id)
  //   .maybeSingle();
  // if (data) return { pr: data.pr_percent, pas: data.pas_percent, tpr: data.tpr_percent, ppd: null };
  return getMockGmMetrics(profile?.facility_number);
}

/** Load AM dashboard metrics. Replace body with real Supabase query. */
async function loadAmDashboardMetrics(profile) {
  // TODO: real query →
  // const { data } = await supabase.from("area_metrics")
  //   .select("pr_percent, pas_percent, tpr_percent, ppd_percent")
  //   .eq("area_manager_id", profile.id)
  //   .maybeSingle();
  // if (data) return { pr: data.pr_percent, pas: data.pas_percent, tpr: data.tpr_percent, ppd: data.ppd_percent };
  return getMockAmMetrics(profile?.facility_number);
}

/** Load AM territory facilities. Replace body with real Supabase query. */
async function loadAmTerritoryData(profile) {
  // TODO: real query →
  // const { data } = await supabase.from("area_manager_facilities")
  //   .select("facility_number, pr_percent, pas_percent, tpr_percent, ppd_percent")
  //   .eq("area_manager_id", profile.id);
  // if (data?.length) return data.map(f => ({ number: `#${f.facility_number}`, ... }));
  return getMockTerritoryFacilities(profile?.facility_number);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

/** Runs a requestAnimationFrame count-up from 0 → target. Returns cancel fn. */
function animateMetrics(targetMetrics, setAnimated, duration = 1300) {
  const start = performance.now();
  const keys = Object.keys(targetMetrics).filter((k) => targetMetrics[k] != null);

  let rafId;
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const next = {};
    keys.forEach((k) => { next[k] = Math.round(targetMetrics[k] * eased); });
    setAnimated((prev) => ({ ...prev, ...next }));
    if (t < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

function normalizeBreakdownRows(rows, facilityNumber) {
  if (!rows?.length) return getMockBreakdown(facilityNumber);
  const map = { HR: 0, Operations: 0, "Food Safety": 0 };
  rows.forEach((r) => { if (map[r.category] !== undefined) map[r.category] = Number(r.category_percent || 0); });
  return CATEGORIES.map((c) => ({ category: c, category_percent: map[c] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ metric, value }) {
  const color = scoreMetricColor(metric.key, value);
  const barWidth = Math.max(0, Math.min(100, value));
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{metric.label}</div>
      <div style={{ ...styles.metricValue, color }}>
        {Math.round(value)}{metric.unit}
      </div>
      <div style={styles.metricBarTrack}>
        <div style={{ ...styles.metricBarFill, width: `${barWidth}%`, background: color }} />
      </div>
      <div style={styles.metricDesc}>{metric.desc}</div>
      {metric.key === "ppd" && (
        <div style={styles.metricTarget}>Target: under 38%</div>
      )}
    </div>
  );
}

function CategoryBadge({ category }) {
  if (!category) return null;
  const tone = getCategoryStyle(category);
  return (
    <span style={{ ...styles.categoryBadge, color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
      {category}
    </span>
  );
}

function DecisionCard({ item, title, meta, formatDateFn, actions }) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{title}</div>
          {meta && <div style={styles.feedMeta}>{meta}</div>}
        </div>
        <div style={styles.feedDate}>{formatDateFn(item.created_at)}</div>
      </div>
      <div style={styles.feedInlineRow}>
        <CategoryBadge category={resolveCategory(item)} />
        {item.policy_referenced && <span style={styles.policyTag}>Policy: {item.policy_referenced}</span>}
        {item.is_read === false && <span style={styles.unreadBadge}>Unread</span>}
      </div>
      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Situation</div>
        <div style={styles.feedBody}>{item.situation || "—"}</div>
      </div>
      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Action Taken</div>
        <div style={styles.feedBody}>{item.action_taken || "—"}</div>
      </div>
      {actions && <div style={styles.actionRow}>{actions}</div>}
    </div>
  );
}

function CoachingCard({ item, formatDateFn }) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{formatDateFn(item.created_at)}</div>
          <div style={styles.feedMeta}>{item.status || "open"}</div>
        </div>
      </div>
      <div style={styles.feedBody}>{item.request_text || "—"}</div>
      {item.leadership_notes && (
        <div style={styles.guidanceBlock}>
          <div style={styles.guidanceLabel}>Guidance</div>
          <div style={styles.feedBody}>{item.leadership_notes}</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TERRITORY TABLE (AM-specific sub-component)
// ─────────────────────────────────────────────────────────────────────────────
function TerritoryTable({ facilities }) {
  return (
    <div style={styles.territoryTableWrap}>
      <div style={styles.territoryHeaderRow}>
        <div style={{ ...styles.territoryCell, flex: "0 0 88px", ...styles.territoryCellLabel }}>Facility</div>
        {AM_METRIC_DEFS.map((m) => (
          <div key={m.key} style={{ ...styles.territoryCell, ...styles.territoryCellLabel }}>{m.label}</div>
        ))}
        <div style={{ ...styles.territoryCell, flex: "0 0 96px", ...styles.territoryCellLabel }}>Status</div>
      </div>

      {facilities.map((fac) => {
        const colors = {
          pr:  scoreMetricColor("pr",  fac.pr),
          pas: scoreMetricColor("pas", fac.pas),
          tpr: scoreMetricColor("tpr", fac.tpr),
          ppd: scoreMetricColor("ppd", fac.ppd),
        };
        const alertCount = Object.values(colors).filter((c) => c === PALETTE.red).length;
        const warnCount  = Object.values(colors).filter((c) => c === PALETTE.amber).length;
        const statusLabel = alertCount > 0 ? "Alert" : warnCount > 1 ? "Attention" : "On Track";
        const statusColor = alertCount > 0 ? PALETTE.red : warnCount > 1 ? PALETTE.amber : PALETTE.green;
        const statusBg    = alertCount > 0 ? PALETTE.redSoft : warnCount > 1 ? PALETTE.amberSoft : PALETTE.greenSoft;
        const statusBorder= alertCount > 0
          ? "rgba(138,72,72,0.26)"
          : warnCount > 1
          ? "rgba(154,120,64,0.26)"
          : "rgba(74,124,97,0.26)";

        return (
          <div key={fac.number} style={styles.territoryDataRow}>
            <div style={{ ...styles.territoryCell, flex: "0 0 88px", fontWeight: 700, color: PALETTE.text, fontSize: "14px" }}>
              {fac.number}
            </div>
            {[
              { key: "pr",  val: fac.pr  },
              { key: "pas", val: fac.pas },
              { key: "tpr", val: fac.tpr },
              { key: "ppd", val: fac.ppd },
            ].map(({ key, val }) => (
              <div key={key} style={{ ...styles.territoryCell, color: colors[key], fontWeight: 700, fontSize: "14px" }}>
                {val}%
              </div>
            ))}
            <div style={{ ...styles.territoryCell, flex: "0 0 96px" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "4px 9px", borderRadius: "999px",
                fontSize: "11px", fontWeight: 700,
                background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor,
                letterSpacing: "0.04em",
              }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                {statusLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── core auth state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TABS.policy);
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── form state ───────────────────────────────────────────────────────────
  const [policyText,          setPolicyText]          = useState("");
  const [decisionSituation,   setDecisionSituation]   = useState("");
  const [decisionAction,      setDecisionAction]      = useState("");
  const [decisionCategory,    setDecisionCategory]    = useState("");
  const [decisionPolicy,      setDecisionPolicy]      = useState("");
  const [coachingText,        setCoachingText]        = useState("");
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);

  // ── message state ────────────────────────────────────────────────────────
  const [policyMessage,        setPolicyMessage]        = useState("");
  const [decisionMessage,      setDecisionMessage]      = useState("");
  const [coachingMessage,      setCoachingMessage]      = useState("");
  const [teamDecisionsMessage, setTeamDecisionsMessage] = useState("");
  const [teamCoachingMessage,  setTeamCoachingMessage]  = useState("");
  const [managersMessage,      setManagersMessage]      = useState("");
  const [facilitiesMessage,    setFacilitiesMessage]    = useState("");

  // ── loading flags ────────────────────────────────────────────────────────
  const [decisionLoading,        setDecisionLoading]        = useState(false);
  const [coachingLoading,        setCoachingLoading]        = useState(false);
  const [teamDecisionsLoading,   setTeamDecisionsLoading]   = useState(false);
  const [teamCoachingLoading,    setTeamCoachingLoading]    = useState(false);
  const [managersLoading,        setManagersLoading]        = useState(false);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);
  const [myLogsLoading,          setMyLogsLoading]          = useState(false);
  const [facilitiesLoading,      setFacilitiesLoading]      = useState(false);
  const [facilityPeopleLoading,  setFacilityPeopleLoading]  = useState(false);
  const [personFileLoading,      setPersonFileLoading]      = useState(false);
  const [dashboardLoading,       setDashboardLoading]       = useState(false);

  // ── guidance ─────────────────────────────────────────────────────────────
  const [guidanceActiveId,     setGuidanceActiveId]     = useState(null);
  const [guidanceText,         setGuidanceText]         = useState("");
  const [guidanceSubmittingId, setGuidanceSubmittingId] = useState(null);

  // ── GM dashboard metrics ─────────────────────────────────────────────────
  const [gmMetrics,         setGmMetrics]         = useState({ pr: 0, pas: 0, tpr: 0 });
  const [gmAnimatedMetrics, setGmAnimatedMetrics] = useState({ pr: 0, pas: 0, tpr: 0 });

  // ── AM dashboard metrics ─────────────────────────────────────────────────
  const [amMetrics,              setAmMetrics]              = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [amAnimatedMetrics,      setAmAnimatedMetrics]      = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [amTerritoryFacilities,  setAmTerritoryFacilities]  = useState([]);

  // ── team / manager data ───────────────────────────────────────────────────
  const [teamDecisions,          setTeamDecisions]          = useState([]);
  const [teamCoachingRequests,   setTeamCoachingRequests]   = useState([]);
  const [managers,               setManagers]               = useState([]);
  const [selectedManager,        setSelectedManager]        = useState(null);
  const [selectedManagerDecisions, setSelectedManagerDecisions] = useState([]);
  const [selectedManagerCoaching,  setSelectedManagerCoaching]  = useState([]);
  const [managerFileTab,         setManagerFileTab]         = useState(null);

  // ── my logs ──────────────────────────────────────────────────────────────
  const [myLogType,   setMyLogType]   = useState(null);
  const [myDecisions, setMyDecisions] = useState([]);
  const [myCoaching,  setMyCoaching]  = useState([]);

  // ── facilities (AM view) ──────────────────────────────────────────────────
  const [facilities,      setFacilities]      = useState([]);
  const [selectedFacility,setSelectedFacility]= useState(null);
  const [facilityPeople,  setFacilityPeople]  = useState([]);
  const [selectedPerson,  setSelectedPerson]  = useState(null);
  const [personDecisions, setPersonDecisions] = useState([]);
  const [personCoaching,  setPersonCoaching]  = useState([]);
  const [personFileTab,   setPersonFileTab]   = useState("decisions");

  const [facilityMetrics,         setFacilityMetrics]         = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [animatedFacilityMetrics, setAnimatedFacilityMetrics] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [facilityBreakdown,       setFacilityBreakdown]       = useState(getMockBreakdown(""));

  // ── misc ─────────────────────────────────────────────────────────────────
  const [isMobile,      setIsMobile]      = useState(false);
  const [mobileMenuOpen,setMobileMenuOpen]= useState(false);
  const [keywordMap,    setKeywordMap]    = useState(FALLBACK_CATEGORY_KEYWORDS);

  // ── derived role flags ────────────────────────────────────────────────────
  const currentRoleLevel     = useMemo(() => ROLE_LEVELS[profile?.role] || 1, [profile]);
  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const canViewFacilities     = profile?.role === "Area Manager" || profile?.role === "Area Coach";
  const canRequestCoaching    = profile?.role === "Manager";
  const isAreaManager         = profile?.role === "Area Manager";
  const isGeneralManager      = profile?.role === "General Manager";
  const hasDashboard          = isGeneralManager || isAreaManager;
  const nextRole              = getNextRole(profile?.role);

  const autoDetectedCategory = useMemo(
    () => detectCategory(decisionSituation, decisionAction, keywordMap),
    [decisionSituation, decisionAction, keywordMap]
  );

  // ── EFFECTS ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!authUser) { window.location.href = "/"; return; }
        setUser(authUser);
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", authUser.id)
          .maybeSingle();
        setProfile(prof || null);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const loadKeywords = async () => {
      try {
        const { data, error } = await supabase
          .from("decision_category_keywords")
          .select("category, keyword, weight, is_active")
          .eq("is_active", true);
        if (!error && data?.length) setKeywordMap(buildKeywordMapFromRows(data));
      } catch (err) { console.warn("Keyword fallback active:", err); }
    };
    loadKeywords();
  }, []);

  useEffect(() => {
    if (!categoryManuallySet) setDecisionCategory(autoDetectedCategory.category || "");
  }, [autoDetectedCategory, categoryManuallySet]);

  // Facility metrics animation (Facilities tab)
  useEffect(() => {
    if (!selectedFacility) { setAnimatedFacilityMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 }); return; }
    return animateMetrics(facilityMetrics, setAnimatedFacilityMetrics);
  }, [facilityMetrics, selectedFacility]);

  // GM dashboard animation
  useEffect(() => {
    if (!Object.values(gmMetrics).some((v) => v > 0)) { setGmAnimatedMetrics({ pr: 0, pas: 0, tpr: 0 }); return; }
    return animateMetrics(gmMetrics, setGmAnimatedMetrics);
  }, [gmMetrics]);

  // AM dashboard animation
  useEffect(() => {
    if (!Object.values(amMetrics).some((v) => v > 0)) { setAmAnimatedMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 }); return; }
    return animateMetrics(amMetrics, setAmAnimatedMetrics);
  }, [amMetrics]);

  // ── HANDLERS ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handlePullPolicy = async () => {
    setPolicyMessage("");
    if (!policyText.trim()) { setPolicyMessage("Please describe the situation first."); return; }
    const detected = detectCategory(policyText, "", keywordMap);
    try {
      const { error } = await supabase.from("policy_pull_logs").insert([{
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        user_role: profile?.role || null,
        situation_text: policyText.trim(),
        category: detected.category || null,
        policy_query: policyText.trim(),
        policy_result_used: false,
      }]);
      if (error) throw error;
      setPolicyMessage("Policy pull logged. AI response layer comes next.");
    } catch (err) {
      console.error("Policy pull log error:", err);
      setPolicyMessage("Policy pull logging failed. Check policy_pull_logs setup.");
    }
  };

  const handleDecisionSubmit = async () => {
    setDecisionMessage("");
    if (!decisionSituation.trim() || !decisionAction.trim()) {
      setDecisionMessage("Please enter both the situation and action taken."); return;
    }
    const detected = detectCategory(decisionSituation, decisionAction, keywordMap);
    const finalCategory = categoryManuallySet ? decisionCategory : decisionCategory || detected.category;
    if (!finalCategory) { setDecisionMessage("Please select a category."); return; }
    if (!user)          { setDecisionMessage("You must be logged in.");    return; }
    setDecisionLoading(true);
    try {
      const { error } = await supabase.from("decision_logs").insert([{
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        user_name: profile?.full_name || "Unknown",
        user_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        situation: decisionSituation.trim(),
        action_taken: decisionAction.trim(),
        category: finalCategory,
        category_source: categoryManuallySet ? "manual" : "auto",
        category_confidence: categoryManuallySet ? "high" : detected.confidence,
        category_score: categoryManuallySet ? null : detected.score,
        policy_referenced: decisionPolicy.trim() || null,
        is_read: false,
      }]);
      if (error) throw error;
      setDecisionSituation(""); setDecisionAction(""); setDecisionCategory("");
      setDecisionPolicy(""); setCategoryManuallySet(false);
      setDecisionMessage("Decision submitted successfully.");
    } catch (err) {
      console.error("Decision submit error:", err);
      setDecisionMessage(err.message || "Failed to submit decision.");
    } finally { setDecisionLoading(false); }
  };

  const handleCoachingSubmit = async () => {
    setCoachingMessage("");
    if (!coachingText.trim()) { setCoachingMessage("Please describe the support you need."); return; }
    if (!user)                { setCoachingMessage("You must be logged in.");               return; }
    setCoachingLoading(true);
    try {
      const { error } = await supabase.from("coaching_requests").insert([{
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        requester_name: profile?.full_name || "Unknown",
        requester_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        request_text: coachingText.trim(),
        status: "open",
      }]);
      if (error) throw error;
      setCoachingText("");
      setCoachingMessage("Coaching request submitted.");
    } catch (err) {
      console.error("Coaching submit error:", err);
      setCoachingMessage(err.message || "Failed to submit coaching request.");
    } finally { setCoachingLoading(false); }
  };

  const fetchTeamDecisions = async () => {
    if (!profile?.role) return;
    setTeamDecisionsLoading(true); setTeamDecisionsMessage("");
    try {
      let q = supabase.from("decision_logs").select("*")
        .eq("visible_to_role", profile.role).eq("is_read", false)
        .neq("user_id", user?.id || "").order("created_at", { ascending: false });
      q = applyCompanyScope(q, profile);
      const { data, error } = await q;
      if (error) throw error;
      setTeamDecisions(data || []);
    } catch (err) {
      console.error("Fetch team decisions error:", err);
      setTeamDecisionsMessage(err.message || "Failed to load team decisions.");
    } finally { setTeamDecisionsLoading(false); }
  };

  const fetchTeamCoachingRequests = async () => {
    if (!profile?.role) return;
    setTeamCoachingLoading(true); setTeamCoachingMessage("");
    try {
      let q = supabase.from("coaching_requests").select("*")
        .eq("visible_to_role", profile.role).neq("user_id", user?.id || "")
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });
      q = applyCompanyScope(q, profile);
      const { data, error } = await q;
      if (error) throw error;
      setTeamCoachingRequests(data || []);
    } catch (err) {
      console.error("Fetch team coaching error:", err);
      setTeamCoachingMessage(err.message || "Failed to load team coaching.");
    } finally { setTeamCoachingLoading(false); }
  };

  const fetchManagers = async () => {
    if (!profile?.company && !profile?.company_id) return;
    setManagersLoading(true); setManagersMessage("");
    try {
      let q = supabase.from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("role", "Manager").order("full_name", { ascending: true });
      q = applyCompanyScope(q, profile);
      const { data, error } = await q;
      if (error) throw error;
      setManagers(data || []);
    } catch (err) {
      console.error("Fetch managers error:", err);
      setManagersMessage(err.message || "Failed to load managers.");
    } finally { setManagersLoading(false); }
  };

  const openManagerFile = async (manager) => {
    setSelectedManager(manager); setSelectedManagerLoading(true);
    setManagersMessage(""); setManagerFileTab(null);
    try {
      const [{ data: decisions, error: de }, { data: coaching, error: ce }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
      ]);
      if (de) throw de; if (ce) throw ce;
      setSelectedManagerDecisions(decisions || []);
      setSelectedManagerCoaching(coaching || []);
    } catch (err) {
      console.error("Open manager file error:", err);
      setManagersMessage(err.message || "Failed to open manager file.");
    } finally { setSelectedManagerLoading(false); }
  };

  const markDecisionAsRead = async (decisionId, userId) => {
    try {
      const { error } = await supabase.from("decision_logs").update({
        is_read: true, read_at: new Date().toISOString(), read_by: user.id,
      }).eq("id", decisionId);
      if (error) throw error;
      await fetchTeamDecisions();
      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase.from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId).maybeSingle();
        mgr = data;
      }
      if (mgr) { setActiveTab(TABS.managers); await openManagerFile(mgr); }
    } catch (err) {
      console.error("Mark as read error:", err);
      setTeamDecisionsMessage(err.message || "Failed to mark as read.");
    }
  };

  const handleGiveGuidance = async (requestId, userId) => {
    if (!guidanceText.trim()) return;
    setGuidanceSubmittingId(requestId);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("coaching_requests").update({
        leadership_notes: guidanceText.trim(), guidance_response: guidanceText.trim(),
        guidance_given: true, guidance_given_at: now, guidance_given_by: user.id,
        sent_to_manager_file: true, sent_to_manager_file_at: now, sent_to_manager_file_by: user.id,
        status: "resolved", resolution_type: "guidance_given",
        resolution_summary: guidanceText.trim(), resolved_at: now, resolved_by: user.id,
      }).eq("id", requestId);
      if (error) throw error;
      setGuidanceActiveId(null); setGuidanceText("");
      await fetchTeamCoachingRequests();
      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase.from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId).maybeSingle();
        mgr = data;
      }
      if (mgr) { setActiveTab(TABS.managers); await openManagerFile(mgr); }
    } catch (err) {
      console.error("Give guidance error:", err);
      setTeamCoachingMessage(err.message || "Failed to save guidance.");
    } finally { setGuidanceSubmittingId(null); }
  };

  const fetchMyLogs = async () => {
    if (!user?.id) return;
    setMyLogsLoading(true);
    try {
      const [{ data: decisions }, { data: coaching }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMyDecisions(decisions || []); setMyCoaching(coaching || []);
    } catch (err) { console.error("My logs error:", err); }
    finally { setMyLogsLoading(false); }
  };

  const fetchFacilities = async () => {
    if (!user?.id) return;
    setFacilitiesLoading(true); setFacilitiesMessage("");
    setSelectedFacility(null); setFacilityPeople([]);
    setSelectedPerson(null); setPersonDecisions([]); setPersonCoaching([]);
    try {
      const { data: assigned, error } = await supabase
        .from("area_manager_facilities").select("*").eq("area_manager_id", user.id);
      if (error) throw error;
      if (assigned?.length) { setFacilities(assigned); return; }

      if (profile?.role === "Area Coach") {
        let q = supabase.from("facilities").select("*").order("facility_number", { ascending: true });
        q = applyCompanyScope(q, profile);
        const { data: fb, error: fe } = await q;
        if (fe) throw fe;
        setFacilities(fb || []);
        if (!fb?.length) setFacilitiesMessage("No facilities found for your account.");
        return;
      }
      setFacilities([]);
      setFacilitiesMessage("No facilities assigned to your account.");
    } catch (err) {
      console.error("Fetch facilities error:", err);
      setFacilitiesMessage(err.message || "Failed to load facilities.");
    } finally { setFacilitiesLoading(false); }
  };

  const fetchFacilityPeople = async (facility) => {
    setSelectedFacility(facility); setSelectedPerson(null);
    setPersonDecisions([]); setPersonCoaching([]); setFacilityPeople([]);
    setFacilityPeopleLoading(true); setFacilitiesMessage("");
    const scope = facility?.company_id ? { company_id: facility.company_id } : { company: facility.company };
    try {
      let pq = supabase.from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("facility_number", facility.facility_number).in("role", ["General Manager", "Manager"]);
      pq = applyCompanyScope(pq, scope);

      let mq = supabase.from("facility_metrics").select("*")
        .eq("facility_number", facility.facility_number).maybeSingle();
      mq = applyCompanyScope(mq, scope);

      let bq = supabase.from("facility_category_breakdown").select("*")
        .eq("facility_number", facility.facility_number);
      bq = applyCompanyScope(bq, scope);

      const [{ data: people, error: pe }, { data: metrics, error: me }, { data: breakdown, error: be }] =
        await Promise.all([pq, mq, bq]);
      if (pe) throw pe;

      const sorted = (people || []).sort((a, b) => {
        const rank = { "General Manager": 0, Manager: 1 };
        const d = (rank[a.role] ?? 9) - (rank[b.role] ?? 9);
        return d !== 0 ? d : (a.full_name || "").localeCompare(b.full_name || "");
      });
      setFacilityPeople(sorted);

      setFacilityMetrics(me || !metrics
        ? getMockFacilityMetrics(facility.facility_number)
        : { pr: +metrics.pr_percent, pas: +metrics.pas_percent, tpr: +metrics.tpr_percent, ppd: +metrics.ppd_percent }
      );

      setFacilityBreakdown(be || !breakdown?.length
        ? getMockBreakdown(facility.facility_number)
        : normalizeBreakdownRows(breakdown, facility.facility_number)
      );

      if (!sorted.length) setFacilitiesMessage("No staff found in this facility.");
    } catch (err) {
      console.error("Fetch facility people error:", err);
      setFacilityMetrics(getMockFacilityMetrics(facility.facility_number));
      setFacilityBreakdown(getMockBreakdown(facility.facility_number));
      setFacilitiesMessage(err.message || "Failed to load facility data.");
    } finally { setFacilityPeopleLoading(false); }
  };

  const openPersonFile = async (person) => {
    setSelectedPerson(person); setPersonFileLoading(true);
    setPersonDecisions([]); setPersonCoaching([]); setPersonFileTab("decisions");
    try {
      const [{ data: decisions, error: de }, { data: coaching, error: ce }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
      ]);
      if (de) throw de; if (ce) throw ce;
      setPersonDecisions(decisions || []); setPersonCoaching(coaching || []);
    } catch (err) { console.error("Open person file error:", err); }
    finally { setPersonFileLoading(false); }
  };

  // ── Dashboard loader (called on tab enter) ────────────────────────────────
  const enterDashboard = async () => {
    if (!profile) return;
    setDashboardLoading(true);
    try {
      if (isGeneralManager) {
        const metrics = await loadGmDashboardMetrics(profile);
        setGmMetrics({ pr: metrics.pr, pas: metrics.pas, tpr: metrics.tpr });
      } else if (isAreaManager) {
        const [metrics, territory] = await Promise.all([
          loadAmDashboardMetrics(profile),
          loadAmTerritoryData(profile),
        ]);
        setAmMetrics({ pr: metrics.pr, pas: metrics.pas, tpr: metrics.tpr, ppd: metrics.ppd });
        setAmTerritoryFacilities(territory);
      }
    } catch (err) { console.error("Dashboard load error:", err); }
    finally { setDashboardLoading(false); }
  };

  // ── NAV ITEMS ──────────────────────────────────────────────────────────────
  const navItems = [
    { tab: TABS.dashboard,      label: "Dashboard",         show: hasDashboard,                          onEnter: enterDashboard },
    { tab: TABS.policy,         label: "Request Policy",    show: true },
    { tab: TABS.decision,       label: "Document Decision", show: !isAreaManager },
    { tab: TABS.coaching,       label: "Request Coaching",  show: canRequestCoaching },
    { divider: true,                                        show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamDecisions,  label: "Team Decisions",    show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchTeamDecisions },
    { tab: TABS.teamCoaching,   label: "Team Coaching",     show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchTeamCoachingRequests },
    { tab: TABS.managers,       label: "Managers",          show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchManagers },
    { divider: true,                                        show: canViewFacilities },
    { tab: TABS.facilities,     label: "Facilities",        show: canViewFacilities,                      onEnter: fetchFacilities },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading dashboard...</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .fade-up { animation: fadeUp 0.22s ease both; }
        .nav-tab:hover    { background: #0f1e2f !important; color: #e2eaf4 !important; }
        .person-row:hover { border-color: #2c3f55 !important; background: #0d1b2a !important; }
      `}} />

      {/* ── TOP HEADER ── */}
      <header style={{ ...styles.topNav, padding: isMobile ? "14px 16px" : "12px 20px" }}>
        <div style={styles.topNavBrand}>
          <div style={{ ...styles.topNavName, fontSize: isMobile ? "17px" : "14px" }}>
            {profile?.full_name || "Dashboard"}
          </div>
          <div style={{ ...styles.topNavMeta, fontSize: isMobile ? "13px" : "11px" }}>
            {profile?.role} · {profile?.company}
          </div>
        </div>

        {!isMobile && (
          <nav style={styles.topNavItems}>
            <button
              className="nav-tab"
              style={{ ...styles.topNavBtn, ...(activeTab === TABS.myLogs ? styles.topNavBtnActive : {}) }}
              onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); }}
            >
              My Logs
            </button>
            <div style={styles.topNavDivider} />
            {navItems.map((item, i) => {
              if (!item.show) return null;
              if (item.divider) return <div key={i} style={styles.topNavDivider} />;
              return (
                <button
                  key={item.tab}
                  className="nav-tab"
                  style={{ ...styles.topNavBtn, ...(activeTab === item.tab ? styles.topNavBtnActive : {}) }}
                  onClick={() => { setActiveTab(item.tab); item.onEnter?.(); }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        <div style={styles.topNavRight}>
          {!isMobile ? (
            <button style={styles.topNavLogout} onClick={handleLogout}>Log Out</button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={styles.mobileMenuBtn} onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); setMobileMenuOpen(false); }}>
                My Logs
              </button>
              <button style={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen((v) => !v)}>
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MOBILE DROPDOWN ── */}
      {isMobile && mobileMenuOpen && (
        <div style={styles.mobileDropdown}>
          {navItems.map((item, i) => {
            if (!item.show) return null;
            if (item.divider) return <div key={i} style={styles.navDivider} />;
            return (
              <button
                key={item.tab}
                style={{ ...styles.navButton, ...(activeTab === item.tab ? styles.navButtonActive : {}) }}
                onClick={() => { setActiveTab(item.tab); item.onEnter?.(); setMobileMenuOpen(false); }}
              >
                {item.label}
              </button>
            );
          })}
          <div style={styles.navDivider} />
          <button style={styles.logoutButton} onClick={handleLogout}>Log Out</button>
        </div>
      )}

      <main style={styles.main}>

        {/* ════════════════════════════════════════════════════════════════════
            DASHBOARD TAB — General Manager
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.dashboard && isGeneralManager && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.dashHeaderRow}>
                <div>
                  <h1 style={styles.title}>Dashboard</h1>
                  <p style={styles.subtitle}>
                    Facility performance snapshot · Facility {profile?.facility_number || "—"} · {profile?.company || ""}
                  </p>
                </div>
                <span style={styles.roleBadge}>General Manager</span>
              </div>
            </div>

            {dashboardLoading ? (
              <div style={styles.panelCard}><p style={styles.message}>Loading metrics...</p></div>
            ) : (
              <div style={styles.metricsGrid} className="fade-up">
                {GM_METRIC_DEFS.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={gmAnimatedMetrics[metric.key] || 0} />
                ))}
              </div>
            )}

            <div style={styles.panelCard} className="fade-up">
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Performance Reference</div>
              </div>
              <div style={styles.thresholdGrid}>
                {GM_METRIC_DEFS.map((m) => (
                  <div key={m.key} style={styles.thresholdItem}>
                    <div style={styles.thresholdLabel}>{m.label}</div>
                    <div style={styles.thresholdValue}>Target ≥ {m.target}%</div>
                    <div style={styles.thresholdDesc}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DASHBOARD TAB — Area Manager
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.dashboard && isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.dashHeaderRow}>
                <div>
                  <h1 style={styles.title}>Dashboard</h1>
                  <p style={styles.subtitle}>
                    Area performance overview · All assigned facilities · {profile?.company || ""}
                  </p>
                </div>
                <span style={styles.roleBadge}>Area Manager</span>
              </div>
            </div>

            {dashboardLoading ? (
              <div style={styles.panelCard}><p style={styles.message}>Loading metrics...</p></div>
            ) : (
              <div style={styles.metricsGrid} className="fade-up">
                {AM_METRIC_DEFS.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={amAnimatedMetrics[metric.key] || 0} />
                ))}
              </div>
            )}

            {amTerritoryFacilities.length > 0 && (
              <div style={styles.panelCard} className="fade-up">
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Facility Breakdown</div>
                  <div style={styles.sectionHint}>All facilities · Mock territory data</div>
                </div>
                <TerritoryTable facilities={amTerritoryFacilities} />
              </div>
            )}

            <div style={styles.panelCard} className="fade-up">
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>PP/D Scoring Reference</div>
                <div style={styles.sectionHint}>Policy Pull / Documented Decision threshold</div>
              </div>
              <div style={styles.ppdLegendRow}>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.green }} />
                  <span style={styles.ppdLegendText}>Under 38% — On Target</span>
                </div>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.amber }} />
                  <span style={styles.ppdLegendText}>38–55% — Needs Attention</span>
                </div>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.red }} />
                  <span style={styles.ppdLegendText}>Over 55% — Alert</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            REQUEST POLICY
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.policy && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Policy</h1>
              <p style={styles.subtitle}>Describe the situation and log a policy pull before the response layer is added.</p>
            </div>
            <div style={styles.panelCard}>
              <label style={styles.label}>Describe situation for policy reference</label>
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                placeholder="Example: An employee showed up 30 minutes late without calling. What does company policy say I should do?"
                style={styles.textarea}
              />
              <button style={styles.primaryButton} onClick={handlePullPolicy}>Pull Policy</button>
              {policyMessage && <p style={styles.message}>{policyMessage}</p>}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DOCUMENT DECISION
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.decision && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Document Decision</h1>
              <p style={styles.subtitle}>Record the situation, the action taken, and the category.</p>
            </div>
            <div style={styles.panelCard}>
              <label style={styles.label}>Situation</label>
              <textarea value={decisionSituation} onChange={(e) => setDecisionSituation(e.target.value)}
                placeholder="Describe what happened." style={styles.textareaSmall} />
              <label style={styles.label}>Action Taken</label>
              <textarea value={decisionAction} onChange={(e) => setDecisionAction(e.target.value)}
                placeholder="Describe the action you took." style={styles.textareaSmall} />
              <div style={styles.sectionDivider} />
              <div style={styles.sectionTitle}>Category</div>
              <select value={decisionCategory}
                onChange={(e) => { setDecisionCategory(e.target.value); setCategoryManuallySet(true); }}
                style={styles.categorySelect}
              >
                <option value="">— Select a category —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {autoDetectedCategory.category && !categoryManuallySet && (
                <div style={styles.autoDetectedText}>Auto-detected: {autoDetectedCategory.category}</div>
              )}
              <div style={styles.sectionDivider} />
              <input type="text" value={decisionPolicy} onChange={(e) => setDecisionPolicy(e.target.value)}
                placeholder="Policy referenced (optional)" style={styles.policyInput} />
              <button
                style={{ ...styles.primaryButton, ...(decisionLoading ? styles.buttonDisabled : {}), marginTop: "14px" }}
                onClick={handleDecisionSubmit} disabled={decisionLoading}
              >
                {decisionLoading ? "Submitting..." : "Submit Decision"}
              </button>
              {decisionMessage && <p style={styles.message}>{decisionMessage}</p>}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            REQUEST COACHING  (Manager only)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.coaching && canRequestCoaching && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Coaching</h1>
              <p style={styles.subtitle}>Ask your General Manager for guidance and support.</p>
            </div>
            <div style={styles.panelCard}>
              <label style={styles.label}>Describe what you need support with</label>
              <textarea value={coachingText} onChange={(e) => setCoachingText(e.target.value)}
                placeholder="Describe the situation and what kind of support you need..."
                style={styles.textarea} />
              <button
                style={{ ...styles.primaryButton, ...(coachingLoading ? styles.buttonDisabled : {}) }}
                onClick={handleCoachingSubmit} disabled={coachingLoading}
              >
                {coachingLoading ? "Submitting..." : "Request Coaching"}
              </button>
              {coachingMessage && <p style={styles.message}>{coachingMessage}</p>}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            MY LOGS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.myLogs && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>My Logs</h1>
              <p style={styles.subtitle}>Your personal decision and coaching history.</p>
            </div>
            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>
                  {myLogType === "decisions" ? "My Decision Logs" : myLogType === "coaching" ? "My Coaching Logs" : "Select Log Type"}
                </div>
                {myLogType && <button style={styles.secondaryButton} onClick={() => setMyLogType(null)}>← Back</button>}
              </div>

              {myLogsLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : !myLogType ? (
                <div style={styles.logTypeSelector}>
                  <button style={styles.logTypeButton} onClick={() => setMyLogType("decisions")}>
                    <div style={styles.logTypeTitle}>Decision Logs</div>
                    <div style={styles.logTypeMeta}>{myDecisions.length} record{myDecisions.length !== 1 ? "s" : ""}</div>
                  </button>
                  <button style={styles.logTypeButton} onClick={() => setMyLogType("coaching")}>
                    <div style={styles.logTypeTitle}>Coaching Logs</div>
                    <div style={styles.logTypeMeta}>{myCoaching.length} record{myCoaching.length !== 1 ? "s" : ""}</div>
                  </button>
                </div>
              ) : myLogType === "decisions" ? (
                <div style={styles.cardList}>
                  {myDecisions.length === 0
                    ? <p style={styles.message}>No decision logs yet.</p>
                    : myDecisions.map((item) => (
                        <DecisionCard key={item.id} item={item} title={formatDate(item.created_at)}
                          meta={item.is_read ? "Reviewed by leadership" : "Pending review"} formatDateFn={formatDate} />
                      ))}
                </div>
              ) : (
                <div style={styles.cardList}>
                  {myCoaching.length === 0
                    ? <p style={styles.message}>No coaching requests yet.</p>
                    : myCoaching.map((item) => <CoachingCard key={item.id} item={item} formatDateFn={formatDate} />)}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TEAM DECISIONS  (GM only)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.teamDecisions && canViewLeadershipTabs && !isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Team Decisions</h1>
              <p style={styles.subtitle}>Review decisions routed to your clearance level.</p>
            </div>
            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Decision Feed</div>
                <button style={styles.secondaryButton} onClick={fetchTeamDecisions}>Refresh</button>
              </div>
              {teamDecisionsMessage && <p style={styles.message}>{teamDecisionsMessage}</p>}
              {teamDecisionsLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : teamDecisions.length === 0 ? (
                <p style={styles.message}>No unread team decisions.</p>
              ) : (
                <div style={styles.cardList}>
                  {teamDecisions.map((item) => (
                    <DecisionCard key={item.id} item={item}
                      title={item.user_name || "Unknown User"}
                      meta={`${item.user_role || "Manager"}${item.company ? ` · ${item.company}` : ""}`}
                      formatDateFn={formatDate}
                      actions={
                        <button style={styles.secondaryButton} onClick={() => markDecisionAsRead(item.id, item.user_id)}>
                          Mark as Read
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TEAM COACHING  (GM only)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.teamCoaching && canViewLeadershipTabs && !isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Team Coaching Requests</h1>
              <p style={styles.subtitle}>Review and respond to coaching requests from your team.</p>
            </div>
            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Coaching Queue</div>
                <button style={styles.secondaryButton} onClick={fetchTeamCoachingRequests}>Refresh</button>
              </div>
              {teamCoachingMessage && <p style={styles.message}>{teamCoachingMessage}</p>}
              {teamCoachingLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : teamCoachingRequests.length === 0 ? (
                <p style={styles.message}>No open coaching requests.</p>
              ) : (
                <div style={styles.cardList}>
                  {teamCoachingRequests.map((item) => (
                    <div key={item.id} style={styles.feedCard}>
                      <div style={styles.feedTop}>
                        <div>
                          <div style={styles.feedName}>{item.requester_name || "Unknown User"}</div>
                          <div style={styles.feedMeta}>{item.requester_role || "Manager"}{item.company ? ` · ${item.company}` : ""}</div>
                        </div>
                        <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                      </div>
                      <div style={styles.feedInlineRow}>
                        <span style={styles.statusBadge}>{item.status || "open"}</span>
                      </div>
                      <div style={styles.feedBody}>{item.request_text || "—"}</div>
                      {item.leadership_notes && (
                        <div style={styles.guidanceBlock}>
                          <div style={styles.guidanceLabel}>Leadership Notes</div>
                          <div style={styles.feedBody}>{item.leadership_notes}</div>
                        </div>
                      )}
                      <div style={styles.actionRow}>
                        {guidanceActiveId === item.id ? (
                          <div style={styles.guidancePrompt}>
                            <textarea value={guidanceText} onChange={(e) => setGuidanceText(e.target.value)}
                              placeholder="What should this manager do? Be specific..."
                              style={styles.guidanceTextarea} />
                            <div style={styles.guidanceButtons}>
                              <button style={styles.primaryButton}
                                onClick={() => handleGiveGuidance(item.id, item.user_id)}
                                disabled={guidanceSubmittingId === item.id || !guidanceText.trim()}
                              >
                                {guidanceSubmittingId === item.id ? "Sending..." : "Send to Manager File"}
                              </button>
                              <button style={styles.secondaryButton}
                                onClick={() => { setGuidanceActiveId(null); setGuidanceText(""); }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button style={styles.secondaryButton}
                            onClick={() => { setGuidanceActiveId(item.id); setGuidanceText(""); }}>
                            Give Operational Guidance
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            MANAGERS  (GM only — decisions only, no coaching logs)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.managers && canViewLeadershipTabs && !isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Managers</h1>
              <p style={styles.subtitle}>Review managers and open their documentation history.</p>
            </div>
            <div style={{ ...styles.managersLayout, gridTemplateColumns: isMobile ? "1fr" : "300px 1fr" }}>
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Manager Directory</div>
                  <button style={styles.secondaryButton} onClick={fetchManagers}>Refresh</button>
                </div>
                {managersMessage && <p style={styles.message}>{managersMessage}</p>}
                {managersLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : managers.length === 0 ? (
                  <p style={styles.message}>No managers found.</p>
                ) : (
                  <div style={styles.cardList}>
                    {managers.map((mgr) => (
                      <button key={mgr.id}
                        style={{ ...styles.managerRowButton, ...(selectedManager?.id === mgr.id ? styles.managerRowButtonActive : {}) }}
                        onClick={() => openManagerFile(mgr)}
                      >
                        <div style={styles.managerRowName}>{mgr.full_name || "Unnamed"}</div>
                        <div style={styles.managerRowMeta}>{mgr.role}{mgr.company ? ` · ${mgr.company}` : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>
                    {selectedManager ? `${selectedManager.full_name} — Decision Logs` : "Manager File"}
                  </div>
                </div>
                {!selectedManager ? (
                  <p style={styles.message}>Select a manager to view their decision logs.</p>
                ) : selectedManagerLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : selectedManagerDecisions.length === 0 ? (
                  <p style={styles.message}>No decision logs found.</p>
                ) : (
                  <div style={styles.cardList}>
                    {selectedManagerDecisions.map((item) => (
                      <DecisionCard key={item.id} item={item}
                        title={formatDate(item.created_at)} meta={item.is_read ? "Read" : "Unread"}
                        formatDateFn={formatDate} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FACILITIES  (Area Manager / Area Coach)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.facilities && canViewFacilities && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.facilitiesHeaderTop}>
                <div>
                  <h1 style={styles.title}>Facilities</h1>
                  <p style={styles.subtitle}>
                    {selectedPerson
                      ? `${selectedPerson.full_name} — ${selectedPerson.role}`
                      : selectedFacility
                      ? `Facility ${selectedFacility.facility_number} · ${selectedFacility.company || profile?.company || ""}`
                      : "Select a facility to inspect performance and staff."}
                  </p>
                </div>
                {selectedPerson ? (
                  <button style={styles.secondaryButton} onClick={() => { setSelectedPerson(null); setPersonDecisions([]); setPersonCoaching([]); }}>
                    ← Back to People
                  </button>
                ) : selectedFacility ? (
                  <button style={styles.secondaryButton} onClick={() => { setSelectedFacility(null); setFacilityPeople([]); setSelectedPerson(null); setFacilityMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 }); setFacilityBreakdown(getMockBreakdown("")); }}>
                    ← All Facilities
                  </button>
                ) : null}
              </div>

              {(selectedFacility || selectedPerson) && (
                <div style={styles.breadcrumb}>
                  <button style={styles.breadcrumbLink} onClick={() => { setSelectedFacility(null); setFacilityPeople([]); setSelectedPerson(null); }}>
                    Facilities
                  </button>
                  {selectedFacility && (
                    <>
                      <span style={styles.breadcrumbSep}>›</span>
                      <button style={styles.breadcrumbLink} onClick={() => { setSelectedPerson(null); setPersonDecisions([]); setPersonCoaching([]); }}>
                        Facility {selectedFacility.facility_number}
                      </button>
                    </>
                  )}
                  {selectedPerson && (
                    <>
                      <span style={styles.breadcrumbSep}>›</span>
                      <span style={styles.breadcrumbCurrent}>{selectedPerson.full_name}</span>
                    </>
                  )}
                </div>
              )}

              {!selectedFacility && (
                <div style={styles.facilitySelectorWrap}>
                  {facilitiesLoading ? (
                    <p style={styles.message}>Loading facilities...</p>
                  ) : facilities.length === 0 ? (
                    <p style={styles.message}>{facilitiesMessage || "No facilities found."}</p>
                  ) : (
                    <div style={styles.facilityPillWrap}>
                      {facilities.map((f) => (
                        <button
                          key={`${f.company || "co"}-${f.facility_number}`}
                          onClick={() => fetchFacilityPeople(f)}
                          style={styles.facilityPill}
                        >
                          Facility {f.facility_number}
                          <span style={styles.facilityPillMeta}>{f.company || profile?.company || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedFacility && !selectedPerson && (
              <>
                <div style={styles.metricsGrid} className="fade-up">
                  {AM_METRIC_DEFS.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} value={animatedFacilityMetrics[metric.key] || 0} />
                  ))}
                </div>

                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Category Mix</div>
                    <div style={styles.sectionHint}>Facility-level category distribution</div>
                  </div>
                  <div style={styles.breakdownList}>
                    {facilityBreakdown.map((item) => {
                      const st = getCategoryStyle(item.category);
                      return (
                        <div key={item.category} style={styles.breakdownItem}>
                          <div style={styles.breakdownTop}>
                            <div style={styles.breakdownLeft}>
                              <span style={{ ...styles.breakdownBadge, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                {item.category === "Operations" ? "Ops" : item.category}
                              </span>
                            </div>
                            <div style={{ ...styles.breakdownPercent, color: st.color }}>{Math.round(item.category_percent)}%</div>
                          </div>
                          <div style={styles.breakdownTrack}>
                            <div style={{ ...styles.breakdownFill, width: `${Math.max(0, Math.min(100, item.category_percent))}%`, background: st.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Staff</div>
                    <button style={styles.secondaryButton} onClick={() => fetchFacilityPeople(selectedFacility)}>Refresh</button>
                  </div>
                  {facilitiesMessage && <p style={styles.message}>{facilitiesMessage}</p>}
                  {facilityPeopleLoading ? (
                    <p style={styles.message}>Loading staff...</p>
                  ) : facilityPeople.length === 0 ? (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyStateIcon}>👥</div>
                      <div style={styles.emptyStateTitle}>No staff found</div>
                      <div style={styles.emptyStateText}>Make sure profiles have the correct facility_number set.</div>
                    </div>
                  ) : (
                    <div style={styles.peopleList}>
                      {facilityPeople.map((person) => (
                        <button key={person.id} className="person-row" style={styles.personRow} onClick={() => openPersonFile(person)}>
                          <div>
                            <div style={styles.personName}>{person.full_name || "Unnamed"}</div>
                            <div style={styles.personMeta}>{person.role} · Facility {person.facility_number}</div>
                          </div>
                          <div style={styles.personRight}>
                            <span style={{ ...styles.personRoleBadge, ...(person.role === "General Manager" ? styles.personRoleBadgeGm : styles.personRoleBadgeMgr) }}>
                              {person.role === "General Manager" ? "GM" : "MGR"}
                            </span>
                            <span style={styles.personChevron}>›</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Person file — AM: decisions only */}
            {selectedPerson && (
              <div style={styles.personFileStack} className="fade-up">
                <div style={styles.panelCard}>
                  <div style={styles.personFileTitle}>{selectedPerson.full_name}</div>
                  <div style={styles.personFileMeta}>
                    {selectedPerson.role} · {selectedPerson.company || profile?.company || ""} · Facility {selectedPerson.facility_number}
                  </div>
                  <div style={styles.personStatsRow}>
                    <div style={styles.personStatBlock}>
                      <div style={{ ...styles.personStatValue, color: PALETTE.blue }}>{personDecisions.length}</div>
                      <div style={styles.personStatLabel}>Decisions</div>
                    </div>
                  </div>
                </div>

                {personFileLoading ? (
                  <div style={styles.panelCard}><p style={styles.message}>Loading logs...</p></div>
                ) : (
                  <div style={styles.panelCard}>
                    <div style={styles.sectionTopRow}>
                      <div style={styles.sectionHeading}>Decision Logs</div>
                    </div>
                    {personDecisions.length === 0 ? (
                      <div style={styles.emptyStateTight}>No decision logs on record.</div>
                    ) : (
                      <div style={styles.cardList}>
                        {personDecisions.map((item) => (
                          <DecisionCard key={item.id} item={item}
                            title={formatDate(item.created_at)} meta={item.user_role || selectedPerson.role}
                            formatDateFn={formatDate} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: PALETTE.bg,
    color: PALETTE.text,
    padding: "16px",
    boxSizing: "border-box",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loadingCard: {
    maxWidth: "520px", margin: "120px auto",
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", padding: "32px", textAlign: "center",
    color: PALETTE.text, boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
  },

  // ── TOP NAV
  topNav: {
    maxWidth: "1420px", margin: "0 auto 18px",
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: "16px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
  },
  topNavBrand:  { minWidth: "220px" },
  topNavName:   { fontWeight: 700, color: PALETTE.text, lineHeight: 1.1 },
  topNavMeta:   { color: PALETTE.textSoft, marginTop: "2px" },
  topNavItems:  { display: "flex", alignItems: "center", gap: "8px", flex: 1, overflowX: "auto" },
  topNavBtn: {
    border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt,
    color: PALETTE.textSoft, borderRadius: "999px", padding: "9px 14px",
    fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  },
  topNavBtnActive: {
    background: PALETTE.blueSoft, color: "#c8dcf0",
    border: `1px solid rgba(61, 104, 153, 0.34)`,
  },
  topNavDivider: { width: "1px", height: "18px", background: PALETTE.borderStrong, flexShrink: 0 },
  topNavRight:   { display: "flex", alignItems: "center", gap: "8px" },
  topNavLogout: {
    border: `1px solid ${PALETTE.borderStrong}`, background: "transparent",
    color: PALETTE.textSoft, borderRadius: "14px", padding: "9px 14px",
    fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  mobileMenuBtn: {
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, borderRadius: "12px", padding: "10px 12px",
    fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  mobileDropdown: {
    maxWidth: "1420px", margin: "-4px auto 18px",
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px",
  },
  navDivider: { height: "1px", background: PALETTE.borderStrong, margin: "4px 0" },
  navButton: {
    width: "100%", textAlign: "left", border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt, color: PALETTE.textSoft, borderRadius: "12px",
    padding: "12px 14px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
  },
  navButtonActive: { background: PALETTE.blueSoft, color: "#c8dcf0", border: `1px solid rgba(61,104,153,0.34)` },
  logoutButton: {
    width: "100%", textAlign: "left", border: `1px solid ${PALETTE.borderStrong}`,
    background: "transparent", color: PALETTE.textSoft, borderRadius: "12px",
    padding: "12px 14px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
  },

  // ── LAYOUT
  main: { maxWidth: "1420px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" },
  headerCard: {
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", padding: "24px", boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  panelCard: {
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", padding: "22px", boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },

  // ── TYPOGRAPHY
  title:    { margin: 0, fontSize: "36px", lineHeight: 1.05, fontWeight: 800, color: PALETTE.text },
  subtitle: { margin: "10px 0 0", fontSize: "14px", lineHeight: 1.65, color: PALETTE.textSoft, maxWidth: "820px" },
  label:    { display: "block", marginBottom: "10px", fontSize: "14px", fontWeight: 700, color: PALETTE.text },
  message:  { marginTop: "12px", fontSize: "14px", lineHeight: 1.6, color: PALETTE.textSoft },
  sectionTopRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "12px", flexWrap: "wrap", marginBottom: "14px",
  },
  sectionHeading: { fontSize: "20px", fontWeight: 800, color: PALETTE.text },
  sectionHint:    { fontSize: "12px", color: PALETTE.textMuted },
  sectionDivider: { height: "1px", background: PALETTE.borderStrong, margin: "4px 0 16px" },
  sectionTitle: {
    marginBottom: "10px", fontSize: "11px", letterSpacing: "0.08em",
    textTransform: "uppercase", color: PALETTE.textMuted, fontWeight: 800,
  },
  autoDetectedText: { marginTop: "8px", marginBottom: "4px", fontSize: "12px", color: PALETTE.textMuted },

  // ── FORMS
  textarea: {
    width: "100%", minHeight: "220px", borderRadius: "16px",
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "16px", fontSize: "15px", lineHeight: 1.6,
    resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: "16px",
  },
  textareaSmall: {
    width: "100%", minHeight: "130px", borderRadius: "16px",
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "16px", fontSize: "15px", lineHeight: 1.6,
    resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: "16px",
  },
  categorySelect: {
    width: "100%", borderRadius: "14px", border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt, color: PALETTE.text, padding: "14px 16px",
    fontSize: "15px", outline: "none", boxSizing: "border-box",
  },
  policyInput: {
    width: "100%", borderRadius: "14px", border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt, color: PALETTE.text, padding: "14px 16px",
    fontSize: "15px", outline: "none", boxSizing: "border-box",
  },

  // ── BUTTONS
  primaryButton: {
    border: `1px solid rgba(61,104,153,0.34)`, background: PALETTE.blueSoft,
    color: "#c8dcf0", borderRadius: "14px", padding: "11px 16px",
    fontSize: "14px", fontWeight: 700, cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, borderRadius: "14px", padding: "9px 14px",
    fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  buttonDisabled: { opacity: 0.55, cursor: "not-allowed" },

  // ── METRIC CARDS
  metricsGrid: {
    display: "grid", gap: "14px",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  },
  metricCard: {
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "20px", padding: "22px 20px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
  },
  metricLabel: {
    fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
    color: PALETTE.textMuted, marginBottom: "12px", fontWeight: 800,
  },
  metricValue: {
    fontSize: "40px", lineHeight: 1, fontWeight: 800,
    fontVariantNumeric: "tabular-nums", marginBottom: "14px",
    transition: "color 0.3s ease",
  },
  metricBarTrack: {
    background: "#0d1e30", borderRadius: "999px", height: "4px",
    overflow: "hidden", marginBottom: "12px",
  },
  metricBarFill: {
    height: "100%", borderRadius: "999px",
    transition: "width 0.12s ease, background 0.3s ease",
  },
  metricDesc:   { fontSize: "12px", color: PALETTE.textSoft, lineHeight: 1.5 },
  metricTarget: { marginTop: "8px", fontSize: "11px", color: PALETTE.textMuted },

  // ── DASHBOARD HEADER
  dashHeaderRow: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
  },
  roleBadge: {
    padding: "5px 13px", borderRadius: "999px", fontSize: "11px",
    fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
    background: PALETTE.blueSoft, border: `1px solid rgba(61,104,153,0.26)`,
    color: "#94b8d8", flexShrink: 0, alignSelf: "flex-start", marginTop: "5px",
  },

  // ── PERFORMANCE REFERENCE (GM)
  thresholdGrid: {
    display: "grid", gap: "14px",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  },
  thresholdItem: {
    background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`,
    borderRadius: "16px", padding: "16px",
  },
  thresholdLabel: { fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: PALETTE.textMuted, marginBottom: "8px" },
  thresholdValue: { fontSize: "20px", fontWeight: 800, color: PALETTE.text, marginBottom: "4px" },
  thresholdDesc:  { fontSize: "12px", color: PALETTE.textSoft },

  // ── TERRITORY TABLE (AM)
  territoryTableWrap: { display: "flex", flexDirection: "column", gap: "2px", overflowX: "auto" },
  territoryHeaderRow: {
    display: "flex", alignItems: "center",
    padding: "8px 14px", borderBottom: `1px solid ${PALETTE.borderStrong}`, marginBottom: "4px",
  },
  territoryCellLabel: { fontSize: "10px", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: PALETTE.textMuted },
  territoryDataRow: { display: "flex", alignItems: "center", padding: "11px 14px", borderRadius: "13px" },
  territoryCell: { flex: 1, minWidth: "60px", fontSize: "14px", fontVariantNumeric: "tabular-nums", paddingRight: "8px" },

  // ── PP/D LEGEND
  ppdLegendRow:  { display: "flex", gap: "22px", flexWrap: "wrap", alignItems: "center" },
  ppdLegendItem: { display: "flex", alignItems: "center", gap: "8px" },
  ppdLegendDot:  { width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0 },
  ppdLegendText: { fontSize: "13px", color: PALETTE.textSoft, fontWeight: 600 },

  // ── FEED / DECISION CARDS
  cardList: { display: "flex", flexDirection: "column", gap: "12px" },
  feedCard: {
    background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`,
    borderRadius: "16px", padding: "16px",
  },
  feedTop: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: "16px", marginBottom: "10px", flexWrap: "wrap",
  },
  feedName:   { fontSize: "15px", fontWeight: 800, color: PALETTE.text, marginBottom: "3px" },
  feedMeta:   { fontSize: "13px", color: PALETTE.textSoft },
  feedDate:   { fontSize: "12px", color: PALETTE.textMuted },
  feedInlineRow: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" },
  feedSection:   { marginTop: "10px" },
  feedLabel: {
    marginBottom: "5px", fontSize: "11px", fontWeight: 800,
    letterSpacing: "0.06em", textTransform: "uppercase", color: PALETTE.textMuted,
  },
  feedBody: { fontSize: "14px", lineHeight: 1.6, color: PALETTE.text, whiteSpace: "pre-wrap" },
  policyTag: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px",
    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
    background: PALETTE.blueSoft, border: `1px solid rgba(61,104,153,0.26)`, color: "#94b8d8",
  },
  unreadBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px",
    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
    background: PALETTE.amberSoft, border: `1px solid rgba(154,120,64,0.26)`, color: "#c4a070",
  },
  categoryBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px",
    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  statusBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px",
    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase",
    background: "rgba(143,163,184,0.09)", border: "1px solid rgba(143,163,184,0.18)", color: PALETTE.textSoft,
  },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" },
  guidanceBlock: { marginTop: "12px", borderLeft: `3px solid ${PALETTE.blue}`, paddingLeft: "12px" },
  guidanceLabel: {
    fontSize: "11px", fontWeight: 800, color: "#94b8d8",
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "5px",
  },
  guidancePrompt:  { width: "100%" },
  guidanceTextarea: {
    width: "100%", minHeight: "120px", borderRadius: "14px",
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "14px 16px", fontSize: "14px", lineHeight: 1.6,
    resize: "vertical", outline: "none", boxSizing: "border-box",
  },
  guidanceButtons: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" },

  // ── MANAGERS
  managersLayout: { display: "grid", gap: "18px" },
  managerRowButton: {
    width: "100%", textAlign: "left", borderRadius: "15px",
    border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt,
    padding: "14px 15px", cursor: "pointer",
  },
  managerRowButtonActive: { border: `1px solid ${PALETTE.blue}`, background: "rgba(61,104,153,0.11)" },
  managerRowName: { fontSize: "15px", fontWeight: 800, color: PALETTE.text, marginBottom: "3px" },
  managerRowMeta: { fontSize: "13px", color: PALETTE.textSoft },

  // ── LOG TYPE SELECTOR
  logTypeSelector: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  logTypeButton: {
    textAlign: "left", borderRadius: "17px",
    border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt,
    padding: "18px", cursor: "pointer",
  },
  logTypeTitle: { fontSize: "15px", fontWeight: 800, color: PALETTE.text, marginBottom: "7px" },
  logTypeMeta:  { fontSize: "13px", color: PALETTE.textSoft },

  // ── FACILITIES
  facilitiesHeaderTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
  facilitySelectorWrap: { marginTop: "16px" },
  facilityPillWrap: { display: "flex", gap: "8px", flexWrap: "wrap" },
  facilityPill: {
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt, color: PALETTE.text,
    borderRadius: "999px", padding: "9px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "6px",
  },
  facilityPillMeta: { fontSize: "11px", color: PALETTE.textMuted, fontWeight: 600 },
  breadcrumb: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "14px" },
  breadcrumbLink: { border: "none", padding: 0, background: "transparent", color: "#94b8d8", fontSize: "14px", fontWeight: 700, cursor: "pointer" },
  breadcrumbSep:  { color: PALETTE.textMuted, fontSize: "14px" },
  breadcrumbCurrent: { color: PALETTE.textSoft, fontSize: "14px", fontWeight: 700 },

  // ── CATEGORY BREAKDOWN
  breakdownList:   { display: "flex", flexDirection: "column", gap: "15px" },
  breakdownItem:   { display: "flex", flexDirection: "column", gap: "7px" },
  breakdownTop:    { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  breakdownLeft:   { display: "flex", alignItems: "center", gap: "10px" },
  breakdownBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px",
    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  breakdownPercent: { fontSize: "20px", fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  breakdownTrack:   { background: "#0d1e30", borderRadius: "999px", height: "6px", overflow: "hidden" },
  breakdownFill:    { height: "100%", borderRadius: "999px", transition: "width 0.12s ease" },

  // ── PEOPLE / PERSON FILE
  peopleList:  { display: "flex", flexDirection: "column", gap: "7px" },
  personRow: {
    width: "100%", textAlign: "left", border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt, borderRadius: "15px", padding: "14px 16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: "12px", cursor: "pointer",
  },
  personName:  { fontSize: "14px", fontWeight: 800, color: PALETTE.text, marginBottom: "3px" },
  personMeta:  { fontSize: "12px", color: PALETTE.textSoft },
  personRight: { display: "flex", alignItems: "center", gap: "10px" },
  personRoleBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 9px",
    borderRadius: "999px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  personRoleBadgeGm:  { background: PALETTE.blueSoft,   color: "#94b8d8", border: `1px solid rgba(61,104,153,0.26)` },
  personRoleBadgeMgr: { background: PALETTE.indigoSoft, color: "#a8b8d8", border: `1px solid rgba(104,120,168,0.26)` },
  personChevron: { color: PALETTE.textMuted, fontSize: "17px", lineHeight: 1 },

  personFileStack:  { display: "flex", flexDirection: "column", gap: "14px" },
  personFileTitle:  { fontSize: "20px", fontWeight: 800, color: PALETTE.text },
  personFileMeta:   { fontSize: "13px", color: PALETTE.textSoft, marginTop: "3px" },
  personStatsRow:   { display: "flex", gap: "14px", alignItems: "center", marginTop: "14px", flexWrap: "wrap" },
  personStatBlock:  { textAlign: "center" },
  personStatValue:  { fontSize: "22px", fontWeight: 800, lineHeight: 1 },
  personStatLabel:  { marginTop: "4px", fontSize: "10px", color: PALETTE.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 800 },
  personStatDivider:{ width: "1px", height: "32px", background: PALETTE.borderStrong },

  emptyState:      { textAlign: "center", padding: "28px 0" },
  emptyStateIcon:  { fontSize: "26px", marginBottom: "10px" },
  emptyStateTitle: { fontSize: "14px", fontWeight: 700, color: PALETTE.textSoft, marginBottom: "4px" },
  emptyStateText:  { fontSize: "12px", color: PALETTE.textMuted },
  emptyStateTight: { textAlign: "center", padding: "24px 0", fontSize: "13px", color: PALETTE.textSoft },
};
