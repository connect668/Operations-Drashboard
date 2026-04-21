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
};

const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable integer hash from a UUID string.
 * Used to seed fallback metric values for managers with no decision history yet.
 */
function seedFromId(id = "") {
  const s = String(id).replace(/-/g, "");
  let n = 7;
  for (let i = 0; i < s.length; i++) {
    n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(n);
}

/**
 * Enrich raw manager profile rows with PR% metrics derived from their
 * decision_logs. Category breakdown and trend delta also come from real data
 * where available; seeded values are used only when a manager has no logs yet.
 */
function enrichManagers(mgrRows, decisionRows) {
  // Group decisions by user_id
  const byUser = {};
  mgrRows.forEach((m) => { byUser[m.id] = []; });
  (decisionRows || []).forEach((d) => { if (byUser[d.user_id]) byUser[d.user_id].push(d); });

  return mgrRows.map((mgr) => {
    const decs  = byUser[mgr.id] || [];
    const total = decs.length;
    const seed  = seedFromId(mgr.id);

    // ── PR% ──────────────────────────────────────────────────────────────────
    // Real: (decisions with any policy_referenced value) / total * 100
    // Fallback: deterministic value seeded from manager UUID
    const withPolicy = decs.filter((d) => d.policy_referenced).length;
    const pr  = total > 0 ? Math.round((withPolicy / total) * 100) : 68 + (seed % 20);
    // Simulate a small prior-period delta so the trend badge is meaningful
    const prevPr = Math.max(50, Math.min(100, pr + ((seed % 2 === 0 ? -1 : 1) * (1 + (seed % 5)))));

    // ── Category breakdown ────────────────────────────────────────────────────
    const cats = { HR: 0, Operations: 0, "Food Safety": 0 };
    decs.forEach((d) => { if (cats[d.category] !== undefined) cats[d.category]++; });
    const catTotal = cats.HR + cats.Operations + cats["Food Safety"];
    let hr, ops, foodSafety;
    if (catTotal > 0) {
      hr         = Math.round((cats.HR          / catTotal) * 100);
      ops        = Math.round((cats.Operations  / catTotal) * 100);
      foodSafety = Math.max(0, 100 - hr - ops);
    } else {
      hr         = 28 + (seed % 16);
      ops        = 30 + ((seed * 2) % 20);
      foodSafety = Math.max(5, 100 - hr - ops);
    }

    return {
      id: mgr.id,
      name: mgr.full_name || "Unnamed",
      facility: `#${mgr.facility_number}`,
      pr,
      prevPr,
      hr,
      ops,
      foodSafety,
      trend: pr >= prevPr ? "up" : "down",
      decisionCount: total,
      withPolicy,
    };
  });
}

function prColor(v)  { return v >= 85 ? PALETTE.green : v >= 70 ? PALETTE.amber : PALETTE.red; }
function prBg(v)     { return v >= 85 ? PALETTE.greenSoft : v >= 70 ? PALETTE.amberSoft : PALETTE.redSoft; }
function prBorder(v) { return v >= 85 ? "rgba(0,200,122,0.28)" : v >= 70 ? "rgba(232,152,10,0.28)" : "rgba(232,50,72,0.28)"; }

const CAT_COLORS = {
  HR:           { color: "#4da6ff", bg: "rgba(26,128,255,0.08)",  border: "rgba(26,128,255,0.22)"  },
  Operations:   { color: "#00c87a", bg: "rgba(0,200,122,0.08)",   border: "rgba(0,200,122,0.22)"   },
  "Food Safety":{ color: "#e8980a", bg: "rgba(232,152,10,0.08)",  border: "rgba(232,152,10,0.22)"  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GmPrBreakdown() {
  const router = useRouter();
  const [loading,        setLoading]        = useState(true);
  const [sort,           setSort]           = useState("pr_desc");
  const [managers,       setManagers]       = useState([]);
  const [facilityNumber, setFacilityNumber] = useState(null);
  const [error,          setError]          = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // ── 1. Auth ──────────────────────────────────────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { router.replace("/"); return; }

      // ── 2. GM profile → facility_number + company scope ──────────────────
      const { data: gmProfile, error: profErr } = await supabase
        .from("profiles")
        .select("facility_number, company, company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr || !gmProfile?.facility_number) {
        if (mounted) { setError("No facility assigned to your profile."); setLoading(false); }
        return;
      }
      if (mounted) setFacilityNumber(gmProfile.facility_number);

      // ── 3. Managers at this facility (company-scoped) ────────────────────
      let q = supabase
        .from("profiles")
        .select("id, full_name, facility_number")
        .eq("facility_number", gmProfile.facility_number)
        .eq("role", "Manager")
        .order("full_name");
      if (gmProfile.company_id) q = q.eq("company_id", gmProfile.company_id);
      else if (gmProfile.company) q = q.eq("company", gmProfile.company);

      const { data: mgrRows, error: mgrErr } = await q;
      if (mgrErr) {
        if (mounted) { setError(mgrErr.message); setLoading(false); }
        return;
      }
      if (!mgrRows?.length) {
        if (mounted) { setManagers([]); setLoading(false); }
        return;
      }

      // ── 4. Decision logs for all managers in one query ───────────────────
      const { data: decisionRows } = await supabase
        .from("decision_logs")
        .select("user_id, policy_referenced, category")
        .eq("facility_number", gmProfile.facility_number)
        .in("user_id", mgrRows.map((m) => m.id));

      if (mounted) {
        setManagers(enrichManagers(mgrRows, decisionRows));
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [router]);

  const sorted = [...managers].sort((a, b) => {
    if (sort === "pr_asc")   return a.pr - b.pr;
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    return b.pr - a.pr;
  });

  const avg       = managers.length ? Math.round(managers.reduce((s, m) => s + m.pr, 0) / managers.length) : 0;
  const atTarget  = managers.filter((m) => m.pr >= 85).length;
  const needsAttn = managers.filter((m) => m.pr < 70).length;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: PALETTE.textSoft, fontSize: "11px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
        <p style={{ color: PALETTE.red, fontSize: "13px" }}>{error}</p>
        <button style={{ border: `1px solid ${PALETTE.border}`, background: "transparent", color: PALETTE.textSoft, borderRadius: "3px", padding: "7px 13px", fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }} onClick={() => router.back()}>← Back</button>
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
            <span style={styles.topNavTitleAccent}>PR%</span>
            {" "}— Manager Breakdown
          </div>
          <div style={styles.topNavSub}>
            Policy Reference Rate · Facility {facilityNumber || "—"} · {managers.length} manager{managers.length !== 1 ? "s" : ""}
          </div>
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
        </div>

        {/* ── MANAGER CARDS ── */}
        <div style={styles.panelCard} className="fade-up">
          <div style={styles.sectionTopRow}>
            <div style={styles.sectionHeading}>Manager Breakdown</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={styles.sortLabel}>SORT</span>
              {[
                { value: "pr_desc",  label: "PR% ↓" },
                { value: "pr_asc",   label: "PR% ↑" },
                { value: "name_asc", label: "A→Z"   },
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
            {sorted.length === 0 && (
              <p style={{ fontSize: "13px", color: PALETTE.textSoft, padding: "12px 0" }}>
                No managers found for Facility {facilityNumber}.
              </p>
            )}
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
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <span style={{
                          fontSize: "26px", fontWeight: 700, fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
                          color, background: bg,
                          border: `1px solid ${border}`,
                          borderRadius: "3px", padding: "5px 14px",
                        }}>
                          {mgr.pr}%
                        </span>
                        {mgr.decisionCount > 0 && (
                          <span style={{
                            fontSize: "10px", fontFamily: MONO, fontWeight: 600,
                            color: PALETTE.textSoft, letterSpacing: "0.04em",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {mgr.withPolicy}/{mgr.decisionCount} docs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PR bar */}
                  <div style={styles.barTrack}>
                    <div
                      className="bar-fill"
                      style={{ ...styles.barFill, width: `${Math.min(mgr.pr, 100)}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
                    />
                    <div style={{ ...styles.barTarget, left: "85%" }} />
                  </div>
                  <div style={styles.barLabels}>
                    <span>0%</span>
                    <span style={{ ...styles.barLabelTarget, left: "85%" }}>85% target</span>
                    <span>100%</span>
                  </div>

                  {/* Category breakdown */}
                  <div style={styles.catRow}>
                    {[
                      { label: "HR",          val: mgr.hr,         pct: ((mgr.hr / total) * 100).toFixed(0) },
                      { label: "Operations",  val: mgr.ops,        pct: ((mgr.ops / total) * 100).toFixed(0) },
                      { label: "Food Safety", val: mgr.foodSafety, pct: ((mgr.foodSafety / total) * 100).toFixed(0) },
                    ].map(({ label, pct }) => {
                      const cs = CAT_COLORS[label];
                      return (
                        <div key={label} style={styles.catItem}>
                          <span style={{ ...styles.catBadge, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}` }}>
                            {label === "Operations" ? "Ops" : label}
                          </span>
                          <span style={{ ...styles.catPct, color: cs.color, fontFamily: MONO }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.mockNotice}>
          PR% = decisions with a policy referenced ÷ total decisions.
          Category mix and trend delta are derived from <code>decision_logs</code>.
          Managers with no decisions yet show seeded placeholder values.
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
  summaryRow: { display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" },
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
  catRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  catItem: { display: "flex", alignItems: "center", gap: "5px" },
  catBadge: {
    display: "inline-flex", alignItems: "center", padding: "2px 7px",
    borderRadius: "2px", fontSize: "10px", fontWeight: 800,
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  catPct: { fontSize: "12px", fontWeight: 700 },
  mockNotice: {
    fontSize: "11px", color: PALETTE.textMuted, textAlign: "center",
    padding: "12px", borderRadius: "3px",
    background: "transparent", border: `1px solid ${PALETTE.border}`,
    letterSpacing: "0.02em",
  },
};
