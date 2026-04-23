import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:           "#0B1118",
  panel:        "#141D26",
  panelAlt:     "#1B2839",
  panelDeep:    "#0C1219",
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

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = { home: "home", notes: "notes", analytics: "analytics" };

// ─── FEEDBACK FLAGS ───────────────────────────────────────────────────────────
const FEEDBACK_FLAGS = [
  "Hard to understand",
  "Not specific enough",
  "Did not match situation",
  "Missing escalation guidance",
  "Could not find answer fast enough",
];

// ─── FACILITY NOTES ───────────────────────────────────────────────────────────
const NOTE_TYPES      = ["Equipment / Repair","Safety Concern","Maintenance","Operational Issue","Staffing Issue","Other"];
const NOTE_TYPE_DB    = { "Equipment / Repair":"equipment_repair","Safety Concern":"safety_concern","Maintenance":"maintenance","Operational Issue":"operational_issue","Staffing Issue":"staffing_issue","Other":"other" };
const NOTE_TYPE_LABEL = Object.fromEntries(Object.entries(NOTE_TYPE_DB).map(([l,v])=>[v,l]));
const NOTE_PRIORITIES = ["low","normal","high","urgent"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function applyCompanyScope(query, scope) {
  const cid = scope?.company_id;
  if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid))
    return query.eq("company_id", cid);
  if (scope?.company) return query.eq("company", scope.company);
  return query;
}

function timeAgo(d) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000), hrs = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(v) { return UUID_RE.test(v) ? v : null; }

