import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE  — trading terminal (matches dashboard.jsx)
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:           "#03070f",
  panel:        "#070f1c",
  panelAlt:     "#0a1626",
  border:       "#0e1e30",
  borderStrong: "#162840",
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
};

const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — 6 managers with PAS% scores
// Replace with real Supabase queries when backend is ready.
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PAS_MANAGERS = [
  { id: 1, name: "Marcus Rivera",  facility: "#1041", pas: 89, prevPas: 86, violations: 2,  topIssue: "Temp logging gaps",       streak: 14 },
  { id: 2, name: "Taryn Mills",    facility: "#1044", pas: 78, prevPas: 80, violations: 6,  topIssue: "Late open checklist",     streak: 3  },
  { id: 3, name: "David Osei",     facility: "#1049", pas: 72, prevPas: 75, violations: 9,  topIssue: "Glove compliance",        streak: 1  },
  { id: 4, name: "Priya Anand",    facility: "#1062", pas: 93, prevPas: 91, violations: 1,  topIssue: "None flagged",            streak: 31 },
  { id: 5, name: "Chris Fenton",   facility: "#1071", pas: 64, prevPas: 72, violations: 14, topIssue: "Missing daily logs",      streak: 0  },
  { id: 6, name: "Aaliyah Grant",  facility: "#1055", pas: 83, prevPas: 81, violations: 4,  topIssue: "Sanitizer concentration", streak: 8  },
];

