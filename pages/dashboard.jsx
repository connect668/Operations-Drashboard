import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = {
  dashboard:     "dashboard",       // GM + AM home overview
  policy:        "policy",
  decision:      "decision",
  coaching:      "coaching",
  myLogs:        "my_logs",
  teamDecisions: "team_decisions",
  teamCoaching:  "team_coaching",
  managers:      "managers",
  facilities:    "facilities",
  facilityNotes: "facility_notes",  // NEW — visible to any user with a facility_number
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

const NOTE_TYPES = [
  "Equipment / Repair",
  "Safety Concern",
  "Maintenance",
  "Operational Issue",
  "Staffing Issue",
  "Other",
];

// Maps UI display label → DB-stored value (must match facility_notes_note_type_check constraint)
const NOTE_TYPE_DB = {
  "Equipment / Repair": "equipment_repair",
  "Safety Concern":     "safety_concern",
  "Maintenance":        "maintenance",
  "Operational Issue":  "operational_issue",
  "Staffing Issue":     "staffing_issue",
  "Other":              "other",
};
// Reverse map for rendering stored values back as friendly labels
const NOTE_TYPE_LABEL = Object.fromEntries(
  Object.entries(NOTE_TYPE_DB).map(([label, val]) => [val, label])
);

const NOTE_PRIORITIES = ["low", "normal", "high", "urgent"];

const NOTE_STATUSES = ["open", "in_progress", "closed"];

// ─────────────────────────────────────────────────────────────────────────────
// METRIC DEFINITIONS
// GM sees PR / PAS only.  AM sees PR / PAS / PP/D.
// ─────────────────────────────────────────────────────────────────────────────
const ALL_METRIC_DEFS = [
  { key: "pr",  label: "PR%",  desc: "Policy Reference Rate",             target: 78, unit: "%" },
  { key: "pas", label: "PAS%", desc: "Policy Adherence Score",            target: 85, unit: "%" },
  { key: "ppd", label: "PP/D", desc: "Policy Pull / Documented Decision", target: 38, unit: "%" },
];

const GM_METRIC_DEFS = ALL_METRIC_DEFS.filter((m) => m.key !== "ppd");
const AM_METRIC_DEFS = ALL_METRIC_DEFS;

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE  — trading terminal / financial dark
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:           "#03070f",
  panel:        "#070f1c",
  panelAlt:     "#0a1626",
  panelDeep:    "#050b18",
  border:       "#0e1e30",
  borderStrong: "#162840",
  borderBright: "#1d3a55",
  text:         "#ccd9ea",
  textSoft:     "#4d6a84",
  textMuted:    "#283d52",
  blue:         "#1a80ff",
  blueSoft:     "rgba(26, 128, 255, 0.10)",
  blueGlow:     "rgba(26, 128, 255, 0.06)",
  green:        "#00c87a",
  greenSoft:    "rgba(0, 200, 122, 0.10)",
  amber:        "#e8980a",
  amberSoft:    "rgba(232, 152, 10, 0.10)",
  red:          "#e83248",
  redSoft:      "rgba(232, 50, 72, 0.10)",
  cyan:         "#00b8d4",
  cyanSoft:     "rgba(0, 184, 212, 0.08)",
  indigo:       "#6478c8",
  indigoSoft:   "rgba(100, 120, 200, 0.10)",
};

const CATEGORY_STYLES = {
  HR: {
    color:  "#4da6ff",
    bg:     "rgba(26, 128, 255, 0.08)",
    border: "rgba(26, 128, 255, 0.22)",
  },
  Operations: {
    color:  "#00c87a",
    bg:     "rgba(0, 200, 122, 0.08)",
    border: "rgba(0, 200, 122, 0.22)",
  },
  "Food Safety": {
    color:  "#e8980a",
    bg:     "rgba(232, 152, 10, 0.08)",
    border: "rgba(232, 152, 10, 0.22)",
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
  const cid = scope?.company_id;
  if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid))
    return query.eq("company_id", cid);
  if (scope?.company) return query.eq("company", scope.company);
  return query;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(v) { return UUID_RE.test(v) ? v : null; }

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
// Each returns: { pr, pas, ppd }   (ppd optional for GM)
// ─────────────────────────────────────────────────────────────────────────────

function seedFromFacility(facilityNumber = "") {
  const cleaned = String(facilityNumber).replace(/\D/g, "");
  const base = cleaned ? Number(cleaned) : 7;
  return Number.isNaN(base) ? 7 : base;
}

/** GM facility-level snapshot — PR, PAS */
function getMockGmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr:  72 + (s % 10),
    pas: 80 + (s % 8),
  };
}

/** AM area-level aggregate — PR, PAS, PP/D */
function getMockAmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr:  74 + (s % 8),
    pas: 82 + (s % 7),
    ppd: 33  + (s % 12),
  };
}

/** AM territory table — 4 mock facilities */
function getMockTerritoryFacilities(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return [
    { number: `#${1040 + (s % 7)}`,           pr: 76 + (s % 8),        pas: 83 + (s % 6),        ppd: 29 + (s % 10) },
    { number: `#${1048 + ((s + 3) % 7)}`,      pr: 70 + ((s * 2) % 10), pas: 80 + (s % 7),        ppd: 40 + (s % 14) },
    { number: `#${1060 + (s % 9)}`,            pr: 78 + (s % 7),        pas: 85 + (s % 5),        ppd: 27 + ((s * 3) % 8) },
    { number: `#${1070 + ((s + 5) % 9)}`,      pr: 66 + ((s * 3) % 12), pas: 77 + (s % 8),        ppd: 52 + (s % 10) },
  ];
}

/** Facility-level metrics used in the Facilities tab (Area Manager) */
function getMockFacilityMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return { pr: 72 + (s % 9), pas: 80 + (s % 8), ppd: 34 + (s % 9) };
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
  //   .select("pr_percent, pas_percent")
  //   .eq("facility_number", profile.facility_number)
  //   .eq("company_id", profile.company_id)
  //   .maybeSingle();
  // if (data) return { pr: data.pr_percent, pas: data.pas_percent };
  return getMockGmMetrics(profile?.facility_number);
}

/** Load AM dashboard metrics. Replace body with real Supabase query. */
async function loadAmDashboardMetrics(profile) {
  // TODO: real query →
  // const { data } = await supabase.from("area_metrics")
  //   .select("pr_percent, pas_percent, ppd_percent")
  //   .eq("area_manager_id", profile.id)
  //   .maybeSingle();
  // if (data) return { pr: data.pr_percent, pas: data.pas_percent, ppd: data.ppd_percent };
  return getMockAmMetrics(profile?.facility_number);
}