function priorityStyle(p) {
  if (p === "urgent") return { color: PALETTE.red,      background: PALETTE.redSoft,   border: "1px solid rgba(168,97,97,0.32)"  };
  if (p === "high")   return { color: PALETTE.amber,    background: PALETTE.amberSoft, border: "1px solid rgba(183,146,90,0.32)" };
  return                     { color: PALETTE.textSoft, background: "transparent",     border: `1px solid ${PALETTE.border}`     };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PlaybookDashboard() {
  const router = useRouter();

  // Auth
  const [profile,     setProfile]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile,    setIsMobile]    = useState(false);
  const [activeTab,   setActiveTab]   = useState(TABS.home);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  // Search
  const [situation,  setSituation]  = useState("");
  const [searching,  setSearching]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [altResults, setAltResults] = useState([]);
  const [noResult,   setNoResult]   = useState(false);

  // Recent / Saved plays
  const [recents,    setRecents]    = useState([]);
  const [savedPlays, setSavedPlays] = useState([]);
  const [searchId,   setSearchId]   = useState(null);
  const [isSaved,    setIsSaved]    = useState(false);

  // Feedback modal
  const [showFeedback,       setShowFeedback]       = useState(false);
  const [feedbackFlags,      setFeedbackFlags]      = useState([]);
  const [feedbackNote,       setFeedbackNote]       = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone,       setFeedbackDone]       = useState(false);

  // Facility notes (user only)
  const [notes,           setNotes]           = useState([]);
  const [notesLoading,    setNotesLoading]    = useState(false);
  const [notesFetched,    setNotesFetched]    = useState(false);
  const [newNoteType,     setNewNoteType]     = useState(NOTE_TYPES[0]);
  const [newNotePriority, setNewNotePriority] = useState("normal");
  const [newNoteText,     setNewNoteText]     = useState("");
  const [noteSubmitting,  setNoteSubmitting]  = useState(false);
  const [noteMsg,         setNoteMsg]         = useState("");

  // Admin analytics
  const [adminLoading,       setAdminLoading]       = useState(false);
  const [adminFetched,       setAdminFetched]        = useState(false);
  const [totalSearchCount,   setTotalSearchCount]   = useState(0);
  const [categoryBreakdown,  setCategoryBreakdown]  = useState([]);
  const [recentSearchList,   setRecentSearchList]   = useState([]);
  const [adminFeedbackList,  setAdminFeedbackList]  = useState([]);

  const inputRef = useRef(null);

  // ── Auth init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, facility_number, company, company_id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof) { router.replace("/"); return; }
      if (mounted) { setProfile(prof); setAuthLoading(false); }
    };
    init();
    return () => { mounted = false; };
  }, [router]);

  // ── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Load recents when profile ready ───────────────────────────────────────
  useEffect(() => { if (profile) loadRecents(); }, [profile]);

  const isAdmin = profile?.role === "admin";

  const loadRecents = async () => {
    try {
      const { data } = await supabase
        .from("playbook_searches")
        .select("id, situation_text, policy_id, saved, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const all = data || [];
      setRecents(all.filter(r => !r.saved).slice(0, 8));
      setSavedPlays(all.filter(r => r.saved));
    } catch { /* graceful */ }
  };

  // ── Admin analytics loader ─────────────────────────────────────────────────
  const loadAdminData = async () => {
    setAdminLoading(true);
    try {
      // All searches with joined policy category
      let sq = supabase
        .from("playbook_searches")
        .select("id, situation_text, created_at, policy_id, company_policies(title, category)")
        .order("created_at", { ascending: false })
        .limit(500);
      sq = applyCompanyScope(sq, profile);
      const { data: searches } = await sq;
      const allSearches = searches || [];

      setTotalSearchCount(allSearches.length);
      setRecentSearchList(allSearches.slice(0, 30));

      // Category breakdown
      const catMap = {};
      allSearches.forEach(s => {
        const cat = s.company_policies?.category || "Uncategorized";
        catMap[cat] = (catMap[cat] || 0) + 1;
      });
      setCategoryBreakdown(Object.entries(catMap).sort((a, b) => b[1] - a[1]));

      // Feedback list with policy title
      let fq = supabase
        .from("policy_feedback")
        .select("id, flags, note, created_at, facility_number, policy_id, company_policies(title)")
        .order("created_at", { ascending: false })
        .limit(100);
      fq = applyCompanyScope(fq, profile);
      const { data: feedback } = await fq;
      setAdminFeedbackList(feedback || []);

    } catch (err) {
      console.warn("Admin analytics load error:", err.message);
    }
    setAdminLoading(false);
    setAdminFetched(true);
  };

  useEffect(() => {
    if (activeTab === TABS.analytics && isAdmin && !adminFetched) {
      loadAdminData();
    }
  }, [activeTab, isAdmin]);

  // ── Core search logic ──────────────────────────────────────────────────────
  const doSearch = async (term) => {
    if (!term) return;
    setSearching(true);
    setNoResult(false);
    setResult(null);
    setAltResults([]);
    setSearchId(null);
    setIsSaved(false);

    try {
      let q = supabase
        .from("company_policies")
        .select("id, title, policy_code, category, severity, summary, policy_text, action_steps, escalation_guidance, incorrect_examples, correct_examples, role_guidance, keywords")
        .eq("is_active", true);
      q = applyCompanyScope(q, profile);
      q = q.or(`title.ilike.%${term}%,policy_text.ilike.%${term}%,keywords.ilike.%${term}%,summary.ilike.%${term}%`);
      const { data: primary } = await q.limit(5);
      let hits = primary || [];

      if (!hits.length) {
        const words = term.split(/\s+/).filter(w => w.length > 3);
        for (const word of words.slice(0, 4)) {
          let wq = supabase
            .from("company_policies")
            .select("id, title, policy_code, category, severity, summary, policy_text, action_steps, escalation_guidance, incorrect_examples, correct_examples, role_guidance, keywords")
            .eq("is_active", true);
          wq = applyCompanyScope(wq, profile);
          wq = wq.or(`title.ilike.%${word}%,keywords.ilike.%${word}%,summary.ilike.%${word}%`);
          const { data: wr } = await wq.limit(3);
          if (wr?.length) { hits = wr; break; }
        }
      }

      if (!hits.length) {
        setNoResult(true);
      } else {
        setResult(hits[0]);
        setAltResults(hits.slice(1));
        try {
          const { data: logged } = await supabase
            .from("playbook_searches")
            .insert({ user_id: profile.id, facility_number: profile.facility_number || null, company_id: safeUuid(profile.company_id), situation_text: term, policy_id: hits[0].id, saved: false })
            .select("id").single();
          if (logged?.id) { setSearchId(logged.id); loadRecents(); }
        } catch { /* graceful */ }
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e) => { if (e) e.preventDefault(); await doSearch(situation.trim()); };

  const reopenRecent = async (recent) => {
    setSituation(recent.situation_text);
    if (recent.policy_id) {
      setSearching(true); setNoResult(false); setResult(null); setAltResults([]);
      try {
        const { data } = await supabase
          .from("company_policies")
          .select("id, title, policy_code, category, severity, summary, policy_text, action_steps, escalation_guidance, incorrect_examples, correct_examples, role_guidance, keywords")
          .eq("id", recent.policy_id).maybeSingle();
        if (data) { setResult(data); setSearchId(recent.id); setIsSaved(recent.saved || false); }
        else { await doSearch(recent.situation_text); }
      } finally { setSearching(false); }
    } else {
      await doSearch(recent.situation_text);
    }
  };

  const clearSearch = () => {
    setResult(null); setNoResult(false); setSituation(""); setSearchId(null); setIsSaved(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Save / unsave play ─────────────────────────────────────────────────────
  const handleSavePlay = async () => {
    if (!searchId) return;
    try {
      await supabase.from("playbook_searches").update({ saved: !isSaved }).eq("id", searchId);
      setIsSaved(!isSaved); loadRecents();
    } catch {}
  };

  // ── Feedback ───────────────────────────────────────────────────────────────
  const toggleFlag = (flag) => setFeedbackFlags(prev =>
    prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
  );

  const submitFeedback = async () => {
    if (!feedbackFlags.length) return;
    setFeedbackSubmitting(true);
    try {
      await supabase.from("policy_feedback").insert({
        user_id: profile.id,
        policy_id: result?.id || null,
        facility_number: profile.facility_number || null,
        company_id: safeUuid(profile.company_id),
        flags: feedbackFlags,
        note: feedbackNote.trim() || null,
      });
    } catch { /* graceful */ }
    setFeedbackDone(true);
    setFeedbackSubmitting(false);
  };

  const closeFeedback = () => {
    setShowFeedback(false); setFeedbackFlags([]); setFeedbackNote(""); setFeedbackDone(false);
  };

  // ── Facility notes (user only) ─────────────────────────────────────────────
  const loadNotes = async () => {
    if (!profile?.facility_number) return;
    setNotesLoading(true);
    try {
      const { data } = await supabase
        .from("facility_notes")
        .select("id, note_type, note_text, priority, created_by_name, created_by_role, created_at, status")
        .eq("facility_number", profile.facility_number)
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      setNotes(data || []);
    } catch {}
    setNotesLoading(false);
    setNotesFetched(true);
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setNoteSubmitting(true); setNoteMsg("");
    try {
      await supabase.from("facility_notes").insert({
        facility_number: profile.facility_number,
        company_id: safeUuid(profile.company_id),
        note_type: NOTE_TYPE_DB[newNoteType] || "other",
        priority: newNotePriority,
        note_text: newNoteText.trim(),
        status: "open",
        created_by_name: profile.full_name || "",
        created_by_role: profile.role || "",
      });
      setNewNoteText(""); setNoteMsg("Note added."); loadNotes();
    } catch (err) { setNoteMsg(err.message || "Failed to add note."); }
    setNoteSubmitting(false);
  };

  useEffect(() => { if (activeTab === TABS.notes && !notesFetched) loadNotes(); }, [activeTab]);

  // ── Loading gate ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh", background:PALETTE.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:PALETTE.textMuted, fontSize:"11px", letterSpacing:"0.10em", textTransform:"uppercase", fontFamily:SANS }}>Loading…</p>
      </div>
    );
  }

  const hasFacility = !!profile?.facility_number;

  // Build nav items based on role
  const navItems = isAdmin
    ? [
        { id: TABS.home,      label: "Playbook"  },
        { id: TABS.analytics, label: "Analytics" },
      ]
    : [
        { id: TABS.home,  label: "Playbook" },
        ...(hasFacility ? [{ id: TABS.notes, label: "Facility Notes" }] : []),
      ];

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <Head><title>Playbook</title></Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── TOP NAV ── */}
      <header style={s.topNav}>
        <div style={s.topNavBrand}>
          <div style={s.topNavProduct}>Playbook</div>
          <div style={s.topNavMeta}>
            {profile?.full_name}
            {profile?.role ? ` · ${profile.role}` : ""}
          </div>
        </div>

        {!isMobile && (
          <nav style={s.topNavItems}>
            {navItems.map(item => (
              <button key={item.id} className="nav-tab"
                style={{ ...s.topNavBtn, ...(activeTab === item.id ? s.topNavBtnActive : {}) }}
                onClick={() => setActiveTab(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div style={s.topNavRight}>
          {isMobile && (
            <button style={s.mobileMenuBtn} onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? "✕" : "☰"}
            </button>
          )}
          <button style={s.topNavLogout}
            onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}>
            Sign out
          </button>
        </div>
      </header>

      {isMobile && mobileOpen && (
        <div style={s.mobileDropdown}>
          {navItems.map(item => (
            <button key={item.id}
              style={{ ...s.navButton, ...(activeTab === item.id ? s.navButtonActive : {}) }}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}>
              {item.label}
            </button>
          ))}
          <div style={s.navDivider} />
          <a href="/support" style={{ ...s.navButton, textDecoration:"none", display:"block" }}>Support</a>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={s.main}>

        {/* ════════════════════ PLAYBOOK TAB ════════════════════ */}
        {activeTab === TABS.home && (
          <>
            {/* Search Home */}
            {!result && !noResult && !searching && (
              <div className="fade-up">
                <div style={s.heroLabel}>What's the situation?</div>
                <form onSubmit={handleSearch} style={s.searchForm}>
                  <textarea
                    ref={inputRef}
                    value={situation}
                    onChange={e => setSituation(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(e); }}}
                    placeholder={"e.g.  customer wants refund but no receipt\n       employee no call no show\n       product shortage during dinner rush"}
                    style={s.searchInput}
                    rows={3}
                    autoFocus
                  />
                  <button type="submit"
                    style={{ ...s.searchBtn, ...(situation.trim() ? {} : { opacity:0.45, cursor:"not-allowed" }) }}
                    disabled={!situation.trim()}>
                    Get the Play →
                  </button>
                </form>

                {savedPlays.length > 0 && (
                  <div style={s.recentSection}>
                    <div style={s.recentLabel}>Saved Plays</div>
                    {savedPlays.map(r => (
                      <button key={r.id} className="recent-chip" style={s.recentChip} onClick={() => reopenRecent(r)}>
                        <span style={s.recentStar}>★</span>{r.situation_text}
                      </button>
                    ))}
                  </div>
                )}

                {recents.length > 0 && (
                  <div style={s.recentSection}>
                    <div style={s.recentLabel}>Recent</div>
                    {recents.map(r => (
                      <button key={r.id} className="recent-chip" style={s.recentChip} onClick={() => reopenRecent(r)}>
                        {r.situation_text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {searching && (
              <div style={s.searchingState} className="fade-up">
                <div style={s.searchingDot} />
                <span style={s.searchingText}>Finding the play…</span>
              </div>
            )}

            {noResult && !searching && (
              <div style={s.noResultWrap} className="fade-up">
                <div style={s.noResultTitle}>No matching policy found</div>
                <p style={s.noResultText}>Try different keywords, or check with your manager if this situation isn't covered yet.</p>
                <button style={s.secondaryBtn} onClick={clearSearch}>← Try again</button>
              </div>
            )}

            {result && !searching && (
              <div className="fade-up">
                <div style={s.resultBar}>
                  <button style={s.backBtn} onClick={clearSearch}>← New Search</button>
                  <div style={s.resultBarActions}>
                    <button style={{ ...s.saveBtn, ...(isSaved ? s.saveBtnActive : {}) }} onClick={handleSavePlay}>
                      {isSaved ? "★ Saved" : "☆ Save Play"}
                    </button>
                    <button style={s.flagBtn} onClick={() => { setShowFeedback(true); setFeedbackDone(false); }}>
                      Flag Policy
                    </button>
                  </div>
                </div>

                <div style={s.situationEcho}>
                  <span style={s.situationEchoLabel}>Situation: </span>{situation}
                </div>

                <div style={s.resultCard}>
                  <div style={s.cardLabel}>The Play</div>
                  <div style={s.actionSteps}>
                    {result.action_steps || result.summary || result.policy_text || "No steps available."}
                  </div>
                </div>

                <div style={s.resultCard}>
                  <div style={s.cardLabel}>Policy Behind It</div>
                  <div style={s.policyTitle}>{result.title}</div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"6px" }}>
                    {result.policy_code && <span style={s.codeBadge}>{result.policy_code}</span>}
                    {result.category    && <span style={s.catBadge}>{result.category}</span>}
                    {result.severity    && <span style={s.sevBadge}>{result.severity}</span>}
                  </div>
                  {result.summary && result.action_steps && (
                    <p style={s.policySummary}>{result.summary}</p>
                  )}
                </div>

                {result.incorrect_examples && (
                  <div style={{ ...s.resultCard, borderLeft:`3px solid ${PALETTE.amber}` }}>
                    <div style={{ ...s.cardLabel, color:PALETTE.amber }}>Avoid This</div>
                    <div style={s.bodyText}>{result.incorrect_examples}</div>
                  </div>
                )}

                {result.escalation_guidance && (
                  <div style={{ ...s.resultCard, borderLeft:`3px solid ${PALETTE.red}` }}>
                    <div style={{ ...s.cardLabel, color:PALETTE.red }}>Escalate If</div>
                    <div style={s.bodyText}>{result.escalation_guidance}</div>
                  </div>
                )}

                {altResults.length > 0 && (
                  <div style={s.altSection}>
                    <div style={s.altLabel}>Other Relevant Policies</div>
                    {altResults.map(alt => (
                      <button key={alt.id} className="alt-btn" style={s.altBtn}
                        onClick={() => { setResult(alt); setAltResults([]); setSearchId(null); setIsSaved(false); }}>
                        <span style={s.altTitle}>{alt.title}</span>
                        {alt.policy_code && <span style={s.altCode}>{alt.policy_code}</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div style={s.searchBarBottom}>
                  <form onSubmit={handleSearch} style={s.searchInlineForm}>
                    <input
                      value={situation}
                      onChange={e => setSituation(e.target.value)}
                      placeholder="Search another situation…"
                      style={s.searchInlineInput}
                    />
                    <button type="submit" style={s.searchInlineBtn} disabled={!situation.trim()}>→</button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════ FACILITY NOTES TAB (user only) ════════════════════ */}
        {activeTab === TABS.notes && !isAdmin && (
          <div className="fade-up">
            {!hasFacility ? (
              <div style={s.panelCard}>
                <p style={{ color:PALETTE.textMuted, fontSize:"13px" }}>No facility assigned to your account.</p>
              </div>
            ) : (
              <>
                <div style={s.panelCard}>
                  <div style={s.sectionTopRow}>
                    <div style={s.sectionHeading}>New Facility Note</div>
                  </div>
                  <form onSubmit={submitNote} style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"12px" }}>
                      <div>
                        <label style={s.label}>Type</label>
                        <select value={newNoteType} onChange={e => setNewNoteType(e.target.value)} style={s.selectInput}>
                          {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Priority</label>
                        <select value={newNotePriority} onChange={e => setNewNotePriority(e.target.value)} style={s.selectInput}>
                          {NOTE_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={s.label}>Note</label>
                      <textarea value={newNoteText} onChange={e => setNewNoteText(e.target.value)}
                        placeholder="Describe the issue…" style={{ ...s.textarea, minHeight:"90px" }} required />
                    </div>
                    {noteMsg && <p style={{ fontSize:"12px", color:PALETTE.textSoft, margin:0 }}>{noteMsg}</p>}
                    <button type="submit" disabled={noteSubmitting || !newNoteText.trim()}
                      style={{ ...s.primaryBtn, alignSelf:"flex-start", ...(noteSubmitting || !newNoteText.trim() ? { opacity:0.45, cursor:"not-allowed" } : {}) }}>
                      {noteSubmitting ? "Saving…" : "Add Note"}
                    </button>
                  </form>
                </div>

                <div style={s.panelCard}>
                  <div style={s.sectionTopRow}>
                    <div style={s.sectionHeading}>Open Notes · Facility {profile?.facility_number}</div>
                    <button style={s.secondaryBtn} onClick={loadNotes}>Refresh</button>
                  </div>
                  {notesLoading && <p style={{ color:PALETTE.textMuted, fontSize:"13px" }}>Loading…</p>}
                  {!notesLoading && notes.length === 0 && (
                    <p style={{ color:PALETTE.textMuted, fontSize:"13px" }}>No open notes.</p>
                  )}
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    {notes.map(n => (
                      <div key={n.id} style={s.noteCard}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px", flexWrap:"wrap", gap:"6px" }}>
                          <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
                            <span style={{ ...s.noteBadge, ...priorityStyle(n.priority) }}>{n.priority}</span>
                            <span style={s.noteType}>{NOTE_TYPE_LABEL[n.note_type] || n.note_type}</span>
                          </div>
                          <span style={s.noteTimestamp}>{timeAgo(n.created_at)}</span>
                        </div>
                        <div style={s.noteText}>{n.note_text}</div>
                        {n.created_by_name && (
                          <div style={s.noteBy}>{n.created_by_name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════ ANALYTICS TAB (admin only) ════════════════════ */}
        {activeTab === TABS.analytics && isAdmin && (
          <div className="fade-up">
            {adminLoading ? (
              <div style={{ padding:"48px 0", display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={s.searchingDot} />
                <span style={{ fontSize:"13px", color:PALETTE.textSoft }}>Loading analytics…</span>
              </div>
            ) : (
              <>
                {/* ── STAT CARDS ── */}
                <div style={s.statsRow}>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{totalSearchCount}</div>
                    <div style={s.statLabel}>Total Plays Pulled</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{categoryBreakdown.length}</div>
                    <div style={s.statLabel}>Categories Used</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{adminFeedbackList.length}</div>
                    <div style={s.statLabel}>Feedback Submitted</div>
                  </div>
                </div>

                {/* ── CATEGORY BREAKDOWN ── */}
                <div style={s.panelCard}>
                  <div style={s.sectionTopRow}>
                    <div style={s.sectionHeading}>Plays by Category</div>
                    <button style={s.secondaryBtn} onClick={() => { setAdminFetched(false); loadAdminData(); }}>Refresh</button>
                  </div>
                  {categoryBreakdown.length === 0 ? (
                    <p style={{ color:PALETTE.textMuted, fontSize:"13px", margin:0 }}>No data yet. Plays pulled will appear here.</p>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                      {categoryBreakdown.map(([cat, count]) => {
                        const pct = Math.round((count / categoryBreakdown[0][1]) * 100);
                        return (
                          <div key={cat}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"5px" }}>
                              <span style={{ fontSize:"13px", fontWeight:600, color:PALETTE.text }}>{cat}</span>
                              <span style={{ fontSize:"12px", color:PALETTE.textMuted, fontFamily:MONO }}>{count} {count === 1 ? "play" : "plays"}</span>
                            </div>
                            <div style={{ height:"6px", background:PALETTE.panelAlt, borderRadius:"3px", overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:PALETTE.blue, borderRadius:"3px", transition:"width 0.3s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── FEEDBACK LIST ── */}
                <div style={s.panelCard}>
                  <div style={s.sectionTopRow}>
                    <div style={s.sectionHeading}>Policy Feedback</div>
                    <span style={s.countPill}>{adminFeedbackList.length}</span>
                  </div>
                  {adminFeedbackList.length === 0 ? (
                    <p style={{ color:PALETTE.textMuted, fontSize:"13px", margin:0 }}>No feedback submitted yet. Users can flag policies from the Playbook tab.</p>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                      {adminFeedbackList.map(fb => (
                        <div key={fb.id} style={s.feedbackCard}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"8px", flexWrap:"wrap" }}>
                            <div style={{ fontSize:"13px", fontWeight:700, color:PALETTE.text }}>
                              {fb.company_policies?.title || <span style={{ color:PALETTE.textMuted }}>Unknown policy</span>}
                            </div>
                            <div style={{ display:"flex", gap:"8px", alignItems:"center", flexShrink:0 }}>
                              {fb.facility_number && (
                                <span style={s.facilityPill}>Facility {fb.facility_number}</span>
                              )}
                              <span style={{ fontSize:"11px", color:PALETTE.textMuted, fontFamily:MONO }}>{fmtDate(fb.created_at)}</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom: fb.note ? "8px" : "0" }}>
                            {(fb.flags || []).map(flag => (
                              <span key={flag} style={s.feedbackFlagChip}>{flag}</span>
                            ))}
                          </div>
                          {fb.note && (
                            <div style={s.feedbackNote}>"{fb.note}"</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── RECENT SEARCHES ── */}
                <div style={s.panelCard}>
                  <div style={s.sectionTopRow}>
                    <div style={s.sectionHeading}>Recent Plays</div>
                    <span style={s.countPill}>{recentSearchList.length}</span>
                  </div>
                  {recentSearchList.length === 0 ? (
                    <p style={{ color:PALETTE.textMuted, fontSize:"13px", margin:0 }}>No searches yet.</p>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {recentSearchList.map(s2 => (
                        <div key={s2.id} style={s.searchRow}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"13px", color:PALETTE.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {s2.situation_text}
                            </div>
                            {s2.company_policies?.title && (
                              <div style={{ fontSize:"11px", color:PALETTE.textSoft, marginTop:"2px" }}>
                                → {s2.company_policies.title}
                                {s2.company_policies.category && (
                                  <span style={{ ...s.catBadge, marginLeft:"6px", padding:"1px 5px", fontSize:"9px" }}>
                                    {s2.company_policies.category}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize:"11px", color:PALETTE.textMuted, fontFamily:MONO, flexShrink:0 }}>{timeAgo(s2.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── FEEDBACK MODAL ── */}
      {showFeedback && (
        <div style={s.overlay} onClick={closeFeedback}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            {feedbackDone ? (
              <>
                <div style={s.modalTitle}>Thanks for the signal</div>
                <p style={s.modalText}>Your feedback helps improve policies for the whole team.</p>
                <button style={s.primaryBtn} onClick={closeFeedback}>Done</button>
              </>
            ) : (
              <>
                <div style={s.modalTitle}>Flag Policy</div>
                <p style={s.modalSub}>{result?.title}</p>
                <div style={s.flagList}>
                  {FEEDBACK_FLAGS.map(flag => (
                    <button key={flag}
                      style={{ ...s.flagChip, ...(feedbackFlags.includes(flag) ? s.flagChipOn : {}) }}
                      onClick={() => toggleFlag(flag)}>
                      {feedbackFlags.includes(flag) ? "✓  " : ""}{flag}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom:"16px" }}>
                  <label style={s.label}>
                    Optional note <span style={{ color:PALETTE.textMuted, fontWeight:400, textTransform:"none", letterSpacing:0 }}>(max 280 chars)</span>
                  </label>
                  <textarea value={feedbackNote} onChange={e => setFeedbackNote(e.target.value.slice(0, 280))}
                    placeholder="Any additional context…" style={{ ...s.textarea, minHeight:"64px" }} />
                  <div style={{ fontSize:"10px", color:PALETTE.textMuted, textAlign:"right", marginTop:"-10px" }}>{feedbackNote.length}/280</div>
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <button
                    style={{ ...s.primaryBtn, flex:1, ...(!feedbackFlags.length || feedbackSubmitting ? { opacity:0.45, cursor:"not-allowed" } : {}) }}
                    onClick={submitFeedback} disabled={!feedbackFlags.length || feedbackSubmitting}>
                    {feedbackSubmitting ? "Submitting…" : "Submit Feedback"}
                  </button>
                  <button style={s.secondaryBtn} onClick={closeFeedback}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <a href="/support" style={s.footerLink}>Contact Support</a>
        <div style={s.footerBrand}>Operator Support Systems</div>
      </footer>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
  @keyframes fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
  .fade-up { animation: fadeUp 0.20s ease both; }
  .nav-tab:hover { color: #E8EDF3 !important; }
  textarea:focus, input:focus, select:focus {
    border-color: rgba(77,126,168,0.60) !important;
    box-shadow: 0 0 0 3px rgba(77,126,168,0.10) !important;
    outline: none !important;
  }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:#0B1118; }
  ::-webkit-scrollbar-thumb { background:#2A3B4E; border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:#3A5068; }
  .recent-chip:hover { border-color:#4A6680 !important; color:#E8EDF3 !important; }
  .alt-btn:hover { border-color:#4D7EA8 !important; background:rgba(77,126,168,0.07) !important; }
`;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight:"100vh", background:PALETTE.bg, color:PALETTE.text, fontFamily:SANS, padding:0, boxSizing:"border-box" },

  // nav
  topNav:         { background:PALETTE.panel, borderBottom:`1px solid ${PALETTE.borderStrong}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, height:"52px", paddingLeft:"20px", paddingRight:"16px", boxSizing:"border-box", boxShadow:"0 1px 0 rgba(0,0,0,0.30)" },
  topNavBrand:    { minWidth:"160px", flexShrink:0 },
  topNavProduct:  { fontWeight:700, color:PALETTE.text, fontSize:"14px", letterSpacing:"-0.01em" },
  topNavMeta:     { color:PALETTE.textMuted, marginTop:"2px", fontSize:"10px", letterSpacing:"0.03em" },
  topNavItems:    { display:"flex", alignItems:"stretch", gap:0, flex:1, overflowX:"auto", height:"52px" },
  topNavBtn:      { border:"none", borderBottom:"2px solid transparent", borderTop:"2px solid transparent", background:"transparent", color:PALETTE.textSoft, padding:"0 14px", fontSize:"11px", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", letterSpacing:"0.05em", textTransform:"uppercase", display:"flex", alignItems:"center", transition:"color 0.15s ease" },
  topNavBtnActive:{ borderBottom:`2px solid ${PALETTE.blue}`, color:PALETTE.text },
  topNavRight:    { display:"flex", alignItems:"center", gap:"8px", flexShrink:0 },
  topNavLogout:   { border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"5px 11px", fontSize:"10px", fontWeight:700, cursor:"pointer", letterSpacing:"0.07em", textTransform:"uppercase" },
  mobileMenuBtn:  { border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.text, borderRadius:"3px", padding:"6px 10px", fontSize:"12px", fontWeight:700, cursor:"pointer" },
  mobileDropdown: { background:PALETTE.panel, borderBottom:`1px solid ${PALETTE.border}`, padding:"10px 16px", display:"flex", flexDirection:"column", gap:"2px" },
  navDivider:     { height:"1px", background:PALETTE.border, margin:"4px 0" },
  navButton:      { width:"100%", textAlign:"left", border:"none", borderLeft:"2px solid transparent", background:"transparent", color:PALETTE.textSoft, padding:"10px 14px", fontSize:"12px", fontWeight:600, cursor:"pointer", letterSpacing:"0.04em", textTransform:"uppercase" },
  navButtonActive:{ borderLeft:`2px solid ${PALETTE.blue}`, color:PALETTE.text, background:PALETTE.blueGlow },

  // layout
  main: { maxWidth:"860px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"14px", padding:"28px 16px", boxSizing:"border-box" },

  // search
  heroLabel:   { fontSize:"22px", fontWeight:700, color:PALETTE.text, letterSpacing:"-0.01em", marginBottom:"16px" },
  searchForm:  { display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" },
  searchInput: { width:"100%", borderRadius:"4px", border:`1px solid ${PALETTE.borderStrong}`, borderTop:`1px solid ${PALETTE.borderBright}`, background:PALETTE.panelAlt, color:PALETTE.text, padding:"16px 18px", fontSize:"15px", lineHeight:1.6, resize:"vertical", outline:"none", boxSizing:"border-box", fontFamily:SANS, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.025)" },
  searchBtn:   { alignSelf:"flex-end", border:`1px solid ${PALETTE.blue}`, background:"rgba(77,126,168,0.15)", color:PALETTE.blue, borderRadius:"3px", padding:"10px 22px", fontSize:"12px", fontWeight:700, cursor:"pointer", letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:SANS },

  // recents
  recentSection: { marginBottom:"20px" },
  recentLabel:   { fontSize:"10px", fontWeight:800, color:PALETTE.textMuted, textTransform:"uppercase", letterSpacing:"0.10em", paddingLeft:"8px", borderLeft:`2px solid ${PALETTE.borderBright}`, marginBottom:"8px" },
  recentChip:    { display:"flex", alignItems:"center", gap:"8px", width:"100%", textAlign:"left", border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"9px 14px", fontSize:"13px", cursor:"pointer", marginBottom:"4px", transition:"border-color 0.12s ease, color 0.12s ease" },
  recentStar:    { color:PALETTE.amber, fontSize:"12px", flexShrink:0 },

  // searching / loading
  searchingState: { display:"flex", alignItems:"center", gap:"12px", padding:"40px 0" },
  searchingDot:   { width:"8px", height:"8px", borderRadius:"50%", background:PALETTE.blue, animation:"pulse 1.2s ease infinite", flexShrink:0 },
  searchingText:  { fontSize:"14px", color:PALETTE.textSoft, fontWeight:600 },

  // no result
  noResultWrap:  { padding:"40px 0", display:"flex", flexDirection:"column", gap:"10px" },
  noResultTitle: { fontSize:"16px", fontWeight:700, color:PALETTE.text },
  noResultText:  { fontSize:"13px", color:PALETTE.textSoft, lineHeight:1.6, margin:0 },

  // result view
  resultBar:        { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", marginBottom:"14px", flexWrap:"wrap" },
  backBtn:          { border:"none", background:"transparent", color:PALETTE.blue, fontSize:"12px", fontWeight:700, cursor:"pointer", letterSpacing:"0.04em", padding:0 },
  resultBarActions: { display:"flex", gap:"8px", alignItems:"center" },
  saveBtn:          { border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"6px 12px", fontSize:"11px", fontWeight:700, cursor:"pointer", letterSpacing:"0.05em" },
  saveBtnActive:    { border:`1px solid rgba(183,146,90,0.45)`, color:PALETTE.amber, background:"rgba(183,146,90,0.10)" },
  flagBtn:          { border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"6px 12px", fontSize:"11px", fontWeight:700, cursor:"pointer", letterSpacing:"0.05em" },

  situationEcho:      { fontSize:"13px", color:PALETTE.textSoft, marginBottom:"12px", padding:"10px 14px", background:PALETTE.panelAlt, border:`1px solid ${PALETTE.border}`, borderRadius:"3px", lineHeight:1.5 },
  situationEchoLabel: { fontWeight:700, color:PALETTE.textMuted, marginRight:"4px" },

  resultCard:   { background:PALETTE.panel, border:`1px solid ${PALETTE.border}`, borderTop:`1px solid ${PALETTE.borderStrong}`, borderRadius:"4px", padding:"18px 20px", marginBottom:"10px", boxShadow:"0 2px 8px rgba(0,0,0,0.22)" },
  cardLabel:    { fontSize:"10px", fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:PALETTE.textMuted, marginBottom:"12px", paddingLeft:"8px", borderLeft:`2px solid ${PALETTE.borderBright}` },
  actionSteps:  { fontSize:"14px", lineHeight:1.8, color:PALETTE.text, whiteSpace:"pre-wrap" },
  policyTitle:  { fontSize:"15px", fontWeight:700, color:PALETTE.text, marginBottom:"6px" },
  policySummary:{ fontSize:"13px", color:PALETTE.textSoft, lineHeight:1.65, margin:"10px 0 0" },
  bodyText:     { fontSize:"13px", lineHeight:1.7, color:PALETTE.text, whiteSpace:"pre-wrap" },

  codeBadge: { display:"inline-flex", alignItems:"center", padding:"3px 7px", borderRadius:"2px", fontSize:"10px", fontWeight:700, background:"rgba(77,126,168,0.15)", border:`1px solid rgba(77,126,168,0.42)`, color:PALETTE.blue, letterSpacing:"0.06em", textTransform:"uppercase" },
  catBadge:  { display:"inline-flex", alignItems:"center", padding:"3px 7px", borderRadius:"2px", fontSize:"10px", fontWeight:700, background:PALETTE.blueSoft, border:`1px solid ${PALETTE.border}`, color:PALETTE.textSoft, letterSpacing:"0.05em" },
  sevBadge:  { display:"inline-flex", alignItems:"center", padding:"3px 7px", borderRadius:"2px", fontSize:"10px", fontWeight:600, background:"transparent", border:`1px solid ${PALETTE.border}`, color:PALETTE.textMuted, letterSpacing:"0.04em" },

  altSection: { marginTop:"4px", marginBottom:"10px" },
  altLabel:   { fontSize:"10px", fontWeight:800, color:PALETTE.textMuted, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:"8px", paddingLeft:"8px", borderLeft:`2px solid ${PALETTE.borderBright}` },
  altBtn:     { width:"100%", textAlign:"left", border:`1px solid ${PALETTE.border}`, background:"transparent", borderRadius:"3px", padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", marginBottom:"4px", transition:"border-color 0.12s ease, background 0.12s ease" },
  altTitle:   { fontSize:"13px", fontWeight:600, color:PALETTE.textSoft },
  altCode:    { fontSize:"11px", color:PALETTE.textMuted, fontFamily:MONO, flexShrink:0 },

  searchBarBottom:   { marginTop:"8px", paddingTop:"16px", borderTop:`1px solid ${PALETTE.border}` },
  searchInlineForm:  { display:"flex", gap:"8px" },
  searchInlineInput: { flex:1, borderRadius:"3px", border:`1px solid ${PALETTE.borderStrong}`, background:PALETTE.panelAlt, color:PALETTE.text, padding:"10px 14px", fontSize:"13px", outline:"none", fontFamily:SANS },
  searchInlineBtn:   { border:`1px solid ${PALETTE.blue}`, background:"rgba(77,126,168,0.13)", color:PALETTE.blue, borderRadius:"3px", padding:"10px 16px", fontSize:"14px", fontWeight:700, cursor:"pointer" },

  // panels
  panelCard:     { background:PALETTE.panel, border:`1px solid ${PALETTE.border}`, borderTop:`1px solid ${PALETTE.borderStrong}`, borderRadius:"4px", padding:"20px 22px", boxShadow:"0 2px 10px rgba(0,0,0,0.25)" },
  sectionTopRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", flexWrap:"wrap", marginBottom:"16px" },
  sectionHeading:{ fontSize:"11px", fontWeight:800, color:PALETTE.text, textTransform:"uppercase", letterSpacing:"0.11em", paddingLeft:"8px", borderLeft:`2px solid ${PALETTE.borderBright}`, lineHeight:"14px" },
  label:         { display:"block", marginBottom:"8px", fontSize:"10px", fontWeight:700, color:PALETTE.textSoft, textTransform:"uppercase", letterSpacing:"0.09em" },
  selectInput:   { width:"100%", borderRadius:"3px", border:`1px solid ${PALETTE.border}`, background:PALETTE.panelAlt, color:PALETTE.text, padding:"10px 12px", fontSize:"13px", outline:"none", boxSizing:"border-box" },
  textarea:      { width:"100%", minHeight:"110px", borderRadius:"3px", border:`1px solid ${PALETTE.border}`, background:PALETTE.panelAlt, color:PALETTE.text, padding:"12px 14px", fontSize:"14px", lineHeight:1.65, resize:"vertical", outline:"none", boxSizing:"border-box", fontFamily:SANS },
  primaryBtn:    { border:`1px solid ${PALETTE.blue}`, background:"rgba(77,126,168,0.14)", color:PALETTE.blue, borderRadius:"3px", padding:"9px 18px", fontSize:"11px", fontWeight:700, cursor:"pointer", letterSpacing:"0.07em", textTransform:"uppercase", fontFamily:SANS },
  secondaryBtn:  { border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"7px 13px", fontSize:"11px", fontWeight:700, cursor:"pointer", letterSpacing:"0.05em" },
  countPill:     { fontSize:"11px", fontWeight:700, color:PALETTE.textMuted, background:PALETTE.panelAlt, border:`1px solid ${PALETTE.border}`, borderRadius:"10px", padding:"2px 8px", fontFamily:MONO },

  // notes
  noteCard:      { background:PALETTE.panelAlt, border:`1px solid ${PALETTE.borderStrong}`, borderRadius:"4px", padding:"14px 16px", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.025), 0 1px 4px rgba(0,0,0,0.18)" },
  noteBadge:     { display:"inline-flex", alignItems:"center", padding:"3px 7px", borderRadius:"2px", fontSize:"10px", fontWeight:800, letterSpacing:"0.07em", textTransform:"uppercase" },
  noteType:      { fontSize:"12px", color:PALETTE.textSoft, fontWeight:600 },
  noteTimestamp: { fontSize:"11px", color:"#8F9EAD", fontFamily:MONO },
  noteText:      { fontSize:"13px", color:PALETTE.text, lineHeight:1.65 },
  noteBy:        { marginTop:"8px", fontSize:"11px", color:PALETTE.textMuted },

  // admin analytics
  statsRow:  { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"12px" },
  statCard:  { background:PALETTE.panel, border:`1px solid ${PALETTE.border}`, borderTop:`1px solid ${PALETTE.borderStrong}`, borderRadius:"4px", padding:"18px 20px", boxShadow:"0 2px 8px rgba(0,0,0,0.20)" },
  statValue: { fontSize:"32px", fontWeight:700, color:PALETTE.text, fontFamily:MONO, letterSpacing:"-0.02em", lineHeight:1 },
  statLabel: { fontSize:"10px", fontWeight:700, color:PALETTE.textMuted, textTransform:"uppercase", letterSpacing:"0.10em", marginTop:"8px" },

  feedbackCard:    { background:PALETTE.panelAlt, border:`1px solid ${PALETTE.borderStrong}`, borderRadius:"4px", padding:"14px 16px" },
  feedbackFlagChip:{ display:"inline-flex", alignItems:"center", padding:"3px 8px", borderRadius:"2px", fontSize:"11px", fontWeight:600, background:"rgba(77,126,168,0.10)", border:`1px solid rgba(77,126,168,0.30)`, color:PALETTE.textSoft },
  feedbackNote:    { fontSize:"13px", color:PALETTE.textSoft, lineHeight:1.55, fontStyle:"italic", marginTop:"6px", paddingTop:"8px", borderTop:`1px solid ${PALETTE.border}` },
  facilityPill:    { fontSize:"10px", fontWeight:700, color:PALETTE.textMuted, background:PALETTE.panelDeep, border:`1px solid ${PALETTE.border}`, borderRadius:"2px", padding:"2px 6px", letterSpacing:"0.05em" },

  searchRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", padding:"10px 14px", background:PALETTE.panelAlt, border:`1px solid ${PALETTE.border}`, borderRadius:"3px" },

  // feedback modal
  overlay:    { position:"fixed", inset:0, zIndex:200, background:"rgba(11,17,24,0.82)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px", boxSizing:"border-box" },
  modal:      { background:PALETTE.panel, border:`1px solid ${PALETTE.borderStrong}`, borderTop:`1px solid ${PALETTE.borderBright}`, borderRadius:"4px", padding:"24px 26px", width:"100%", maxWidth:"440px", boxShadow:"0 8px 40px rgba(0,0,0,0.55)" },
  modalTitle: { fontSize:"16px", fontWeight:700, color:PALETTE.text, marginBottom:"4px" },
  modalSub:   { fontSize:"12px", color:PALETTE.textSoft, margin:"4px 0 16px" },
  modalText:  { fontSize:"13px", color:PALETTE.textSoft, lineHeight:1.6, marginBottom:"16px" },
  flagList:   { display:"flex", flexDirection:"column", gap:"6px", marginBottom:"16px" },
  flagChip:   { textAlign:"left", border:`1px solid ${PALETTE.border}`, background:"transparent", color:PALETTE.textSoft, borderRadius:"3px", padding:"10px 14px", fontSize:"13px", cursor:"pointer", transition:"border-color 0.12s ease" },
  flagChipOn: { border:`1px solid rgba(77,126,168,0.50)`, background:"rgba(77,126,168,0.10)", color:PALETTE.text },

  // footer
  footer:      { borderTop:`1px solid ${PALETTE.border}`, padding:"14px 20px", textAlign:"center", marginTop:"8px" },
  footerLink:  { fontSize:"11px", fontWeight:600, color:PALETTE.textSoft, textDecoration:"none", letterSpacing:"0.06em", textTransform:"uppercase" },
  footerBrand: { marginTop:"6px", fontSize:"10px", color:PALETTE.textMuted, letterSpacing:"0.04em" },
};
