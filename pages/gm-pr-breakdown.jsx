import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE  (matches dashboard.jsx exactly)
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
  blue:         "#3d6899",
  blueSoft:     "rgba(61, 104, 153, 0.13)",
  green:        "#4a7c61",
  greenSoft:    "rgba(74, 124, 97, 0.13)",
  amber:        "#9a7840",
  amberSoft:    "rgba(154, 120, 64, 0.13)",
  red:          "#8a4848",
  redSoft:      "rgba(138, 72, 72, 0.13)",
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — 6 managers with PR% scores and category breakdowns
// Replace with real Supabase queries when backend is ready.
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PR_MANAGERS = [
  {
    id: 1,
    name: "Marcus Rivera",
    facility: "#1041",
    pr: 82,
    prevPr: 79,
    hr: 36,
    ops: 38,
    foodSafety: 26,
    trend: "up",
  },
  {
    id: 2,
    name: "Taryn Mills",
    facility: "#1044",
    pr: 71,
    prevPr: 73,
    hr: 28,
    ops: 42,
    foodSafety: 30,
    trend: "down",
  },
  {
    id: 3,
    name: "David Osei",
    facility: "#1049",
    pr: 65,
    prevPr: 70,
    hr: 22,
    ops: 50,
    foodSafety: 28,
    trend: "down",
  },
  {
    id: 4,
    name: "Priya Anand",
    facility: "#1062",
    pr: 88,
    prevPr: 87,
    hr: 40,
    ops: 32,
    foodSafety: 28,
    trend: "up",
  },
  {
    id: 5,
    name: "Chris Fenton",
    facility: "#1071",
    pr: 58,
    prevPr: 66,
    hr: 18,
    ops: 54,
    foodSafety: 28,
    trend: "down",
  },
  {
    id: 6,
    name: "Aaliyah Grant",
    facility: "#1055",
    pr: 76,
    prevPr: 74,
    hr: 32,
    ops: 40,
    foodSafety: 28,
    trend: "up",
  },
];

function prColor(value) {
  if (value >= 85) return PALETTE.green;
  if (value >= 70) return PALETTE.amber;
  return PALETTE.red;
}

function prBg(value) {
  if (value >= 85) return PALETTE.greenSoft;
  if (value >= 70) return PALETTE.amberSoft;
  return PALETTE.redSoft;
}

function prBorder(value) {
  if (value >= 85) return "rgba(74,124,97,0.28)";
  if (value >= 70) return "rgba(154,120,64,0.28)";
  return "rgba(138,72,72,0.28)";
}