/** Load AM territory facilities. Replace body with real Supabase query. */
async function loadAmTerritoryData(profile) {
  // TODO: real query →
  // const { data } = await supabase.from("area_manager_facilities")
  //   .select("facility_number, pr_percent, pas_percent, ppd_percent")
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

function MetricCard({ metric, value, onClick }) {
  const color = scoreMetricColor(metric.key, value);
  const barWidth = Math.max(0, Math.min(100, value));
  const isClickable = typeof onClick === "function";
  return (
    <div
      className={isClickable ? "metric-card-click" : undefined}
      style={{
        ...styles.metricCard,
        borderTop: `2px solid ${color}`,
        ...(isClickable ? styles.metricCardClickable : {}),
      }}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {isClickable && (
        <div style={styles.metricCardDrillHint}>VIEW BREAKDOWN →</div>
      )}
      <div style={styles.metricLabel}>{metric.label}</div>
      <div style={{ ...styles.metricValue, color }}>
        {Math.round(value)}{metric.unit}
      </div>
      <div style={styles.metricBarTrack}>
        <div style={{ ...styles.metricBarFill, width: `${barWidth}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
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

function PolicyResultCard({ policy, onUse, isSelected }) {
  const catStyle = getCategoryStyle(policy.category);
  const snippet = policy.policy_text
    ? policy.policy_text.length > 260
      ? policy.policy_text.slice(0, 260).trimEnd() + "…"
      : policy.policy_text
    : null;
  return (
    <div style={{
      ...styles.feedCard,
      border: isSelected
        ? `1px solid rgba(26,128,255,0.40)`
        : `1px solid ${PALETTE.border}`,
      background: isSelected ? "rgba(26,128,255,0.07)" : PALETTE.panelAlt,
    }}>
      <div style={styles.feedTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.feedName}>{policy.title || "Untitled Policy"}</div>
          <div style={styles.feedInlineRow}>
            {policy.policy_code && (
              <span style={styles.policyCodeBadge}>{policy.policy_code}</span>
            )}
            {policy.category && (
              <span style={{ ...styles.categoryBadge, color: catStyle.color, background: catStyle.bg, border: `1px solid ${catStyle.border}` }}>
                {policy.category}
              </span>
            )}
            {policy.version && (
              <span style={styles.versionTag}>v{policy.version}</span>
            )}
          </div>
        </div>
        <button
          style={{ ...styles.primaryButton, whiteSpace: "nowrap", flexShrink: 0 }}
          onClick={() => onUse(policy)}
        >
          Use This Policy
        </button>
      </div>
      {snippet && (
        <div style={{ ...styles.feedBody, fontSize: "13px", marginTop: "6px", color: PALETTE.textSoft }}>
          {snippet}
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
          ppd: scoreMetricColor("ppd", fac.ppd),
        };
        const alertCount = Object.values(colors).filter((c) => c === PALETTE.red).length;
        const warnCount  = Object.values(colors).filter((c) => c === PALETTE.amber).length;
        const statusLabel = alertCount > 0 ? "Alert" : warnCount > 1 ? "Attention" : "On Track";
        const statusColor = alertCount > 0 ? PALETTE.red : warnCount > 1 ? PALETTE.amber : PALETTE.green;
        const statusBg    = alertCount > 0 ? PALETTE.redSoft : warnCount > 1 ? PALETTE.amberSoft : PALETTE.greenSoft;
        const statusBorder= alertCount > 0
          ? "rgba(232,50,72,0.28)"
          : warnCount > 1
          ? "rgba(232,152,10,0.28)"
          : "rgba(0,200,122,0.28)";

        return (
          <div key={fac.number} style={styles.territoryDataRow}>
            <div style={{ ...styles.territoryCell, flex: "0 0 88px", fontWeight: 700, color: PALETTE.text, fontSize: "14px" }}>
              {fac.number}
            </div>
            {[
              { key: "pr",  val: fac.pr  },
              { key: "pas", val: fac.pas },
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
  const [gmMetrics,         setGmMetrics]         = useState({ pr: 0, pas: 0 });
  const [gmAnimatedMetrics, setGmAnimatedMetrics] = useState({ pr: 0, pas: 0 });

  // ── AM dashboard metrics ─────────────────────────────────────────────────
  const [amMetrics,              setAmMetrics]              = useState({ pr: 0, pas: 0, ppd: 0 });
  const [amAnimatedMetrics,      setAmAnimatedMetrics]      = useState({ pr: 0, pas: 0, ppd: 0 });
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

  const [facilityMetrics,         setFacilityMetrics]         = useState({ pr: 0, pas: 0, ppd: 0 });
  const [animatedFacilityMetrics, setAnimatedFacilityMetrics] = useState({ pr: 0, pas: 0, ppd: 0 });
  const [facilityBreakdown,       setFacilityBreakdown]       = useState(getMockBreakdown(""));

  // ── misc ─────────────────────────────────────────────────────────────────
  const [isMobile,      setIsMobile]      = useState(false);
  const [mobileMenuOpen,setMobileMenuOpen]= useState(false);
  const [keywordMap,    setKeywordMap]    = useState(FALLBACK_CATEGORY_KEYWORDS);

  // ── policy search ─────────────────────────────────────────────────────────
  const [policyResults,        setPolicyResults]        = useState([]);
  const [policySearchLoading,  setPolicySearchLoading]  = useState(false);
  const [policySearchError,    setPolicySearchError]    = useState("");
  const [selectedPolicy,       setSelectedPolicy]       = useState(null);
  const [policySearchCategory, setPolicySearchCategory] = useState("");

  // ── facility notes (Feature 1 & 2) ───────────────────────────────────────
  const [facilityNotes,         setFacilityNotes]         = useState([]);
  const [facilityNotesLoading,  setFacilityNotesLoading]  = useState(false);
  const [facilityNotesMessage,  setFacilityNotesMessage]  = useState("");
  const [newNoteType,           setNewNoteType]           = useState(NOTE_TYPES[0]);
  const [newNotePriority,       setNewNotePriority]       = useState("normal");
  const [newNoteText,           setNewNoteText]           = useState("");
  const [newNoteSubmitting,     setNewNoteSubmitting]     = useState(false);
  const [showNewNoteForm,       setShowNewNoteForm]       = useState(false);
  const [noteStatusUpdating,    setNoteStatusUpdating]    = useState(null); // id being updated
  const [resolutionNoteId,      setResolutionNoteId]      = useState(null); // id awaiting resolution
  const [resolutionText,        setResolutionText]        = useState("");

  // ── GM virtual signature (GM document flow only) ─────────────────────────
  const [gmSignatureText, setGmSignatureText] = useState("");

  const router = useRouter();

  // ── derived role flags ────────────────────────────────────────────────────
  const currentRoleLevel     = useMemo(() => ROLE_LEVELS[profile?.role] || 1, [profile]);
  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const canViewFacilities     = profile?.role === "Area Manager" || profile?.role === "Area Coach";
  const canRequestCoaching    = profile?.role === "Manager";
  const isAreaManager         = profile?.role === "Area Manager";
  const isGeneralManager      = profile?.role === "General Manager";
  const hasDashboard          = isGeneralManager || isAreaManager;
  const nextRole              = getNextRole(profile?.role);
  const canViewFacilityNotes  = !!(profile?.facility_number);
  const canManageFacilityNotes = isGeneralManager || profile?.role === "Area Coach";

  const autoDetectedCategory = useMemo(
    () => detectCategory(decisionSituation, decisionAction, keywordMap),
    [decisionSituation, decisionAction, keywordMap]
  );

  // ── EFFECTS ───────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        // ── Step 1: fast local check (reads localStorage, no network) ──────
        // This prevents the redirect flicker on every page load.
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!initialSession) {
          window.location.href = "/";
          return;
        }

        // ── Step 2: secure server-side validation ──────────────────────────
        // getUser() contacts Supabase servers to confirm the JWT is still valid.
        // This is the correct auth check for anything that touches the DB.
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (error || !authUser) {
          console.error("Auth validation failed:", error?.message);
          window.location.href = "/";
          return;
        }

        if (!mounted) return;
        setUser(authUser);

        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!mounted) return;
        setProfile(prof || null);

        // Set Dashboard as default tab for GM and AM, and pre-load metrics
        if (prof?.role === "General Manager") {
          setActiveTab(TABS.dashboard);
          setDashboardLoading(true);
          try {
            const metrics = await loadGmDashboardMetrics(prof);
            if (mounted) setGmMetrics({ pr: metrics.pr, pas: metrics.pas });
          } catch (e) { console.error("GM metrics load error:", e); }
          finally { if (mounted) setDashboardLoading(false); }
        } else if (prof?.role === "Area Manager") {
          setActiveTab(TABS.dashboard);
          setDashboardLoading(true);
          try {
            const [metrics, territory] = await Promise.all([
              loadAmDashboardMetrics(prof),
              loadAmTerritoryData(prof),
            ]);
            if (mounted) {
              setAmMetrics({ pr: metrics.pr, pas: metrics.pas, ppd: metrics.ppd });
              setAmTerritoryFacilities(territory);
            }
          } catch (e) { console.error("AM metrics load error:", e); }
          finally { if (mounted) setDashboardLoading(false); }
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (mounted) window.location.href = "/";
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => { mounted = false; };
  }, []);

  // ── Keep React user state in sync with Supabase session ──────────────────
  // This fires when: token is refreshed, user signs out in another tab, etc.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        // User signed out (this tab or another tab) — redirect to login
        window.location.href = "/";
      } else if (session?.user) {
        // Token was refreshed or user signed back in — keep state current
        setUser(session.user);
      }
    });
    return () => subscription.unsubscribe();
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
    if (!selectedFacility) { setAnimatedFacilityMetrics({ pr: 0, pas: 0, ppd: 0 }); return; }
    return animateMetrics(facilityMetrics, setAnimatedFacilityMetrics);
  }, [facilityMetrics, selectedFacility]);

  // GM dashboard animation
  useEffect(() => {
    if (!Object.values(gmMetrics).some((v) => v > 0)) { setGmAnimatedMetrics({ pr: 0, pas: 0 }); return; }
    return animateMetrics(gmMetrics, setGmAnimatedMetrics);
  }, [gmMetrics]);

  // AM dashboard animation
  useEffect(() => {
    if (!Object.values(amMetrics).some((v) => v > 0)) { setAmAnimatedMetrics({ pr: 0, pas: 0, ppd: 0 }); return; }
    return animateMetrics(amMetrics, setAmAnimatedMetrics);
  }, [amMetrics]);

  // ── HANDLERS ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const searchPolicies = async (searchText, categoryOverride = "") => {
    setPolicySearchLoading(true);
    setPolicySearchError("");
    setPolicyResults([]);
    const term = searchText.trim();
    if (!term) { setPolicySearchLoading(false); return; }
    try {
      const detected = detectCategory(term, "", keywordMap);
      const category = categoryOverride || detected.category || "";
      setPolicySearchCategory(category);

      const runQuery = async (withCategory) => {
        let q = supabase
          .from("company_policies")
          .select("id, title, policy_code, policy_text, category, version, is_active")
          .eq("is_active", true)
          .or(`title.ilike.%${term}%,policy_text.ilike.%${term}%,policy_code.ilike.%${term}%`)
          .order("title", { ascending: true })
          .limit(10);
        q = applyCompanyScope(q, profile);
        if (withCategory) q = q.eq("category", withCategory);
        return q;
      };

      let { data, error } = await runQuery(category);
      if (error) throw error;

      // Fallback: if category filtered to zero results, retry without category filter
      if (category && (!data || data.length === 0)) {
        const fallback = await runQuery("");
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }

      setPolicyResults(data || []);
    } catch (err) {
      console.error("Policy search error:", err);
      setPolicySearchError(err.message || "Failed to search policies.");
    } finally {
      setPolicySearchLoading(false);
    }
  };

  const handlePullPolicy = async () => {
    setPolicyMessage("");
    setSelectedPolicy(null);
    if (!policyText.trim()) { setPolicyMessage("Please describe the situation first."); return; }
    await searchPolicies(policyText);
    // Log to policy_pull_logs non-blocking (do not block or show error to user)
    try {
      const detected = detectCategory(policyText, "", keywordMap);
      await supabase.from("policy_pull_logs").insert([{
        user_id: user.id,
        company: profile?.company || null,
        company_id: safeUuid(profile?.company_id),
        facility_number: profile?.facility_number || null,
        user_role: profile?.role || null,
        situation_text: policyText.trim(),
        category: detected.category || null,
        policy_query: policyText.trim(),
        policy_result_used: false,
      }]);
    } catch (logErr) {
      console.warn("Policy pull log failed (non-critical):", logErr);
    }
  };

  const handleUsePolicy = (policy) => {
    setSelectedPolicy(policy);
    setDecisionPolicy(policy.policy_code || policy.title || "");
    if (!categoryManuallySet && policy.category) {
      setDecisionCategory(policy.category);
    }
    // Auto-redirect to Document Decision (Feature 4)
    setActiveTab(TABS.decision);
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
        company_id: safeUuid(profile?.company_id),
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
        // GM: store virtual signature text. Manager: no signature field.
        signature_status: isGeneralManager ? (gmSignatureText.trim() || null) : null,
        is_read: false,
      }]);
      if (error) throw error;
      setDecisionSituation(""); setDecisionAction(""); setDecisionCategory("");
      setDecisionPolicy(""); setCategoryManuallySet(false); setGmSignatureText("");
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
        company_id: safeUuid(profile?.company_id),
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
        : { pr: +metrics.pr_percent, pas: +metrics.pas_percent, ppd: +metrics.ppd_percent }
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

  // ── Facility Notes (Features 1 & 2) ──────────────────────────────────────

  const fetchFacilityNotes = async () => {
    if (!profile?.facility_number) return;
    setFacilityNotesLoading(true); setFacilityNotesMessage("");
    try {
      let q = supabase
        .from("facility_notes")
        .select("*")
        .eq("facility_number", profile.facility_number)
        .order("created_at", { ascending: false });
      q = applyCompanyScope(q, profile);
      // Non-managers can only see OPEN notes; GM/AC can see all
      if (!canManageFacilityNotes) q = q.neq("status", "closed");
      const { data, error } = await q;
      if (error) throw error;
      setFacilityNotes(data || []);
    } catch (err) {
      console.error("Fetch facility notes error:", err);
      setFacilityNotesMessage(err.message || "Failed to load facility notes.");
    } finally {
      setFacilityNotesLoading(false);
    }
  };

  const handleNewNoteSubmit = async () => {
    if (!newNoteText.trim()) { setFacilityNotesMessage("Please describe the issue."); return; }
    const noteTypeDb = NOTE_TYPE_DB[newNoteType];
    if (!noteTypeDb) { setFacilityNotesMessage("Invalid note type selected."); return; }
    setNewNoteSubmitting(true); setFacilityNotesMessage("");
    try {
      const { error } = await supabase.from("facility_notes").insert([{
        facility_number: profile.facility_number,
        company:         profile?.company           || null,
        company_id:      safeUuid(profile?.company_id),
        note_type:       noteTypeDb,
        priority:        newNotePriority,
        note_text:       newNoteText.trim(),
        status:          "open",
        created_by:      user.id,
        created_by_name: profile?.full_name || "Unknown",
        created_by_role: profile?.role      || "Manager",
      }]);
      if (error) throw error;
      setNewNoteText(""); setNewNoteType(NOTE_TYPES[0]); setNewNotePriority("normal");
      setShowNewNoteForm(false);
      await fetchFacilityNotes();
    } catch (err) {
      console.error("New note submit error:", err);
      setFacilityNotesMessage(err.message || "Failed to submit note.");
    } finally {
      setNewNoteSubmitting(false);
    }
  };

  const handleNoteStatusUpdate = async (noteId, newStatus) => {
    if (newStatus === "closed") {
      // Open resolution prompt instead of closing immediately
      setResolutionNoteId(noteId); setResolutionText(""); return;
    }
    setNoteStatusUpdating(noteId);
    try {
      const { data: updated, error } = await supabase.from("facility_notes")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", noteId)
        .select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Update blocked — check your permissions.");
      await fetchFacilityNotes();
    } catch (err) {
      console.error("Note status update error:", err);
      setFacilityNotesMessage(err.message || "Failed to update note status.");
    } finally {
      setNoteStatusUpdating(null);
    }
  };

  const handleCloseNoteWithResolution = async (noteId) => {
    if (!resolutionText.trim()) { setFacilityNotesMessage("Please enter a resolution before closing."); return; }
    setNoteStatusUpdating(noteId);
    try {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from("facility_notes").update({
        status:          "closed",
        resolution_text: resolutionText.trim(),
        closed_by:       user.id,
        closed_by_name:  profile?.full_name || "Unknown",
        closed_at:       now,
        updated_at:      now,
      }).eq("id", noteId).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Update blocked — check your permissions.");
      setResolutionNoteId(null); setResolutionText("");
      await fetchFacilityNotes();
    } catch (err) {
      console.error("Close note error:", err);
      setFacilityNotesMessage(err.message || "Failed to close note.");
    } finally {
      setNoteStatusUpdating(null);
    }
  };

  // ── Dashboard loader (called on tab enter) ────────────────────────────────
  const enterDashboard = async () => {
    if (!profile) return;
    setDashboardLoading(true);
    try {
      if (isGeneralManager) {
        const metrics = await loadGmDashboardMetrics(profile);
        setGmMetrics({ pr: metrics.pr, pas: metrics.pas });
      } else if (isAreaManager) {
        const [metrics, territory] = await Promise.all([
          loadAmDashboardMetrics(profile),
          loadAmTerritoryData(profile),
        ]);
        setAmMetrics({ pr: metrics.pr, pas: metrics.pas, ppd: metrics.ppd });
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
    { divider: true,                                        show: canViewFacilityNotes },
    { tab: TABS.facilityNotes,  label: "Facility Notes",    show: canViewFacilityNotes,                   onEnter: fetchFacilityNotes },
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
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.20s ease both; }
        .nav-tab:hover { color: #ccd9ea !important; }
        .person-row:hover { border-left-color: #1a80ff !important; background: rgba(26,128,255,0.04) !important; }
        .metric-card-click:hover { box-shadow: 0 0 0 1px rgba(26,128,255,0.35), 0 4px 20px rgba(26,128,255,0.08) !important; transform: translateY(-1px); }
        .metric-card-click { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        textarea:focus, input[type="text"]:focus, input[type="email"]:focus, input[type="password"]:focus, select:focus {
          border-color: rgba(26,128,255,0.45) !important;
          box-shadow: 0 0 0 3px rgba(26,128,255,0.07) !important;
          outline: none !important;
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #03070f; }
        ::-webkit-scrollbar-thumb { background: #162840; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #1d3a55; }
        .manager-row-btn:hover { border-left-color: #1a80ff !important; background: rgba(26,128,255,0.04) !important; }
        .log-type-btn:hover { border-top-color: #1a80ff !important; }
        .facility-pill:hover { border-color: #1a80ff !important; background: rgba(26,128,255,0.06) !important; }
        .sort-btn:hover { color: #ccd9ea !important; border-color: #1d3a55 !important; }
      `}} />

      {/* ── TOP HEADER ── */}
      <header style={styles.topNav}>
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
                {GM_METRIC_DEFS.map((metric) => {
                  const drillRoutes = { pr: "/gm-pr-breakdown", pas: "/gm-pas-breakdown" };
                  const route = drillRoutes[metric.key];
                  return (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      value={gmAnimatedMetrics[metric.key] || 0}
                      onClick={route ? () => router.push(route) : undefined}
                    />
                  );
                })}
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
              <p style={styles.subtitle}>Describe the situation to search your company policy library. Select a policy to pre-fill Document Decision.</p>
            </div>
            <div style={styles.panelCard}>
              <label style={styles.label}>Describe the situation</label>
              <textarea
                value={policyText}
                onChange={(e) => { setPolicyText(e.target.value); if (policyResults.length || policySearchError) { setPolicyResults([]); setPolicySearchError(""); setSelectedPolicy(null); setPolicyMessage(""); } }}
                placeholder="Example: An employee showed up 30 minutes late without calling. What does company policy say I should do?"
                style={styles.textarea}
              />
              <button
                style={{ ...styles.primaryButton, ...(policySearchLoading ? styles.buttonDisabled : {}) }}
                onClick={handlePullPolicy}
                disabled={policySearchLoading}
              >
                {policySearchLoading ? "Searching…" : "Search Policy"}
              </button>
              {policyMessage && (
                <p style={{ ...styles.message, color: selectedPolicy ? PALETTE.green : PALETTE.textSoft }}>
                  {policyMessage}
                </p>
              )}
            </div>

            {/* Search results */}
            {(policySearchLoading || policySearchError || policyResults.length > 0) && (
              <div style={styles.panelCard} className="fade-up">
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>
                    {policySearchLoading
                      ? "Searching policies…"
                      : policySearchError
                      ? "Search Error"
                      : `${policyResults.length} result${policyResults.length !== 1 ? "s" : ""} found`}
                  </div>
                  {policySearchCategory && !policySearchLoading && (
                    <div style={styles.sectionHint}>Matched category: {policySearchCategory}</div>
                  )}
                </div>

                {policySearchError ? (
                  <p style={{ ...styles.message, color: PALETTE.red }}>{policySearchError}</p>
                ) : policySearchLoading ? (
                  <p style={styles.message}>Loading…</p>
                ) : policyResults.length === 0 ? (
                  <p style={styles.message}>No matching policies found. Try rephrasing your description.</p>
                ) : (
                  <div style={styles.cardList}>
                    {policyResults.map((policy) => (
                      <PolicyResultCard
                        key={policy.id}
                        policy={policy}
                        onUse={handleUsePolicy}
                        isSelected={selectedPolicy?.id === policy.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
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

              {/* ── GM-only: Virtual Signature Box ── */}
              {isGeneralManager && (
                <>
                  <div style={styles.sectionDivider} />
                  <div style={styles.sectionTitle}>Employee Signature</div>
                  <div style={styles.sigBoxWrap}>
                    <div style={styles.sigBoxLabel}>Type employee's full name as digital signature</div>
                    <input
                      type="text"
                      value={gmSignatureText}
                      onChange={(e) => setGmSignatureText(e.target.value)}
                      placeholder="Sign here…"
                      style={styles.sigBoxInput}
                      autoComplete="off"
                    />
                    {gmSignatureText.trim() && (
                      <div style={styles.sigBoxPreview}>
                        <span style={styles.sigBoxPreviewLabel}>Signed as:</span>
                        <span style={styles.sigBoxPreviewName}>{gmSignatureText.trim()}</span>
                        <button
                          type="button"
                          style={styles.sigBoxClear}
                          onClick={() => setGmSignatureText("")}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {!gmSignatureText.trim() && (
                      <div style={styles.sigWarning}>
                        ⚠ HR recommends having EE signatures before submitting documents.
                      </div>
                    )}
                  </div>
                </>
              )}

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
                  <button className="log-type-btn" style={styles.logTypeButton} onClick={() => setMyLogType("decisions")}>
                    <div style={styles.logTypeTitle}>Decision Logs</div>
                    <div style={styles.logTypeMeta}>{myDecisions.length} record{myDecisions.length !== 1 ? "s" : ""}</div>
                  </button>
                  <button className="log-type-btn" style={styles.logTypeButton} onClick={() => setMyLogType("coaching")}>
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
                        className="manager-row-btn"
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
                  <button style={styles.secondaryButton} onClick={() => { setSelectedFacility(null); setFacilityPeople([]); setSelectedPerson(null); setFacilityMetrics({ pr: 0, pas: 0, ppd: 0 }); setFacilityBreakdown(getMockBreakdown("")); }}>
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
                          className="facility-pill"
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
        {/* ════════════════════════════════════════════════════════════════════
            FACILITY NOTES  (any user with a facility_number)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === TABS.facilityNotes && canViewFacilityNotes && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.dashHeaderRow}>
                <div>
                  <h1 style={styles.title}>Facility Notes</h1>
                  <p style={styles.subtitle}>
                    Log facility issues for Facility {profile?.facility_number || "—"}.
                    {canManageFacilityNotes
                      ? " As GM / Area Coach you can update status and close notes."
                      : " GM and Area Coach can update status and close notes."}
                  </p>
                </div>
                <button
                  style={styles.primaryButton}
                  onClick={() => { setShowNewNoteForm((v) => !v); setFacilityNotesMessage(""); }}
                >
                  {showNewNoteForm ? "Cancel" : "+ New Note"}
                </button>
              </div>
            </div>

            {/* ── New note form ── */}
            {showNewNoteForm && (
              <div style={styles.panelCard} className="fade-up">
                <div style={styles.sectionHeading}>New Facility Note</div>
                <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <div>
                    <label style={styles.label}>Note Type</label>
                    <select value={newNoteType} onChange={(e) => setNewNoteType(e.target.value)} style={styles.categorySelect}>
                      {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Priority</label>
                    <select value={newNotePriority} onChange={(e) => setNewNotePriority(e.target.value)} style={styles.categorySelect}>
                      {NOTE_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ ...styles.label, marginTop: "14px" }}>Describe the issue</label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  style={styles.textareaSmall}
                />
                <button
                  style={{ ...styles.primaryButton, ...(newNoteSubmitting ? styles.buttonDisabled : {}) }}
                  onClick={handleNewNoteSubmit}
                  disabled={newNoteSubmitting}
                >
                  {newNoteSubmitting ? "Submitting…" : "Submit Note"}
                </button>
              </div>
            )}

            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>
                  {canManageFacilityNotes ? "All Notes" : "Open Notes"}
                </div>
                <button style={styles.secondaryButton} onClick={fetchFacilityNotes}>Refresh</button>
              </div>

              {facilityNotesMessage && (
                <p style={{ ...styles.message, color: PALETTE.amber }}>{facilityNotesMessage}</p>
              )}

              {facilityNotesLoading ? (
                <p style={styles.message}>Loading notes...</p>
              ) : facilityNotes.length === 0 ? (
                <p style={styles.message}>No facility notes on record. Use "+ New Note" to log an issue.</p>
              ) : (
                <div style={styles.cardList}>
                  {facilityNotes.map((note) => {
                    const priorityColor = note.priority === "urgent" ? PALETTE.red
                      : note.priority === "high"   ? PALETTE.amber
                      : note.priority === "low"    ? PALETTE.textMuted
                      : PALETTE.textSoft;
                    const statusColor = note.status === "closed"      ? PALETTE.green
                      : note.status === "in_progress" ? PALETTE.amber
                      : PALETTE.blue;
                    return (
                      <div key={note.id} style={{ ...styles.feedCard, opacity: note.status === "closed" ? 0.75 : 1 }}>
                        <div style={styles.feedTop}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.feedName}>{NOTE_TYPE_LABEL[note.note_type] || note.note_type}</div>
                            <div style={styles.feedMeta}>
                              {note.created_by_name || "Unknown"} · {note.created_by_role || ""} · {formatDate(note.created_at)}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                            <span style={{ ...styles.notePriorityBadge, color: priorityColor, borderColor: priorityColor }}>
                              {note.priority}
                            </span>
                            <span style={{ ...styles.noteStatusBadge, color: statusColor, borderColor: statusColor }}>
                              {note.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <div style={{ ...styles.feedBody, marginTop: "6px" }}>{note.note_text}</div>

                        {/* Resolution block — visible on closed notes */}
                        {note.status === "closed" && note.resolution_text && (
                          <div style={styles.noteResolutionBlock}>
                            <div style={styles.noteResolutionLabel}>Resolution</div>
                            <div style={{ ...styles.feedBody, fontSize: "13px" }}>{note.resolution_text}</div>
                            <div style={{ fontSize: "12px", color: PALETTE.textMuted, marginTop: "4px" }}>
                              Closed by {note.closed_by_name || "leadership"} · {formatDate(note.closed_at)}
                            </div>
                            <div style={{ ...styles.message, color: PALETTE.textMuted, fontSize: "12px", marginTop: "8px", fontStyle: "italic" }}>
                              If this resolution did not solve the issue, submit a new facility note.
                            </div>
                          </div>
                        )}

                        {/* Resolution input — shown when closing */}
                        {canManageFacilityNotes && resolutionNoteId === note.id && (
                          <div style={{ marginTop: "12px" }}>
                            <label style={styles.label}>Resolution (required to close)</label>
                            <textarea
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              placeholder="Describe how this issue was resolved..."
                              style={styles.guidanceTextarea}
                            />
                            <div style={styles.guidanceButtons}>
                              <button
                                style={{ ...styles.primaryButton, ...(noteStatusUpdating === note.id ? styles.buttonDisabled : {}) }}
                                onClick={() => handleCloseNoteWithResolution(note.id)}
                                disabled={noteStatusUpdating === note.id || !resolutionText.trim()}
                              >
                                {noteStatusUpdating === note.id ? "Closing…" : "Confirm Close"}
                              </button>
                              <button style={styles.secondaryButton} onClick={() => { setResolutionNoteId(null); setResolutionText(""); }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Status controls — GM / Area Coach only, on non-closed notes */}
                        {canManageFacilityNotes && note.status !== "closed" && resolutionNoteId !== note.id && (
                          <div style={{ ...styles.actionRow, marginTop: "12px" }}>
                            {note.status === "open" && (
                              <button
                                style={{ ...styles.secondaryButton, ...(noteStatusUpdating === note.id ? styles.buttonDisabled : {}) }}
                                onClick={() => handleNoteStatusUpdate(note.id, "in_progress")}
                                disabled={!!noteStatusUpdating}
                              >
                                Mark In Progress
                              </button>
                            )}
                            {(note.status === "open" || note.status === "in_progress") && (
                              <button
                                style={{ ...styles.secondaryButton, ...(noteStatusUpdating === note.id ? styles.buttonDisabled : {}) }}
                                onClick={() => handleNoteStatusUpdate(note.id, "closed")}
                                disabled={!!noteStatusUpdating}
                              >
                                Close Note
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* ── APP FOOTER ── */}
      <footer style={styles.appFooter}>
        <a href="/support" style={styles.appFooterLink}>Contact Support</a>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES  — trading terminal / financial dark
// ─────────────────────────────────────────────────────────────────────────────
const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

const styles = {
  page: {
    minHeight: "100vh",
    background: PALETTE.bg,
    color: PALETTE.text,
    padding: "0",
    boxSizing: "border-box",
    fontFamily: SANS,
  },
  loadingCard: {
    maxWidth: "480px", margin: "0 auto", paddingTop: "120px",
    textAlign: "center", color: PALETTE.textSoft, fontSize: "13px",
    letterSpacing: "0.06em", textTransform: "uppercase",
  },

  // ── TOP NAV — full-width sticky terminal toolbar
  topNav: {
    background: PALETTE.panel,
    borderBottom: `1px solid ${PALETTE.border}`,
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
    position: "sticky", top: 0, zIndex: 100,
    height: "52px",
    paddingLeft: "20px",
    paddingRight: "16px",
    boxSizing: "border-box",
    gap: "0",
  },
  topNavBrand: { minWidth: "200px", flexShrink: 0 },
  topNavName:  { fontWeight: 700, color: PALETTE.text, lineHeight: 1.1, fontSize: "13px", letterSpacing: "0.01em" },
  topNavMeta:  { color: PALETTE.textSoft, marginTop: "2px", fontSize: "10px", letterSpacing: "0.04em", textTransform: "uppercase" },
  topNavItems: { display: "flex", alignItems: "stretch", gap: "0", flex: 1, overflowX: "auto", height: "52px" },
  topNavBtn: {
    border: "none",
    borderBottom: "2px solid transparent",
    borderTop: "2px solid transparent",
    background: "transparent",
    color: PALETTE.textSoft,
    padding: "0 13px",
    fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    letterSpacing: "0.05em", textTransform: "uppercase",
    display: "flex", alignItems: "center",
    transition: "color 0.15s ease",
  },
  topNavBtnActive: {
    borderBottom: `2px solid ${PALETTE.blue}`,
    color: PALETTE.text,
  },
  topNavDivider: { width: "1px", height: "20px", background: PALETTE.border, flexShrink: 0, alignSelf: "center", margin: "0 2px" },
  topNavRight:   { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  topNavLogout: {
    border: `1px solid ${PALETTE.border}`,
    background: "transparent",
    color: PALETTE.textSoft, borderRadius: "3px", padding: "5px 11px",
    fontSize: "10px", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.07em", textTransform: "uppercase",
  },
  mobileMenuBtn: {
    border: `1px solid ${PALETTE.border}`, background: "transparent",
    color: PALETTE.text, borderRadius: "3px", padding: "6px 10px",
    fontSize: "12px", fontWeight: 700, cursor: "pointer",
  },
  mobileDropdown: {
    background: PALETTE.panel,
    borderBottom: `1px solid ${PALETTE.border}`,
    padding: "10px 16px", display: "flex", flexDirection: "column", gap: "2px",
  },
  navDivider: { height: "1px", background: PALETTE.border, margin: "4px 0" },
  navButton: {
    width: "100%", textAlign: "left",
    border: "none", borderLeft: "2px solid transparent",
    background: "transparent", color: PALETTE.textSoft,
    padding: "10px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    letterSpacing: "0.04em", textTransform: "uppercase",
  },
  navButtonActive: {
    borderLeft: `2px solid ${PALETTE.blue}`,
    color: PALETTE.text,
    background: PALETTE.blueGlow,
  },
  logoutButton: {
    width: "100%", textAlign: "left",
    border: "none", borderLeft: "2px solid transparent",
    background: "transparent", color: PALETTE.textSoft,
    padding: "10px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    letterSpacing: "0.04em",
  },

  // ── LAYOUT
  main: {
    maxWidth: "1420px", margin: "0 auto",
    display: "flex", flexDirection: "column", gap: "14px",
    padding: "20px 16px",
    boxSizing: "border-box",
  },
  headerCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderLeft: `3px solid ${PALETTE.blue}`,
    borderRadius: "4px", padding: "20px 22px",
  },
  panelCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "4px", padding: "20px 22px",
  },

  // ── TYPOGRAPHY
  title: { margin: 0, fontSize: "22px", lineHeight: 1.1, fontWeight: 700, color: PALETTE.text, letterSpacing: "-0.01em" },
  subtitle: { margin: "8px 0 0", fontSize: "12px", lineHeight: 1.65, color: PALETTE.textSoft, maxWidth: "820px", letterSpacing: "0.01em" },
  label: { display: "block", marginBottom: "8px", fontSize: "10px", fontWeight: 700, color: PALETTE.textSoft, textTransform: "uppercase", letterSpacing: "0.09em" },
  message: { marginTop: "12px", fontSize: "13px", lineHeight: 1.6, color: PALETTE.textSoft },
  sectionTopRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "12px", flexWrap: "wrap", marginBottom: "16px",
  },
  sectionHeading: { fontSize: "11px", fontWeight: 800, color: PALETTE.text, textTransform: "uppercase", letterSpacing: "0.10em" },
  sectionHint:    { fontSize: "11px", color: PALETTE.textMuted, letterSpacing: "0.04em" },
  sectionDivider: { height: "1px", background: PALETTE.border, margin: "4px 0 16px" },
  sectionTitle: {
    marginBottom: "10px", fontSize: "10px", letterSpacing: "0.11em",
    textTransform: "uppercase", color: PALETTE.textMuted, fontWeight: 800,
  },
  autoDetectedText: { marginTop: "8px", marginBottom: "4px", fontSize: "11px", color: PALETTE.textMuted, letterSpacing: "0.03em" },

  // ── FORMS
  textarea: {
    width: "100%", minHeight: "200px", borderRadius: "3px",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "14px 16px", fontSize: "14px", lineHeight: 1.7,
    resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: "14px",
    fontFamily: SANS,
  },
  textareaSmall: {
    width: "100%", minHeight: "110px", borderRadius: "3px",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "14px 16px", fontSize: "14px", lineHeight: 1.7,
    resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: "14px",
    fontFamily: SANS,
  },
  categorySelect: {
    width: "100%", borderRadius: "3px", border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt, color: PALETTE.text, padding: "11px 13px",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  },
  policyInput: {
    width: "100%", borderRadius: "3px", border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt, color: PALETTE.text, padding: "11px 13px",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  },

  // ── BUTTONS
  primaryButton: {
    border: `1px solid ${PALETTE.blue}`,
    background: "rgba(26,128,255,0.12)",
    color: PALETTE.blue, borderRadius: "3px", padding: "8px 16px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.07em", textTransform: "uppercase",
  },
  secondaryButton: {
    border: `1px solid ${PALETTE.border}`, background: "transparent",
    color: PALETTE.textSoft, borderRadius: "3px", padding: "7px 13px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.05em",
  },
  buttonDisabled: { opacity: 0.45, cursor: "not-allowed" },

  // ── METRIC CARDS
  metricsGrid: {
    display: "grid", gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  metricCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderTop: "2px solid transparent",
    borderRadius: "4px", padding: "20px 18px",
  },
  metricLabel: {
    fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase",
    color: PALETTE.textSoft, marginBottom: "14px", fontWeight: 800,
  },
  metricValue: {
    fontSize: "44px", lineHeight: 1, fontWeight: 700,
    fontFamily: MONO,
    fontVariantNumeric: "tabular-nums", marginBottom: "16px",
    transition: "color 0.3s ease", letterSpacing: "-0.02em",
  },
  metricBarTrack: {
    background: PALETTE.panelAlt, borderRadius: "0", height: "3px",
    overflow: "hidden", marginBottom: "14px",
  },
  metricBarFill: {
    height: "100%", borderRadius: "0",
    transition: "width 0.12s ease, background 0.3s ease",
  },
  metricDesc:   { fontSize: "11px", color: PALETTE.textSoft, lineHeight: 1.5, letterSpacing: "0.01em" },
  metricTarget: { marginTop: "6px", fontSize: "10px", color: PALETTE.textMuted, letterSpacing: "0.04em" },

  // ── DASHBOARD HEADER
  dashHeaderRow: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
  },
  roleBadge: {
    padding: "4px 10px", borderRadius: "2px", fontSize: "10px",
    fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
    background: "rgba(26,128,255,0.10)", border: `1px solid rgba(26,128,255,0.28)`,
    color: PALETTE.blue, flexShrink: 0, alignSelf: "flex-start", marginTop: "4px",
  },

  // ── PERFORMANCE REFERENCE (GM)
  thresholdGrid: {
    display: "grid", gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  },
  thresholdItem: {
    background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`,
    borderRadius: "4px", padding: "16px",
  },
  thresholdLabel: { fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: PALETTE.textMuted, marginBottom: "8px" },
  thresholdValue: { fontSize: "18px", fontWeight: 700, color: PALETTE.text, marginBottom: "4px", fontVariantNumeric: "tabular-nums", fontFamily: MONO },
  thresholdDesc:  { fontSize: "11px", color: PALETTE.textSoft },

  // ── TERRITORY TABLE (AM)
  territoryTableWrap: { display: "flex", flexDirection: "column", gap: "1px", overflowX: "auto" },
  territoryHeaderRow: {
    display: "flex", alignItems: "center",
    padding: "8px 12px", borderBottom: `1px solid ${PALETTE.border}`, marginBottom: "2px",
  },
  territoryCellLabel: { fontSize: "10px", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: PALETTE.textMuted },
  territoryDataRow: {
    display: "flex", alignItems: "center", padding: "10px 12px",
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  territoryCell: { flex: 1, minWidth: "60px", fontSize: "13px", fontVariantNumeric: "tabular-nums", paddingRight: "8px", fontFamily: MONO, fontWeight: 600 },

  // ── PP/D LEGEND
  ppdLegendRow:  { display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" },
  ppdLegendItem: { display: "flex", alignItems: "center", gap: "8px" },
  ppdLegendDot:  { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  ppdLegendText: { fontSize: "12px", color: PALETTE.textSoft, fontWeight: 600 },

  // ── FEED / DECISION CARDS
  cardList: { display: "flex", flexDirection: "column", gap: "8px" },
  feedCard: {
    background: PALETTE.panelAlt,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "4px", padding: "14px 16px",
  },
  feedTop: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: "16px", marginBottom: "10px", flexWrap: "wrap",
  },
  feedName:   { fontSize: "14px", fontWeight: 700, color: PALETTE.text, marginBottom: "3px" },
  feedMeta:   { fontSize: "12px", color: PALETTE.textSoft },
  feedDate:   { fontSize: "11px", color: PALETTE.textMuted, fontFamily: MONO, fontVariantNumeric: "tabular-nums" },
  feedInlineRow: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" },
  feedSection:   { marginTop: "10px" },
  feedLabel: {
    marginBottom: "5px", fontSize: "10px", fontWeight: 800,
    letterSpacing: "0.10em", textTransform: "uppercase", color: PALETTE.textMuted,
  },
  feedBody: { fontSize: "13px", lineHeight: 1.65, color: PALETTE.text, whiteSpace: "pre-wrap" },
  policyTag: {
    display: "inline-flex", alignItems: "center", padding: "3px 8px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    background: "rgba(26,128,255,0.10)", border: `1px solid rgba(26,128,255,0.22)`, color: PALETTE.blue,
    letterSpacing: "0.04em",
  },
  unreadBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 8px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    background: PALETTE.amberSoft, border: `1px solid rgba(232,152,10,0.28)`, color: PALETTE.amber,
    letterSpacing: "0.04em",
  },
  categoryBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 8px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  statusBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 8px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase",
    background: "rgba(77,106,132,0.10)", border: `1px solid ${PALETTE.border}`, color: PALETTE.textSoft,
  },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" },
  guidanceBlock: { marginTop: "12px", borderLeft: `2px solid ${PALETTE.blue}`, paddingLeft: "12px" },
  guidanceLabel: {
    fontSize: "10px", fontWeight: 800, color: PALETTE.blue,
    letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "5px",
  },
  guidancePrompt:  { width: "100%" },
  guidanceTextarea: {
    width: "100%", minHeight: "110px", borderRadius: "3px",
    border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt,
    color: PALETTE.text, padding: "12px 14px", fontSize: "13px", lineHeight: 1.65,
    resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: SANS,
  },
  guidanceButtons: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" },

  // ── MANAGERS
  managersLayout: { display: "grid", gap: "14px" },
  managerRowButton: {
    width: "100%", textAlign: "left", borderRadius: "3px",
    border: `1px solid ${PALETTE.border}`,
    borderLeft: "2px solid transparent",
    background: "transparent",
    padding: "12px 14px", cursor: "pointer",
  },
  managerRowButtonActive: {
    border: `1px solid ${PALETTE.border}`,
    borderLeft: `2px solid ${PALETTE.blue}`,
    background: PALETTE.blueGlow,
  },
  managerRowName: { fontSize: "14px", fontWeight: 700, color: PALETTE.text, marginBottom: "3px" },
  managerRowMeta: { fontSize: "12px", color: PALETTE.textSoft },

  // ── LOG TYPE SELECTOR
  logTypeSelector: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" },
  logTypeButton: {
    textAlign: "left", borderRadius: "4px",
    border: `1px solid ${PALETTE.border}`,
    borderTop: `2px solid ${PALETTE.border}`,
    background: "transparent",
    padding: "16px 18px", cursor: "pointer",
    transition: "border-top-color 0.15s ease",
  },
  logTypeTitle: { fontSize: "14px", fontWeight: 700, color: PALETTE.text, marginBottom: "6px" },
  logTypeMeta:  { fontSize: "12px", color: PALETTE.textSoft, fontVariantNumeric: "tabular-nums", fontFamily: MONO },

  // ── FACILITIES
  facilitiesHeaderTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
  facilitySelectorWrap: { marginTop: "16px" },
  facilityPillWrap: { display: "flex", gap: "8px", flexWrap: "wrap" },
  facilityPill: {
    border: `1px solid ${PALETTE.border}`,
    borderLeft: `2px solid ${PALETTE.blue}`,
    background: "transparent", color: PALETTE.text,
    borderRadius: "3px", padding: "8px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "8px",
    letterSpacing: "0.02em",
  },
  facilityPillMeta: { fontSize: "11px", color: PALETTE.textMuted, fontWeight: 600 },
  breadcrumb: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "12px" },
  breadcrumbLink: { border: "none", padding: 0, background: "transparent", color: PALETTE.blue, fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" },
  breadcrumbSep:  { color: PALETTE.textMuted, fontSize: "13px" },
  breadcrumbCurrent: { color: PALETTE.textSoft, fontSize: "12px", fontWeight: 700 },

  // ── CATEGORY BREAKDOWN
  breakdownList:   { display: "flex", flexDirection: "column", gap: "14px" },
  breakdownItem:   { display: "flex", flexDirection: "column", gap: "7px" },
  breakdownTop:    { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  breakdownLeft:   { display: "flex", alignItems: "center", gap: "10px" },
  breakdownBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 8px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  breakdownPercent: { fontSize: "18px", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: MONO },
  breakdownTrack:   { background: PALETTE.panelAlt, borderRadius: "0", height: "3px", overflow: "hidden" },
  breakdownFill:    { height: "100%", borderRadius: "0", transition: "width 0.12s ease" },

  // ── PEOPLE / PERSON FILE
  peopleList:  { display: "flex", flexDirection: "column", gap: "4px" },
  personRow: {
    width: "100%", textAlign: "left",
    border: `1px solid ${PALETTE.border}`,
    borderLeft: "2px solid transparent",
    background: "transparent", borderRadius: "3px", padding: "12px 16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: "12px", cursor: "pointer",
  },
  personName:  { fontSize: "13px", fontWeight: 700, color: PALETTE.text, marginBottom: "2px" },
  personMeta:  { fontSize: "11px", color: PALETTE.textSoft },
  personRight: { display: "flex", alignItems: "center", gap: "10px" },
  personRoleBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  personRoleBadgeGm:  { background: "rgba(26,128,255,0.10)", color: PALETTE.blue, border: `1px solid rgba(26,128,255,0.24)` },
  personRoleBadgeMgr: { background: PALETTE.indigoSoft, color: "#a0b4e8", border: `1px solid rgba(100,120,200,0.24)` },
  personChevron: { color: PALETTE.textMuted, fontSize: "16px", lineHeight: 1 },

  personFileStack:  { display: "flex", flexDirection: "column", gap: "12px" },
  personFileTitle:  { fontSize: "18px", fontWeight: 700, color: PALETTE.text },
  personFileMeta:   { fontSize: "12px", color: PALETTE.textSoft, marginTop: "3px" },
  personStatsRow:   { display: "flex", gap: "14px", alignItems: "center", marginTop: "14px", flexWrap: "wrap" },
  personStatBlock:  { textAlign: "center" },
  personStatValue:  { fontSize: "22px", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", fontFamily: MONO },
  personStatLabel:  { marginTop: "4px", fontSize: "10px", color: PALETTE.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 },
  personStatDivider:{ width: "1px", height: "30px", background: PALETTE.border },

  // ── POLICY RESULT CARDS
  policyCodeBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase",
    background: "rgba(26,128,255,0.10)", border: `1px solid rgba(26,128,255,0.24)`, color: PALETTE.blue,
  },
  versionTag: {
    display: "inline-flex", alignItems: "center", padding: "3px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 700,
    background: "rgba(77,106,132,0.08)", border: `1px solid ${PALETTE.border}`, color: PALETTE.textMuted,
  },

  emptyState:      { textAlign: "center", padding: "32px 0" },
  emptyStateIcon:  { fontSize: "22px", marginBottom: "10px" },
  emptyStateTitle: { fontSize: "12px", fontWeight: 700, color: PALETTE.textSoft, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em" },
  emptyStateText:  { fontSize: "11px", color: PALETTE.textMuted },
  emptyStateTight: { textAlign: "center", padding: "24px 0", fontSize: "12px", color: PALETTE.textSoft },

  // ── CLICKABLE METRIC CARDS (GM drill-through)
  metricCardClickable: {
    cursor: "pointer",
    border: `1px solid rgba(26,128,255,0.20)`,
  },
  metricCardDrillHint: {
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
    color: PALETTE.blue, textTransform: "uppercase", marginBottom: "12px",
    textAlign: "right",
  },

  // ── GM VIRTUAL SIGNATURE BOX
  sigBoxWrap: { marginTop: "4px" },
  sigBoxLabel: { fontSize: "12px", color: PALETTE.textSoft, marginBottom: "10px", fontWeight: 600 },
  sigBoxInput: {
    width: "100%", borderRadius: "3px",
    border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt,
    color: "#c8dcf0", padding: "14px 18px", fontSize: "20px",
    fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
    outline: "none", boxSizing: "border-box", letterSpacing: "0.03em",
  },
  sigBoxPreview: {
    display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap",
  },
  sigBoxPreviewLabel: { fontSize: "10px", color: PALETTE.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
  sigBoxPreviewName: {
    fontSize: "18px", fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: "italic", color: PALETTE.green, letterSpacing: "0.02em",
  },
  sigBoxClear: {
    background: "transparent", border: `1px solid ${PALETTE.border}`,
    color: PALETTE.textMuted, borderRadius: "3px", padding: "4px 10px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer",
  },
  sigWarning: {
    background: PALETTE.amberSoft,
    border: `1px solid rgba(232,152,10,0.30)`,
    borderRadius: "3px",
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: PALETTE.amber,
    marginBottom: "4px",
  },

  // ── FACILITY NOTES
  notePriorityBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 800,
    letterSpacing: "0.08em", textTransform: "uppercase",
    border: "1px solid", background: "transparent",
  },
  noteStatusBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 800,
    letterSpacing: "0.08em", textTransform: "uppercase",
    border: "1px solid", background: "transparent",
  },
  noteResolutionBlock: {
    marginTop: "12px",
    background: "rgba(0,200,122,0.07)",
    border: `1px solid rgba(0,200,122,0.20)`,
    borderLeft: `2px solid ${PALETTE.green}`,
    borderRadius: "3px",
    padding: "12px 14px",
  },
  noteResolutionLabel: {
    fontSize: "10px", fontWeight: 800, color: PALETTE.green,
    letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "5px",
  },

  // ── APP FOOTER
  appFooter: {
    borderTop: `1px solid ${PALETTE.border}`,
    padding: "14px 20px",
    textAlign: "center",
    marginTop: "8px",
  },
  appFooterLink: {
    fontSize: "11px", fontWeight: 600, color: PALETTE.textSoft,
    textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
  },
};
