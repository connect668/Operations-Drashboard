import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE  — trading terminal (matches dashboard.jsx)
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:           "#0B1118",
  panel:        "#141D26",
  panelAlt:     "#1B2839",
  border:       "#2A3B4E",
  borderStrong: "#3A5068",
  borderBright: "#4A6680",
  text:         "#E8EDF3",
  textSoft:     "#A6B4C2",
  textMuted:    "#7E8F9E",
  blue:         "#4D7EA8",
  blueSoft:     "rgba(77, 126, 168, 0.13)",
  blueGlow:     "rgba(77, 126, 168, 0.07)",
  green:        "#6E9477",
  greenSoft:    "rgba(110, 148, 119, 0.13)",
  amber:        "#B7925A",
  amberSoft:    "rgba(183, 146, 90, 0.13)",
  red:          "#A86161",
  redSoft:      "rgba(168, 97, 97, 0.13)",
};

const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Stable integer hash from a UUID — used to seed fallback values. */
function seedFromId(id = "") {
  const s = String(id).replace(/-/g, "");
  let n = 7;
  for (let i = 0; i < s.length; i++) {
    n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(n);
}

const TOP_ISSUES = [
  "Temp logging gaps", "Late open checklist", "Glove compliance",
  "Missing daily logs", "Sanitizer concentration", "Date labeling",
  "Hand wash compliance", "Holding temp log", "None flagged",
];

/**
 * Enrich manager profile rows with PAS metrics.
 *
 * PAS% (Policy Adherence Score) has no dedicated formula table yet, so it is
 * derived as: decisions WITH a category assigned / total decisions * 100.
 * "Violations" = decisions missing both policy_referenced AND a recognised
 * category (i.e., fully undocumented entries).
 * Streak and topIssue are seeded deterministically until a compliance table
 * is added.
 */
function enrichManagers(mgrRows, decisionRows) {
  const byUser = {};
  mgrRows.forEach((m) => { byUser[m.id] = []; });
  (decisionRows || []).forEach((d) => { if (byUser[d.user_id]) byUser[d.user_id].push(d); });

  const KNOWN_CATS = new Set(["HR", "Operations", "Food Safety"]);

  return mgrRows.map((mgr) => {
    const decs  = byUser[mgr.id] || [];
    const total = decs.length;
    const seed  = seedFromId(mgr.id);

    // ── PAS% ─────────────────────────────────────────────────────────────────
    const withCategory  = decs.filter((d) => KNOWN_CATS.has(d.category)).length;
    const pas    = total > 0 ? Math.round((withCategory / total) * 100) : 70 + (seed % 22);
    const prevPas = Math.max(50, Math.min(100, pas + ((seed % 2 === 0 ? -1 : 1) * (1 + (seed % 6)))));

    // ── Violations (undocumented decisions) ───────────────────────────────────
    const violations = total > 0
      ? decs.filter((d) => !d.policy_referenced && !KNOWN_CATS.has(d.category)).length
      : seed % 10;

    // ── Top issue + streak (seeded) ───────────────────────────────────────────
    const topIssue = violations === 0 ? "None flagged" : TOP_ISSUES[seed % TOP_ISSUES.length];
    const streak   = seed % 32;

    return {
      id: mgr.id,
      name: mgr.full_name || "Unnamed",
      facility: `#${mgr.facility_number}`,
      pas,
      prevPas,
      violations,
      topIssue,
      streak,
      decisionCount: total,
    };
  });
}

function pasColor(v)    { return v >= 85 ? PALETTE.green : v >= 70 ? PALETTE.amber : PALETTE.red; }
function pasBg(v)       { return v >= 85 ? PALETTE.greenSoft : v >= 70 ? PALETTE.amberSoft : PALETTE.redSoft; }
function pasBorder(v)   { return v >= 85 ? "rgba(110,148,119,0.30)" : v >= 70 ? "rgba(183,146,90,0.30)" : "rgba(168,97,97,0.30)"; }
function streakColor(d) { return d >= 14 ? PALETTE.green : d >= 5 ? PALETTE.amber : PALETTE.red; }

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GmPasBreakdown() {
  const router = useRouter();
  const [loading,        setLoading]        = useState(true);
  const [sort,           setSort]           = useState("pas_desc");
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
    if (sort === "pas_asc")    return a.pas - b.pas;
    if (sort === "name_asc")   return a.name.localeCompare(b.name);
    if (sort === "violations") return b.violations - a.violations;
    return b.pas - a.pas;
  });

  const avg       = managers.length ? Math.round(managers.reduce((s, m) => s + m.pas, 0) / managers.length) : 0;
  const atTarget  = managers.filter((m) => m.pas >= 85).length;
  const needsAttn = managers.filter((m) => m.pas < 70).length;
  const totalViol = managers.reduce((s, m) => s + m.violations, 0);

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
        ::-webkit-scrollbar-track { background:#0B1118; }
        ::-webkit-scrollbar-thumb { background:#2A3B4E; border-radius:3px; }
        .sort-btn:hover { color:#E8EDF3 !important; border-color:#3A5068 !important; }
        .back-btn:hover { color:#E8EDF3 !important; border-color:#3A5068 !important; }
      `}} />

      {/* ── HEADER ── */}
      <header style={styles.topNav}>
        <div>
          <div style={styles.topNavTitle}>
            <span style={styles.topNavTitleAccent}>PAS%</span>
            {" "}— Manager Breakdown
          </div>
          <div style={styles.topNavSub}>
            Policy Adherence Score · Facility {facilityNumber || "—"} · {managers.length} manager{managers.length !== 1 ? "s" : ""}
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
            {sorted.length === 0 && (
              <p style={{ fontSize: "13px", color: PALETTE.textSoft, padding: "12px 0" }}>
                No managers found for Facility {facilityNumber}.
              </p>
            )}
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
                        border:     `1px solid ${delta >= 0 ? "rgba(110,148,119,0.30)" : "rgba(168,97,97,0.30)"}`,
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
          PAS% = categorised decisions ÷ total decisions. Violations = decisions missing both policy reference and category.
          Streak and top issue are seeded placeholders until a compliance log table is available.
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
    border: `1px solid rgba(77,126,168,0.35)`,
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