const CATEGORY_COLORS = {
  HR:           { color: "#7a94be", bg: "rgba(122,148,190,0.12)", border: "rgba(122,148,190,0.24)" },
  Operations:   { color: "#5e8f88", bg: "rgba(94,143,136,0.12)",  border: "rgba(94,143,136,0.24)"  },
  "Food Safety":{ color: "#a08454", bg: "rgba(160,132,84,0.12)",  border: "rgba(160,132,84,0.24)"  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GmPrBreakdown() {
  const router  = useRouter();
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState("pr_desc"); // pr_desc | pr_asc | name_asc

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      setLoading(false);
    };
    check();
  }, [router]);

  const sorted = [...MOCK_PR_MANAGERS].sort((a, b) => {
    if (sort === "pr_asc")   return a.pr - b.pr;
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    return b.pr - a.pr; // default: pr_desc
  });

  const avg = Math.round(MOCK_PR_MANAGERS.reduce((s, m) => s + m.pr, 0) / MOCK_PR_MANAGERS.length);
  const atTarget  = MOCK_PR_MANAGERS.filter((m) => m.pr >= 85).length;
  const needsAttn = MOCK_PR_MANAGERS.filter((m) => m.pr < 70).length;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: PALETTE.textSoft, fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.22s ease both; }
        .bar-fill { transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }
      `}} />

      {/* ── HEADER ── */}
      <header style={styles.topNav}>
        <div>
          <div style={styles.topNavTitle}>PR% · Manager Breakdown</div>
          <div style={styles.topNavSub}>Policy Reference Rate — all managers · mock data</div>
        </div>
        <button style={styles.backBtn} onClick={() => router.back()}>
          ← Back to Dashboard
        </button>
      </header>

      <main style={styles.main}>

        {/* ── SUMMARY ROW ── */}
        <div style={styles.summaryRow} className="fade-up">
          <div style={styles.summaryCard}>
            <div style={styles.summaryValue}>{avg}%</div>
            <div style={styles.summaryLabel}>Facility Average</div>
          </div>
          <div style={{ ...styles.summaryCard, borderColor: "rgba(74,124,97,0.3)", background: PALETTE.greenSoft }}>
            <div style={{ ...styles.summaryValue, color: PALETTE.green }}>{atTarget}</div>
            <div style={styles.summaryLabel}>At Target (≥ 85%)</div>
          </div>
          <div style={{ ...styles.summaryCard, borderColor: "rgba(138,72,72,0.3)", background: PALETTE.redSoft }}>
            <div style={{ ...styles.summaryValue, color: PALETTE.red }}>{needsAttn}</div>
            <div style={styles.summaryLabel}>Needs Attention (&lt; 70%)</div>
          </div>
        </div>

        {/* ── SORT CONTROL ── */}
        <div style={styles.panelCard} className="fade-up">
          <div style={styles.sectionTopRow}>
            <div style={styles.sectionHeading}>Manager Breakdown</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={styles.sortLabel}>Sort:</span>
              {[
                { value: "pr_desc",  label: "PR% High→Low" },
                { value: "pr_asc",   label: "PR% Low→High" },
                { value: "name_asc", label: "Name A→Z"     },
              ].map((opt) => (
                <button
                  key={opt.value}
                  style={{ ...styles.sortBtn, ...(sort === opt.value ? styles.sortBtnActive : {}) }}
                  onClick={() => setSort(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.cardList}>
            {sorted.map((mgr) => {
              const color  = prColor(mgr.pr);
              const bg     = prBg(mgr.pr);
              const border = prBorder(mgr.pr);
              const delta  = mgr.pr - mgr.prevPr;
              const total  = mgr.hr + mgr.ops + mgr.foodSafety;

              return (
                <div key={mgr.id} style={styles.mgrCard} className="fade-up">
                  {/* Top row */}
                  <div style={styles.mgrTop}>
                    <div style={styles.mgrLeft}>
                      <div style={styles.mgrName}>{mgr.name}</div>
                      <div style={styles.mgrMeta}>Manager · Facility {mgr.facility}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {/* Delta badge */}
                      <span style={{
                        fontSize: "11px", fontWeight: 700, padding: "3px 8px",
                        borderRadius: "999px",
                        color:      delta >= 0 ? PALETTE.green : PALETTE.red,
                        background: delta >= 0 ? PALETTE.greenSoft : PALETTE.redSoft,
                        border:     `1px solid ${delta >= 0 ? "rgba(74,124,97,0.28)" : "rgba(138,72,72,0.28)"}`,
                      }}>
                        {delta >= 0 ? "+" : ""}{delta}% vs prior
                      </span>
                      {/* Score badge */}
                      <span style={{
                        fontSize: "22px", fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color, background: bg,
                        border: `1px solid ${border}`,
                        borderRadius: "12px", padding: "6px 14px",
                      }}>
                        {mgr.pr}%
                      </span>
                    </div>
                  </div>

                  {/* PR bar */}
                  <div style={styles.barTrack}>
                    <div
                      className="bar-fill"
                      style={{ ...styles.barFill, width: `${Math.min(mgr.pr, 100)}%`, background: color }}
                    />
                    <div style={{ ...styles.barTarget, left: "85%" }} />
                  </div>
                  <div style={styles.barLabels}>
                    <span style={styles.barLabelLeft}>0%</span>
                    <span style={{ ...styles.barLabelTarget, left: "85%" }}>Target 85%</span>
                    <span style={styles.barLabelRight}>100%</span>
                  </div>

                  {/* Category breakdown */}
                  <div style={styles.catRow}>
                    {[
                      { label: "HR",           val: mgr.hr,          pct: ((mgr.hr / total) * 100).toFixed(0) },
                      { label: "Operations",   val: mgr.ops,         pct: ((mgr.ops / total) * 100).toFixed(0) },
                      { label: "Food Safety",  val: mgr.foodSafety,  pct: ((mgr.foodSafety / total) * 100).toFixed(0) },
                    ].map(({ label, val, pct }) => {
                      const cs = CATEGORY_COLORS[label];
                      return (
                        <div key={label} style={styles.catItem}>
                          <span style={{ ...styles.catBadge, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}` }}>
                            {label === "Operations" ? "Ops" : label}
                          </span>
                          <span style={{ ...styles.catPct, color: cs.color }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MOCK DATA NOTICE ── */}
        <div style={styles.mockNotice}>
          ⚡ Showing mock data — replace <code>MOCK_PR_MANAGERS</code> in <code>pages/gm-pr-breakdown.jsx</code> with a real Supabase query when ready.
        </div>

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
  topNav: {
    maxWidth: "1420px", margin: "0 auto 18px",
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", padding: "18px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "16px", flexWrap: "wrap",
    boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
  },
  topNavTitle: { fontSize: "20px", fontWeight: 800, color: PALETTE.text },
  topNavSub:   { fontSize: "13px", color: PALETTE.textSoft, marginTop: "3px" },
  backBtn: {
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.text, borderRadius: "14px", padding: "10px 16px",
    fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  main: { maxWidth: "1420px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" },
  summaryRow: { display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" },
  summaryCard: {
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "20px", padding: "20px 22px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
  },
  summaryValue: { fontSize: "36px", fontWeight: 800, color: PALETTE.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  summaryLabel: { fontSize: "12px", color: PALETTE.textSoft, marginTop: "8px", fontWeight: 600 },
  panelCard: {
    background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px", padding: "22px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  sectionTopRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "12px", flexWrap: "wrap", marginBottom: "16px",
  },
  sectionHeading: { fontSize: "20px", fontWeight: 800, color: PALETTE.text },
  sortLabel: { fontSize: "12px", color: PALETTE.textMuted, fontWeight: 700 },
  sortBtn: {
    border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.panelAlt,
    color: PALETTE.textSoft, borderRadius: "999px", padding: "6px 12px",
    fontSize: "12px", fontWeight: 700, cursor: "pointer",
  },
  sortBtnActive: {
    background: PALETTE.blueSoft, color: "#c8dcf0",
    border: `1px solid rgba(61,104,153,0.34)`,
  },
  cardList: { display: "flex", flexDirection: "column", gap: "14px" },
  mgrCard: {
    background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`,
    borderRadius: "18px", padding: "18px 20px",
  },
  mgrTop: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: "16px", marginBottom: "14px", flexWrap: "wrap",
  },
  mgrLeft:  {},
  mgrName:  { fontSize: "16px", fontWeight: 800, color: PALETTE.text, marginBottom: "3px" },
  mgrMeta:  { fontSize: "13px", color: PALETTE.textSoft },
  barTrack: {
    position: "relative", background: "#0d1e30", borderRadius: "999px",
    height: "8px", overflow: "visible", marginBottom: "4px",
  },
  barFill:  { height: "100%", borderRadius: "999px" },
  barTarget: {
    position: "absolute", top: "-4px", bottom: "-4px",
    width: "2px", background: "rgba(255,255,255,0.18)", borderRadius: "1px",
  },
  barLabels: {
    position: "relative", display: "flex", justifyContent: "space-between",
    fontSize: "10px", color: PALETTE.textMuted, marginBottom: "14px",
  },
  barLabelLeft:   {},
  barLabelRight:  {},
  barLabelTarget: {
    position: "absolute", transform: "translateX(-50%)",
    color: PALETTE.textMuted, fontSize: "10px",
  },
  catRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  catItem: { display: "flex", alignItems: "center", gap: "6px" },
  catBadge: {
    display: "inline-flex", alignItems: "center", padding: "3px 9px",
    borderRadius: "999px", fontSize: "10px", fontWeight: 800,
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  catPct: { fontSize: "12px", fontWeight: 800 },
  mockNotice: {
    fontSize: "12px", color: PALETTE.textMuted, textAlign: "center",
    padding: "12px", borderRadius: "12px",
    background: "rgba(143,163,184,0.04)", border: `1px solid ${PALETTE.border}`,
  },
};