function pasColor(v)    { return v >= 85 ? PALETTE.green : v >= 70 ? PALETTE.amber : PALETTE.red; }
function pasBg(v)       { return v >= 85 ? PALETTE.greenSoft : v >= 70 ? PALETTE.amberSoft : PALETTE.redSoft; }
function pasBorder(v)   { return v >= 85 ? "rgba(0,200,122,0.28)" : v >= 70 ? "rgba(232,152,10,0.28)" : "rgba(232,50,72,0.28)"; }
function streakColor(d) { return d >= 14 ? PALETTE.green : d >= 5 ? PALETTE.amber : PALETTE.red; }

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GmPasBreakdown() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("pas_desc");

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

  const sorted = [...MOCK_PAS_MANAGERS].sort((a, b) => {
    if (sort === "pas_asc")    return a.pas - b.pas;
    if (sort === "name_asc")   return a.name.localeCompare(b.name);
    if (sort === "violations") return b.violations - a.violations;
    return b.pas - a.pas;
  });

  const avg       = Math.round(MOCK_PAS_MANAGERS.reduce((s, m) => s + m.pas, 0) / MOCK_PAS_MANAGERS.length);
  const atTarget  = MOCK_PAS_MANAGERS.filter((m) => m.pas >= 85).length;
  const needsAttn = MOCK_PAS_MANAGERS.filter((m) => m.pas < 70).length;
  const totalViol = MOCK_PAS_MANAGERS.reduce((s, m) => s + m.violations, 0);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: PALETTE.textSoft, fontSize: "11px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.20s ease both; }
        .bar-fill { transition: width 0.65s cubic-bezier(0.16,1,0.3,1); }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:#03070f; }
        ::-webkit-scrollbar-thumb { background:#162840; border-radius:3px; }
        .sort-btn:hover { color:#ccd9ea !important; border-color:#1d3a55 !important; }
        .back-btn:hover { color:#ccd9ea !important; border-color:#1d3a55 !important; }
      `}} />

      {/* ── HEADER ── */}
      <header style={styles.topNav}>
        <div>
          <div style={styles.topNavTitle}>
            <span style={styles.topNavTitleAccent}>PAS%</span>
            {" "}— Manager Breakdown
          </div>
          <div style={styles.topNavSub}>Policy Adherence Score · All managers · Mock data</div>
        </div>
        <button className="back-btn" style={styles.backBtn} onClick={() => router.back()}>
          ← Back
        </button>
      </header>

      <main style={styles.main}>

        {/* ── SUMMARY ROW ── */}
        <div style={styles.summaryRow} className="fade-up">
          <div style={styles.summaryCard}>
            <div style={styles.summaryValue}>{avg}<span style={styles.summaryUnit}>%</span></div>
            <div style={styles.summaryLabel}>Area Average</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: `2px solid ${PALETTE.green}` }}>
            <div style={{ ...styles.summaryValue, color: PALETTE.green }}>{atTarget}</div>
            <div style={styles.summaryLabel}>At Target ≥ 85%</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: `2px solid ${PALETTE.red}` }}>
            <div style={{ ...styles.summaryValue, color: PALETTE.red }}>{needsAttn}</div>
            <div style={styles.summaryLabel}>Needs Attention &lt; 70%</div>
          </div>
          <div style={{ ...styles.summaryCard, borderTop: `2px solid ${PALETTE.amber}` }}>
            <div style={{ ...styles.summaryValue, color: PALETTE.amber }}>{totalViol}</div>
            <div style={styles.summaryLabel}>Total Violations</div>
          </div>
        </div>

        {/* ── MANAGER CARDS ── */}
        <div style={styles.panelCard} className="fade-up">
          <div style={styles.sectionTopRow}>
            <div style={styles.sectionHeading}>Manager Breakdown</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={styles.sortLabel}>SORT</span>
              {[
                { value: "pas_desc",   label: "PAS% ↓"    },
                { value: "pas_asc",    label: "PAS% ↑"    },
                { value: "violations", label: "Violations" },
                { value: "name_asc",   label: "A→Z"        },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className="sort-btn"
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
              const color  = pasColor(mgr.pas);
              const bg     = pasBg(mgr.pas);
              const border = pasBorder(mgr.pas);
              const delta  = mgr.pas - mgr.prevPas;
              const sColor = streakColor(mgr.streak);

              return (
                <div key={mgr.id} style={styles.mgrCard} className="fade-up">
                  {/* Top row */}
                  <div style={styles.mgrTop}>
                    <div>
                      <div style={styles.mgrName}>{mgr.name}</div>
                      <div style={styles.mgrMeta}>Manager · Facility {mgr.facility}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 700, padding: "3px 8px",
                        borderRadius: "2px", letterSpacing: "0.06em",
                        color:      delta >= 0 ? PALETTE.green : PALETTE.red,
                        background: delta >= 0 ? PALETTE.greenSoft : PALETTE.redSoft,
                        border:     `1px solid ${delta >= 0 ? "rgba(0,200,122,0.28)" : "rgba(232,50,72,0.28)"}`,
                      }}>
                        {delta >= 0 ? "+" : ""}{delta}% vs prior
                      </span>
                      <span style={{
                        fontSize: "26px", fontWeight: 700, fontFamily: MONO,
                        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
                        color, background: bg,
                        border: `1px solid ${border}`,
                        borderRadius: "3px", padding: "5px 14px",
                      }}>
                        {mgr.pas}%
                      </span>
                    </div>
                  </div>

                  {/* PAS bar */}
                  <div style={styles.barTrack}>
                    <div
                      className="bar-fill"
                      style={{ ...styles.barFill, width: `${Math.min(mgr.pas, 100)}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
                    />
                    <div style={{ ...styles.barTarget, left: "85%" }} />
                  </div>
                  <div style={styles.barLabels}>
                    <span>0%</span>
                    <span style={{ ...styles.barLabelTarget, left: "85%" }}>85% target</span>
                    <span>100%</span>
                  </div>

                  {/* Stats row */}
                  <div style={styles.statsRow}>
                    <div style={styles.statChip}>
                      <span style={styles.statChipLabel}>Violations</span>
                      <span style={{
                        ...styles.statChipValue,
                        fontFamily: MONO,
                        color: mgr.violations === 0 ? PALETTE.green : mgr.violations > 8 ? PALETTE.red : PALETTE.amber,
                      }}>
                        {mgr.violations}
                      </span>
                    </div>
                    <div style={styles.statChip}>
                      <span style={styles.statChipLabel}>Streak</span>
                      <span style={{ ...styles.statChipValue, fontFamily: MONO, color: sColor }}>
                        {mgr.streak}d
                      </span>
                    </div>
                    <div style={{ ...styles.statChip, flex: 2 }}>
                      <span style={styles.statChipLabel}>Top Issue</span>
                      <span style={{ ...styles.statChipValue, color: PALETTE.textSoft, fontWeight: 600, fontSize: "13px", fontFamily: "inherit" }}>
                        {mgr.topIssue}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.mockNotice}>
          ⚡ Mock data — replace <code>MOCK_PAS_MANAGERS</code> in <code>pages/gm-pas-breakdown.jsx</code> with a real Supabase query.
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
    fontFamily: SANS,
    padding: "0",
    boxSizing: "border-box",
  },
  topNav: {
    background: PALETTE.panel,
    borderBottom: `1px solid ${PALETTE.border}`,
    padding: "14px 20px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "16px", flexWrap: "wrap",
    position: "sticky", top: 0, zIndex: 100,
  },
  topNavTitle: { fontSize: "16px", fontWeight: 700, color: PALETTE.text, letterSpacing: "-0.01em" },
  topNavTitleAccent: { color: PALETTE.blue, fontFamily: MONO },
  topNavSub:   { fontSize: "11px", color: PALETTE.textSoft, marginTop: "3px", letterSpacing: "0.04em", textTransform: "uppercase" },
  backBtn: {
    border: `1px solid ${PALETTE.border}`, background: "transparent",
    color: PALETTE.textSoft, borderRadius: "3px", padding: "7px 13px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  main: { maxWidth: "1420px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px", padding: "20px 16px", boxSizing: "border-box" },
  summaryRow: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" },
  summaryCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderTop: `2px solid ${PALETTE.blue}`,
    borderRadius: "4px", padding: "18px 20px",
  },
  summaryValue: { fontSize: "36px", fontWeight: 700, color: PALETTE.text, fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: MONO, letterSpacing: "-0.02em" },
  summaryUnit:  { fontSize: "20px", fontWeight: 600, color: PALETTE.textSoft },
  summaryLabel: { fontSize: "10px", color: PALETTE.textSoft, marginTop: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em" },
  panelCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "4px", padding: "20px 22px",
  },
  sectionTopRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "12px", flexWrap: "wrap", marginBottom: "16px",
  },
  sectionHeading: { fontSize: "11px", fontWeight: 800, color: PALETTE.text, textTransform: "uppercase", letterSpacing: "0.10em" },
  sortLabel: { fontSize: "10px", color: PALETTE.textMuted, fontWeight: 700, letterSpacing: "0.10em" },
  sortBtn: {
    border: `1px solid ${PALETTE.border}`, background: "transparent",
    color: PALETTE.textSoft, borderRadius: "3px", padding: "5px 10px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em",
  },
  sortBtnActive: {
    background: PALETTE.blueSoft, color: PALETTE.blue,
    border: `1px solid rgba(26,128,255,0.35)`,
  },
  cardList: { display: "flex", flexDirection: "column", gap: "10px" },
  mgrCard: {
    background: PALETTE.panelAlt,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "4px", padding: "16px 18px",
  },
  mgrTop: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: "16px", marginBottom: "14px", flexWrap: "wrap",
  },
  mgrName: { fontSize: "14px", fontWeight: 700, color: PALETTE.text, marginBottom: "3px" },
  mgrMeta: { fontSize: "11px", color: PALETTE.textSoft, letterSpacing: "0.02em" },
  barTrack: {
    position: "relative", background: PALETTE.panelAlt,
    height: "3px", overflow: "visible", marginBottom: "4px",
  },
  barFill: { height: "100%" },
  barTarget: {
    position: "absolute", top: "-5px", bottom: "-5px",
    width: "1px", background: "rgba(255,255,255,0.25)",
  },
  barLabels: {
    position: "relative", display: "flex", justifyContent: "space-between",
    fontSize: "10px", color: PALETTE.textMuted, marginBottom: "12px",
    fontFamily: MONO, letterSpacing: "0.03em",
  },
  barLabelTarget: {
    position: "absolute", transform: "translateX(-50%)",
    color: PALETTE.textMuted, fontSize: "10px",
  },
  statsRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  statChip: {
    display: "flex", flexDirection: "column", gap: "4px",
    background: "transparent", border: `1px solid ${PALETTE.border}`,
    borderRadius: "3px", padding: "8px 12px", flex: 1, minWidth: "80px",
  },
  statChipLabel: { fontSize: "10px", fontWeight: 700, color: PALETTE.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" },
  statChipValue: { fontSize: "15px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  mockNotice: {
    fontSize: "11px", color: PALETTE.textMuted, textAlign: "center",
    padding: "12px", borderRadius: "3px",
    background: "transparent", border: `1px solid ${PALETTE.border}`,
    letterSpacing: "0.02em",
  },
};
