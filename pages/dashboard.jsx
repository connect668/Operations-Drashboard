import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const P = {
  bg:          "#090E14",
  surface:     "#10171F",
  raise:       "#172030",
  high:        "#1E2C3D",
  border:      "#22303F",
  borderMid:   "#2C3E52",
  borderHigh:  "#3A5168",
  text:        "#EDF1F5",
  soft:        "#95A8B8",
  muted:       "#60778A",
  blue:        "#4A82B0",
  blueDim:     "rgba(74,130,176,0.16)",
  blueGlow:    "rgba(74,130,176,0.07)",
  green:       "#5E9E72",
  greenDim:    "rgba(94,158,114,0.14)",
  amber:       "#B5904E",
  amberDim:    "rgba(181,144,78,0.14)",
  red:         "#A85858",
  redDim:      "rgba(168,88,88,0.14)",
  purple:      "#7A6BA8",
  purpleDim:   "rgba(122,107,168,0.14)",
};
const MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace';
const SANS = 'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif';

// ─── ROLES ────────────────────────────────────────────────────────────────────
const RANK = { employee:0, shift_lead:1, manager:2, gm:3, area_coach:4, executive:5, admin:99 };
const atLeast = (role, min) => (RANK[role]??0) >= (RANK[min]??0);
const ROLE_LABELS = {
  employee:"Employee", shift_lead:"Shift Lead", manager:"Manager",
  gm:"General Manager", area_coach:"Area Coach", executive:"Executive", admin:"Admin",
};

// ─── FEEDBACK TYPES ───────────────────────────────────────────────────────────
const FB_TYPES = [
  { id:"policy_unclear",       label:"Policy unclear",         color: P.amber  },
  { id:"process_unrealistic",  label:"Process unrealistic",    color: P.red    },
  { id:"hard_to_follow",       label:"Hard to follow",         color: P.purple },
  { id:"training_gap",         label:"Training gap",           color: P.blue   },
  { id:"missing_guidance",     label:"Missing guidance",       color: P.soft   },
  { id:"other",                label:"Other",                  color: P.muted  },
];

// ─── FEEDBACK FLAG CHIPS (for policy feedback modal) ─────────────────────────
const POLICY_FLAGS = [
  "Hard to understand",
  "Not specific enough",
  "Did not match situation",
  "Missing escalation guidance",
  "Could not find answer fast enough",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = v => UUID_RE.test(v) ? v : null;

function applyScope(q, profile) {
  const cid = safeUuid(profile?.company_id);
  if (cid) return q.eq("company_id", cid);
  if (profile?.company) return q.eq("company", profile.company);
  return q;
}

function timeAgo(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function buildTabs(role) {
  const t = [
    { id:"home",       label:"Home",     icon:"home"     },
    { id:"ask",        label:"Ask",      icon:"ask"      },
  ];
  if (atLeast(role,"shift_lead")) t.push({ id:"procedures", label:"Guides", icon:"guides" });
  t.push({ id:"feedback", label:"Feedback", icon:"feedback" });
  if (atLeast(role,"gm"))    t.push({ id:"signals",   label:"Signals",   icon:"signals"   });
  if (role === "admin")      t.push({ id:"analytics", label:"Analytics", icon:"analytics" });
  return t;
}

// ─── NAV ICON SVGs ────────────────────────────────────────────────────────────
function NavIcon({ name, active }) {
  const c = active ? P.blue : P.muted;
  const icons = {
    home:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
    ask:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    guides:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
    feedback:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    signals:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    analytics: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  };
  return icons[name] || null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PlaybookApp() {
  const router = useRouter();

  // Auth
  const [profile,     setProfile]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // UI
  const [activeTab,  setActiveTab]  = useState("home");
  const [isMobile,   setIsMobile]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);

  // Ask/Search
  const [query,      setQuery]      = useState("");
  const [searching,  setSearching]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [altResults, setAltResults] = useState([]);
  const [noResult,   setNoResult]   = useState(false);
  const [searchId,   setSearchId]   = useState(null);
  const [isSaved,    setIsSaved]    = useState(false);
  const [recents,    setRecents]    = useState([]);
  const [savedPlays, setSavedPlays] = useState([]);

  // Policy feedback modal
  const [showPolicyFeedback, setShowPolicyFeedback] = useState(false);
  const [policyFlags,        setPolicyFlags]        = useState([]);
  const [policyFeedbackNote, setPolicyFeedbackNote] = useState("");
  const [policyFbSubmitting, setPolicyFbSubmitting] = useState(false);
  const [policyFbDone,       setPolicyFbDone]       = useState(false);

  // Procedures
  const [procedures,     setProcedures]     = useState([]);
  const [procsLoading,   setProcsLoading]   = useState(false);
  const [procsFetched,   setProcsFetched]   = useState(false);
  const [expandedProc,   setExpandedProc]   = useState(null);
  const [procSearch,     setProcSearch]     = useState("");

  // Anonymous feedback
  const [fbType,         setFbType]         = useState("");
  const [fbCategory,     setFbCategory]     = useState("");
  const [fbDescription,  setFbDescription]  = useState("");
  const [fbSubmitting,   setFbSubmitting]   = useState(false);
  const [fbDone,         setFbDone]         = useState(false);
  const [fbError,        setFbError]        = useState("");

  // Signals / analytics
  const [sigLoading,     setSigLoading]     = useState(false);
  const [sigFetched,     setSigFetched]     = useState(false);
  const [totalSearches,  setTotalSearches]  = useState(0);
  const [catBreakdown,   setCatBreakdown]   = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [feedbackList,   setFeedbackList]   = useState([]);
  const [anonFeedback,   setAnonFeedback]   = useState([]);

  const queryRef = useRef(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    (async () => {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user)    { router.replace("/"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,full_name,facility_number,company,company_id,role,plan")
        .eq("id", user.id).maybeSingle();
      if (!prof)    { router.replace("/"); return; }
      if (live) { setProfile(prof); setAuthLoading(false); }
    })();
    return () => { live = false; };
  }, [router]);

  // ── Mobile ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Load recents on profile ready ───────────────────────────────────────────
  useEffect(() => { if (profile) loadRecents(); }, [profile]);

  // ── Tab data triggers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    if (activeTab === "procedures" && !procsFetched) loadProcedures();
    if ((activeTab === "signals" || activeTab === "analytics") && !sigFetched) loadSignals();
  }, [activeTab, profile]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const role      = profile?.role || "employee";
  const isPro     = profile?.plan === "pro" || atLeast(role, "manager");
  const isLeader  = atLeast(role, "gm");
  const isManager = atLeast(role, "manager");
  const isAdmin   = role === "admin";
  const tabs      = profile ? buildTabs(role) : [];

  // ── Recents ─────────────────────────────────────────────────────────────────
  const loadRecents = async () => {
    try {
      const { data } = await supabase.from("playbook_searches")
        .select("id,situation_text,policy_id,saved,created_at")
        .eq("user_id", profile.id)
        .order("created_at",{ascending:false}).limit(20);
      const all = data || [];
      setRecents(all.filter(r=>!r.saved).slice(0,6));
      setSavedPlays(all.filter(r=>r.saved));
    } catch {}
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const doSearch = async (term) => {
    if (!term.trim()) return;
    setSearching(true); setNoResult(false); setResult(null);
    setAltResults([]); setSearchId(null); setIsSaved(false);
    try {
      let q = supabase.from("company_policies")
        .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
        .eq("is_active", true);
      q = applyScope(q, profile);
      q = q.or(`title.ilike.%${term}%,policy_text.ilike.%${term}%,keywords.ilike.%${term}%,summary.ilike.%${term}%`);
      const { data: primary } = await q.limit(5);
      let hits = primary || [];

      if (!hits.length) {
        for (const w of term.split(/\s+/).filter(w=>w.length>3).slice(0,4)) {
          let wq = supabase.from("company_policies")
            .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
            .eq("is_active",true);
          wq = applyScope(wq, profile);
          wq = wq.or(`title.ilike.%${w}%,keywords.ilike.%${w}%,summary.ilike.%${w}%`);
          const { data: wr } = await wq.limit(3);
          if (wr?.length) { hits = wr; break; }
        }
      }

      if (!hits.length) { setNoResult(true); }
      else {
        setResult(hits[0]);
        setAltResults(hits.slice(1));
        try {
          const { data: logged } = await supabase.from("playbook_searches")
            .insert({ user_id:profile.id, facility_number:profile.facility_number||null,
              company_id:safeUuid(profile.company_id), situation_text:term,
              policy_id:hits[0].id, saved:false })
            .select("id").single();
          if (logged?.id) { setSearchId(logged.id); loadRecents(); }
        } catch {}
      }
    } finally { setSearching(false); }
  };

  const handleSearch = e => { e?.preventDefault(); doSearch(query.trim()); };
  const clearSearch  = () => {
    setResult(null); setNoResult(false); setQuery(""); setSearchId(null); setIsSaved(false);
    setTimeout(()=>queryRef.current?.focus(), 50);
  };
  const reopenRecent = async (r) => {
    setQuery(r.situation_text);
    if (r.policy_id) {
      setSearching(true); setResult(null); setAltResults([]);
      try {
        const { data } = await supabase.from("company_policies")
          .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
          .eq("id",r.policy_id).maybeSingle();
        if (data) { setResult(data); setSearchId(r.id); setIsSaved(r.saved||false); }
        else await doSearch(r.situation_text);
      } finally { setSearching(false); }
    } else await doSearch(r.situation_text);
  };

  const handleSave = async () => {
    if (!searchId) return;
    try {
      await supabase.from("playbook_searches").update({saved:!isSaved}).eq("id",searchId);
      setIsSaved(!isSaved); loadRecents();
    } catch {}
  };

  // ── Policy feedback modal ─────────────────────────────────────────────────
  const togglePolicyFlag = f => setPolicyFlags(p => p.includes(f)?p.filter(x=>x!==f):[...p,f]);
  const submitPolicyFeedback = async () => {
    if (!policyFlags.length) return;
    setPolicyFbSubmitting(true);
    try {
      await supabase.from("policy_feedback").insert({
        user_id:profile.id, policy_id:result?.id||null,
        facility_number:profile.facility_number||null,
        company_id:safeUuid(profile.company_id),
        flags:policyFlags, note:policyFeedbackNote.trim()||null,
      });
    } catch {}
    setPolicyFbDone(true); setPolicyFbSubmitting(false);
  };
  const closePolicyFeedback = () => {
    setShowPolicyFeedback(false); setPolicyFlags([]); setPolicyFeedbackNote(""); setPolicyFbDone(false);
  };

  // ── Procedures ───────────────────────────────────────────────────────────────
  const loadProcedures = async () => {
    setProcsLoading(true);
    try {
      let q = supabase.from("company_policies")
        .select("id,title,policy_code,category,summary,action_steps,policy_text,is_active")
        .eq("is_active",true).order("category").order("title");
      q = applyScope(q, profile);
      const { data } = await q.limit(100);
      setProcedures(data||[]);
    } catch {}
    setProcsLoading(false); setProcsFetched(true);
  };

  const filteredProcs = procedures.filter(p => {
    if (!procSearch.trim()) return true;
    const s = procSearch.toLowerCase();
    return (p.title||"").toLowerCase().includes(s) || (p.category||"").toLowerCase().includes(s) || (p.summary||"").toLowerCase().includes(s);
  });

  // Group procedures by category
  const procsByCategory = filteredProcs.reduce((acc, p) => {
    const cat = p.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // ── Anonymous feedback ────────────────────────────────────────────────────
  const submitAnonFeedback = async () => {
    if (!fbType) { setFbError("Please select a feedback type."); return; }
    setFbSubmitting(true); setFbError("");
    try {
      await supabase.from("anonymous_feedback").insert({
        company_id: safeUuid(profile.company_id) || null,
        company:    profile.company || null,
        facility_number: profile.facility_number || null,
        feedback_type: fbType,
        category:    fbCategory.trim() || null,
        description: fbDescription.trim() || null,
      });
      setFbDone(true);
    } catch (err) {
      setFbError("Submission failed. Please try again.");
    }
    setFbSubmitting(false);
  };

  // ── Signals / analytics ───────────────────────────────────────────────────
  const loadSignals = async () => {
    setSigLoading(true);
    try {
      // Search stats
      let sq = supabase.from("playbook_searches")
        .select("id,situation_text,created_at,policy_id,company_policies(title,category)")
        .order("created_at",{ascending:false}).limit(500);
      sq = applyScope(sq, profile);
      const { data: searches } = await sq;
      const allS = searches || [];
      setTotalSearches(allS.length);
      setRecentSearches(allS.slice(0,30));

      const catMap = {};
      allS.forEach(s => {
        const cat = s.company_policies?.category || "Uncategorized";
        catMap[cat] = (catMap[cat]||0)+1;
      });
      setCatBreakdown(Object.entries(catMap).sort((a,b)=>b[1]-a[1]));

      // Policy feedback
      let fq = supabase.from("policy_feedback")
        .select("id,flags,note,created_at,facility_number,policy_id,company_policies(title)")
        .order("created_at",{ascending:false}).limit(100);
      fq = applyScope(fq, profile);
      const { data: fb } = await fq;
      setFeedbackList(fb||[]);

      // Anonymous feedback
      let aq = supabase.from("anonymous_feedback")
        .select("id,feedback_type,category,description,created_at,facility_number")
        .order("created_at",{ascending:false}).limit(100);
      aq = applyScope(aq, profile);
      const { data: af } = await aq;
      setAnonFeedback(af||[]);

    } catch (err) { console.warn("signals load:", err.message); }
    setSigLoading(false); setSigFetched(true);
  };

  // ─── Derived signals ────────────────────────────────────────────────────────
  const anonByType = anonFeedback.reduce((acc,f) => {
    acc[f.feedback_type] = (acc[f.feedback_type]||0)+1; return acc;
  }, {});

  // Friction alerts — categories with 3+ searches and any matching feedback
  const frictionAlerts = catBreakdown.filter(([cat, count]) => {
    if (count < 3) return false;
    const hasFeedback = feedbackList.some(f => f.company_policies?.title?.toLowerCase().includes(cat.toLowerCase()));
    return hasFeedback || count >= 5;
  }).slice(0,3);

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:P.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:32,height:32,border:`2px solid ${P.borderMid}`,borderTopColor:P.blue,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:P.muted,fontSize:11,letterSpacing:"0.10em",textTransform:"uppercase",fontFamily:MONO,margin:0}}>Loading</p>
      </div>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.shell}>
      <Head><title>Playbook</title></Head>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.brand}>
            <span style={s.brandDot}/>
            <span style={s.brandName}>Playbook</span>
            {isPro && <span style={s.proBadge}>PRO</span>}
          </div>

          {/* Desktop nav */}
          {!isMobile && (
            <nav style={s.desktopNav}>
              {tabs.map(t => (
                <button key={t.id} onClick={()=>setActiveTab(t.id)}
                  className="nav-btn"
                  style={{...s.desktopNavBtn,...(activeTab===t.id?s.desktopNavBtnActive:{})}}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div style={s.topBarRight}>
            {isMobile && (
              <div style={s.mobileUser}>{ROLE_LABELS[role]||role}</div>
            )}
            {!isMobile && (
              <div style={{fontSize:11,color:P.muted,marginRight:12}}>
                {profile?.full_name} · {ROLE_LABELS[role]||role}
              </div>
            )}
            <button className="ghost-btn" style={s.signOutBtn}
              onClick={async()=>{ await supabase.auth.signOut(); router.replace("/"); }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── PAGE CONTENT ────────────────────────────────────────────────── */}
      <main style={{...s.main, paddingBottom: isMobile ? 80 : 40}}>

        {/* ══════════════════════════════════════════════════════════════
            HOME TAB
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "home" && (
          <div className="fade-in">
            {/* Header */}
            <div style={s.pageHeader}>
              <div style={s.pageGreeting}>
                {profile?.full_name ? `Hey, ${profile.full_name.split(" ")[0]}` : "Welcome back"}
              </div>
              <div style={s.pageSubhead}>
                {isLeader ? "Operational signals and insights" :
                 isManager ? "Manager assistance and policy guidance" :
                 "Quick answers for your shift"}
              </div>
            </div>

            {/* Employee / Shift Lead home */}
            {!isManager && !isLeader && !isAdmin && (
              <div style={s.homeGrid}>
                <button style={s.homeHeroCard} onClick={()=>setActiveTab("ask")}>
                  <div style={s.homeHeroIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={P.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <div style={s.homeHeroTitle}>Ask Playbook</div>
                  <div style={s.homeHeroSub}>Get a quick answer to any work situation</div>
                  <div style={s.homeHeroArrow}>→</div>
                </button>

                <button style={s.homeCard} onClick={()=>setActiveTab("feedback")}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{...s.homeCardIcon, background:P.purpleDim}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </div>
                    <div>
                      <div style={s.homeCardTitle}>Give Feedback</div>
                      <div style={s.homeCardSub}>Anonymously flag unclear policies</div>
                    </div>
                  </div>
                </button>

                {isPro && (
                  <button style={s.homeCard} onClick={()=>setActiveTab("procedures")}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{...s.homeCardIcon, background:P.greenDim}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                      </div>
                      <div>
                        <div style={s.homeCardTitle}>Step-by-Step Guides</div>
                        <div style={s.homeCardSub}>Company procedures and workflows</div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Manager home */}
            {isManager && !isLeader && !isAdmin && (
              <div style={s.homeGrid}>
                <button style={s.homeHeroCard} onClick={()=>setActiveTab("ask")}>
                  <div style={s.homeHeroIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={P.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <div style={s.homeHeroTitle}>Ask Playbook AI</div>
                  <div style={s.homeHeroSub}>Manager-level guidance for any situation</div>
                  <div style={s.homeHeroArrow}>→</div>
                </button>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <button style={s.homeSmallCard} onClick={()=>setActiveTab("procedures")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    <div style={s.homeSmallTitle}>Guides</div>
                  </button>
                  <button style={s.homeSmallCard} onClick={()=>setActiveTab("feedback")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div style={s.homeSmallTitle}>Feedback</div>
                  </button>
                </div>

                {recents.length > 0 && (
                  <div style={s.homeSectionWrap}>
                    <div style={s.homeSectionLabel}>Recent plays</div>
                    {recents.slice(0,3).map(r=>(
                      <button key={r.id} className="list-row" style={s.recentRow} onClick={()=>{setActiveTab("ask");reopenRecent(r);}}>
                        <span style={s.recentRowText}>{r.situation_text}</span>
                        <span style={s.recentRowTime}>{timeAgo(r.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Leadership home */}
            {(isLeader || isAdmin) && (
              <div style={s.homeGrid}>
                {/* Signal summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{totalSearches || "—"}</div>
                    <div style={s.statLabel}>Plays pulled</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{catBreakdown.length || "—"}</div>
                    <div style={s.statLabel}>Categories active</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{feedbackList.length || "—"}</div>
                    <div style={s.statLabel}>Feedback signals</div>
                  </div>
                </div>

                {frictionAlerts.length > 0 && (
                  <div style={s.homeSectionWrap}>
                    <div style={s.homeSectionLabel}>Friction signals</div>
                    {frictionAlerts.map(([cat,count])=>(
                      <div key={cat} style={{...s.alertCard, borderLeftColor:P.amber}}>
                        <div style={s.alertTitle}>"{cat}" searched heavily</div>
                        <div style={s.alertSub}>{count} pulls — may indicate unclear guidance</div>
                      </div>
                    ))}
                  </div>
                )}

                <button style={s.homeHeroCard} onClick={()=>setActiveTab(isAdmin?"analytics":"signals")}>
                  <div style={s.homeHeroIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={P.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div style={s.homeHeroTitle}>View Full Signals</div>
                  <div style={s.homeHeroSub}>Category trends, feedback, and friction points</div>
                  <div style={s.homeHeroArrow}>→</div>
                </button>

                <button style={s.homeCard} onClick={()=>setActiveTab("ask")}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{...s.homeCardIcon,background:P.blueDim}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div>
                      <div style={s.homeCardTitle}>Ask Playbook</div>
                      <div style={s.homeCardSub}>Search policies and procedures</div>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ASK TAB
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "ask" && (
          <div className="fade-in">
            {!result && !noResult && !searching && (
              <>
                <div style={s.pageHeader}>
                  <div style={s.pageTitle}>
                    {isManager ? "Ask Playbook AI" : "Ask a Question"}
                  </div>
                  <div style={s.pageSubhead}>
                    {isManager ? "Describe the situation — get policy-backed guidance" : "Get a quick answer for your situation"}
                  </div>
                </div>

                <form onSubmit={handleSearch} style={s.searchForm}>
                  <textarea
                    ref={queryRef}
                    value={query}
                    onChange={e=>setQuery(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSearch();} }}
                    placeholder={isManager
                      ? "e.g.  employee called off 30 min before shift\n       customer dispute over return policy\n       team member repeated policy violation"
                      : "e.g.  what do I do if a customer wants a refund?\n       who do I call for an equipment issue?"}
                    style={s.searchTextarea}
                    autoFocus
                  />
                  <button type="submit" style={{...s.searchSubmitBtn,...(!query.trim()?{opacity:0.45,pointerEvents:"none"}:{})}} disabled={!query.trim()}>
                    Get the Play
                  </button>
                </form>

                {savedPlays.length > 0 && (
                  <div style={s.recentSection}>
                    <div style={s.recentSectionLabel}>Saved plays</div>
                    {savedPlays.map(r=>(
                      <button key={r.id} className="list-row" style={s.recentChip} onClick={()=>reopenRecent(r)}>
                        <span style={{color:P.amber,fontSize:13,flexShrink:0}}>★</span>
                        <span style={s.recentChipText}>{r.situation_text}</span>
                      </button>
                    ))}
                  </div>
                )}
                {recents.length > 0 && (
                  <div style={s.recentSection}>
                    <div style={s.recentSectionLabel}>Recent</div>
                    {recents.map(r=>(
                      <button key={r.id} className="list-row" style={s.recentChip} onClick={()=>reopenRecent(r)}>
                        <span style={s.recentChipText}>{r.situation_text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {searching && (
              <div style={s.loadingState} className="fade-in">
                <div style={s.spinner}/>
                <span style={s.loadingText}>Finding the play…</span>
              </div>
            )}

            {noResult && !searching && (
              <div style={s.emptyState} className="fade-in">
                <div style={s.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                </div>
                <div style={s.emptyTitle}>No matching policy found</div>
                <div style={s.emptyBody}>Try different keywords, or check with your manager if this situation isn't covered.</div>
                <button style={s.outlineBtn} onClick={clearSearch}>Try again</button>
              </div>
            )}

            {result && !searching && (
              <div className="fade-in">
                {/* Action bar */}
                <div style={s.resultActionBar}>
                  <button style={s.backTextBtn} onClick={clearSearch}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    New search
                  </button>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...s.chipBtn,...(isSaved?s.chipBtnSaved:{})}} onClick={handleSave}>
                      {isSaved?"★ Saved":"☆ Save"}
                    </button>
                    <button style={s.chipBtn} onClick={()=>{setShowPolicyFeedback(true);setPolicyFbDone(false);}}>
                      Flag
                    </button>
                  </div>
                </div>

                {/* Situation echo */}
                <div style={s.situationEcho}>
                  <span style={{color:P.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Situation · </span>
                  {query}
                </div>

                {/* The Play */}
                <div style={s.resultCard}>
                  <div style={s.resultCardLabel}>The Play</div>
                  <div style={s.resultCardBody}>
                    {result.action_steps || result.summary || result.policy_text || "No steps available."}
                  </div>
                </div>

                {/* Policy behind it */}
                <div style={s.resultCard}>
                  <div style={s.resultCardLabel}>Policy Behind It</div>
                  <div style={s.policyName}>{result.title}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                    {result.policy_code && <span style={s.badge(P.blue)}>{result.policy_code}</span>}
                    {result.category    && <span style={s.badge(P.muted)}>{result.category}</span>}
                    {result.severity    && <span style={s.badge(P.borderHigh)}>{result.severity}</span>}
                  </div>
                  {result.summary && result.action_steps && (
                    <div style={{...s.resultCardBody,marginTop:12,color:P.soft}}>{result.summary}</div>
                  )}
                </div>

                {result.incorrect_examples && (
                  <div style={{...s.resultCard,borderLeft:`3px solid ${P.amber}`}}>
                    <div style={{...s.resultCardLabel,color:P.amber}}>Avoid This</div>
                    <div style={s.resultCardBody}>{result.incorrect_examples}</div>
                  </div>
                )}

                {result.escalation_guidance && (
                  <div style={{...s.resultCard,borderLeft:`3px solid ${P.red}`}}>
                    <div style={{...s.resultCardLabel,color:P.red}}>Escalate If</div>
                    <div style={s.resultCardBody}>{result.escalation_guidance}</div>
                  </div>
                )}

                {altResults.length > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={s.sectionMiniLabel}>Also relevant</div>
                    {altResults.map(alt=>(
                      <button key={alt.id} className="list-row" style={s.altPolicyRow}
                        onClick={()=>{setResult(alt);setAltResults([]);setSearchId(null);setIsSaved(false);}}>
                        <span style={{fontSize:14,color:P.soft,fontWeight:600}}>{alt.title}</span>
                        {alt.category && <span style={s.badge(P.borderMid)}>{alt.category}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search again */}
                <div style={s.searchAgainWrap}>
                  <form onSubmit={handleSearch} style={{display:"flex",gap:8}}>
                    <input value={query} onChange={e=>setQuery(e.target.value)}
                      placeholder="Search another situation…" style={s.inlineSearchInput}/>
                    <button type="submit" style={s.inlineSearchBtn} disabled={!query.trim()}>→</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PROCEDURES TAB
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "procedures" && (
          <div className="fade-in">
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>Step-by-Step Guides</div>
              <div style={s.pageSubhead}>Company procedures and workflows</div>
            </div>

            <div style={{position:"relative",marginBottom:20}}>
              <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={procSearch} onChange={e=>setProcSearch(e.target.value)}
                placeholder="Search guides…" style={{...s.inlineSearchInput,paddingLeft:40,width:"100%",boxSizing:"border-box"}}/>
            </div>

            {procsLoading && <div style={s.loadingState}><div style={s.spinner}/></div>}

            {!procsLoading && procedures.length === 0 && (
              <div style={s.emptyState}>
                <div style={s.emptyTitle}>No guides yet</div>
                <div style={s.emptyBody}>Company procedures will appear here once added.</div>
              </div>
            )}

            {!procsLoading && Object.entries(procsByCategory).map(([cat, items]) => (
              <div key={cat} style={{marginBottom:24}}>
                <div style={s.catGroupLabel}>{cat}</div>
                {items.map(proc => (
                  <div key={proc.id} style={s.procCard}>
                    <button className="proc-header" style={s.procHeader}
                      onClick={()=>setExpandedProc(expandedProc===proc.id?null:proc.id)}>
                      <div>
                        <div style={s.procTitle}>{proc.title}</div>
                        {proc.summary && expandedProc !== proc.id && (
                          <div style={s.procSummaryLine}>{proc.summary}</div>
                        )}
                      </div>
                      <svg style={{transform:`rotate(${expandedProc===proc.id?180:0}deg)`,transition:"transform 0.2s ease",flexShrink:0}}
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {expandedProc === proc.id && (
                      <div style={s.procBody}>
                        {proc.action_steps ? (
                          <>
                            <div style={s.procStepLabel}>Steps</div>
                            <div style={s.procSteps}>{proc.action_steps}</div>
                          </>
                        ) : (
                          <div style={s.procSteps}>{proc.policy_text || proc.summary || "No content available."}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            FEEDBACK TAB
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "feedback" && (
          <div className="fade-in">
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>Anonymous Feedback</div>
              <div style={s.pageSubhead}>Help improve company systems. Your identity is never recorded.</div>
            </div>

            {fbDone ? (
              <div style={s.successCard}>
                <div style={s.successIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={s.successTitle}>Feedback submitted</div>
                <div style={s.successBody}>Thanks. Your feedback helps leadership improve the systems you work with every day.</div>
                <button style={s.primaryBtn} onClick={()=>{setFbDone(false);setFbType("");setFbCategory("");setFbDescription("");}}>
                  Submit another
                </button>
              </div>
            ) : (
              <div style={s.card}>
                <div style={s.cardSection}>
                  <div style={s.fieldLabel}>What kind of issue?</div>
                  <div style={s.fbTypeGrid}>
                    {FB_TYPES.map(ft=>(
                      <button key={ft.id} onClick={()=>setFbType(ft.id)}
                        className="fb-type-btn"
                        style={{...s.fbTypeBtn,...(fbType===ft.id?{...s.fbTypeBtnActive,borderColor:ft.color,color:ft.color}:{})}}>
                        {ft.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={s.cardSection}>
                  <label style={s.fieldLabel}>
                    Related area <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span>
                  </label>
                  <input value={fbCategory} onChange={e=>setFbCategory(e.target.value)}
                    placeholder="e.g. call-offs, food safety, returns…"
                    style={s.textInput}/>
                </div>

                <div style={s.cardSection}>
                  <label style={s.fieldLabel}>
                    Tell us more <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional, anonymous)</span>
                  </label>
                  <textarea value={fbDescription} onChange={e=>setFbDescription(e.target.value.slice(0,400))}
                    placeholder="Describe what's confusing or what could be clearer…"
                    style={{...s.textInput,minHeight:120,resize:"vertical",lineHeight:1.65}}/>
                  <div style={{fontSize:10,color:P.muted,textAlign:"right",marginTop:4}}>{fbDescription.length}/400</div>
                </div>

                {fbError && <div style={s.errorBox}>{fbError}</div>}

                <button style={{...s.primaryBtn,...(!fbType||fbSubmitting?{opacity:0.45,pointerEvents:"none"}:{})}}
                  onClick={submitAnonFeedback} disabled={!fbType||fbSubmitting}>
                  {fbSubmitting ? "Submitting…" : "Submit Feedback"}
                </button>

                <div style={{marginTop:16,padding:14,background:P.raise,borderRadius:8,border:`1px solid ${P.border}`}}>
                  <div style={{fontSize:11,color:P.muted,lineHeight:1.6}}>
                    🔒 Your name and account are never linked to this submission. Only the type, area, and description are stored.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SIGNALS TAB (leadership)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "signals" && (
          <div className="fade-in">
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>Operational Signals</div>
              <div style={s.pageSubhead}>Where your systems are creating friction</div>
            </div>

            {sigLoading ? (
              <div style={s.loadingState}><div style={s.spinner}/><span style={s.loadingText}>Loading signals…</span></div>
            ) : (
              <>
                {/* Stats */}
                <div style={s.statsGrid}>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{totalSearches}</div>
                    <div style={s.statLabel}>Total plays pulled</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{feedbackList.length}</div>
                    <div style={s.statLabel}>Policy flags</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statValue}>{anonFeedback.length}</div>
                    <div style={s.statLabel}>Anon feedback</div>
                  </div>
                </div>

                {/* Friction alerts */}
                {frictionAlerts.length > 0 && (
                  <div style={{marginBottom:24}}>
                    <div style={s.sectionLabel}>Friction Alerts</div>
                    {frictionAlerts.map(([cat,count])=>(
                      <div key={cat} style={{...s.alertCard,borderLeftColor:P.amber}}>
                        <div style={s.alertTitle}>High activity: {cat}</div>
                        <div style={s.alertSub}>{count} searches — may indicate unclear guidance in this area</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category breakdown */}
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={s.sectionLabel}>Policy Pulls by Category</div>
                    <button style={s.ghostSmallBtn} onClick={()=>{setSigFetched(false);loadSignals();}}>Refresh</button>
                  </div>
                  {catBreakdown.length === 0 ? (
                    <div style={{...s.card,textAlign:"center",padding:"32px 20px"}}>
                      <div style={{color:P.muted,fontSize:13}}>No data yet. Plays pulled will appear here.</div>
                    </div>
                  ) : (
                    <div style={s.card}>
                      {catBreakdown.map(([cat,count],i)=>{
                        const pct = Math.round((count/catBreakdown[0][1])*100);
                        return (
                          <div key={cat} style={{...(i>0?{marginTop:16,paddingTop:16,borderTop:`1px solid ${P.border}`}:{})}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{fontSize:14,fontWeight:600,color:P.text}}>{cat}</span>
                              <span style={{fontSize:13,color:P.muted,fontFamily:MONO}}>{count}</span>
                            </div>
                            <div style={{height:5,background:P.raise,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${pct}%`,background:P.blue,borderRadius:3,transition:"width 0.4s ease"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Anonymous feedback summary */}
                <div style={{marginBottom:24}}>
                  <div style={s.sectionLabel}>Anonymous Feedback</div>
                  {anonFeedback.length === 0 ? (
                    <div style={{...s.card,textAlign:"center",padding:"32px 20px"}}>
                      <div style={{color:P.muted,fontSize:13}}>No feedback submitted yet.</div>
                    </div>
                  ) : (
                    <>
                      {/* Type summary */}
                      <div style={{...s.card,marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:12}}>By type</div>
                        {Object.entries(anonByType).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
                          const ft = FB_TYPES.find(f=>f.id===type);
                          return (
                            <div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                              <span style={{fontSize:13,color:P.soft}}>{ft?.label||type}</span>
                              <span style={{fontSize:13,fontWeight:700,color:P.text,fontFamily:MONO}}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Recent entries */}
                      {anonFeedback.slice(0,10).map(fb=>(
                        <div key={fb.id} style={{...s.card,marginBottom:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                            <span style={s.badge(P.purple)}>{FB_TYPES.find(f=>f.id===fb.feedback_type)?.label||fb.feedback_type}</span>
                            <span style={{fontSize:11,color:P.muted,fontFamily:MONO}}>{fmtDate(fb.created_at)}</span>
                          </div>
                          {fb.category && <div style={{fontSize:12,color:P.soft,marginBottom:4}}>Area: {fb.category}</div>}
                          {fb.description && <div style={{fontSize:13,color:P.text,lineHeight:1.55}}>{fb.description}</div>}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Policy feedback */}
                {feedbackList.length > 0 && (
                  <div style={{marginBottom:24}}>
                    <div style={s.sectionLabel}>Policy Flags</div>
                    {feedbackList.map(fb=>(
                      <div key={fb.id} style={{...s.card,marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:13,fontWeight:700,color:P.text,flex:1}}>{fb.company_policies?.title||"Policy"}</div>
                          <span style={{fontSize:11,color:P.muted,fontFamily:MONO,flexShrink:0}}>{fmtDate(fb.created_at)}</span>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {(fb.flags||[]).map(flag=>(
                            <span key={flag} style={s.badge(P.borderMid)}>{flag}</span>
                          ))}
                        </div>
                        {fb.note && <div style={{marginTop:8,fontSize:13,color:P.soft,fontStyle:"italic"}}>"{fb.note}"</div>}
                        {fb.facility_number && <div style={{marginTop:6,fontSize:11,color:P.muted}}>Facility {fb.facility_number}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ANALYTICS TAB (admin only)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && isAdmin && (
          <div className="fade-in">
            <div style={s.pageHeader}>
              <div style={s.pageTitle}>Analytics</div>
              <div style={s.pageSubhead}>Full usage data and feedback</div>
            </div>

            {sigLoading ? (
              <div style={s.loadingState}><div style={s.spinner}/><span style={s.loadingText}>Loading…</span></div>
            ) : (
              <>
                <div style={s.statsGrid}>
                  <div style={s.statCard}><div style={s.statValue}>{totalSearches}</div><div style={s.statLabel}>Total plays</div></div>
                  <div style={s.statCard}><div style={s.statValue}>{catBreakdown.length}</div><div style={s.statLabel}>Categories</div></div>
                  <div style={s.statCard}><div style={s.statValue}>{feedbackList.length}</div><div style={s.statLabel}>Policy flags</div></div>
                </div>

                <div style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={s.sectionLabel}>Plays by Category</div>
                    <button style={s.ghostSmallBtn} onClick={()=>{setSigFetched(false);loadSignals();}}>Refresh</button>
                  </div>
                  <div style={s.card}>
                    {catBreakdown.length === 0
                      ? <div style={{color:P.muted,fontSize:13}}>No data yet.</div>
                      : catBreakdown.map(([cat,count],i)=>{
                          const pct=Math.round((count/catBreakdown[0][1])*100);
                          return(
                            <div key={cat} style={{...(i>0?{marginTop:14,paddingTop:14,borderTop:`1px solid ${P.border}`}:{})}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                                <span style={{fontSize:13,fontWeight:600,color:P.text}}>{cat}</span>
                                <span style={{fontSize:12,color:P.muted,fontFamily:MONO}}>{count}</span>
                              </div>
                              <div style={{height:5,background:P.raise,borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${pct}%`,background:P.blue,borderRadius:3}}/>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </div>

                <div style={{marginBottom:20}}>
                  <div style={s.sectionLabel}>Policy Feedback</div>
                  {feedbackList.length === 0
                    ? <div style={{...s.card,textAlign:"center",padding:"24px",color:P.muted,fontSize:13}}>No feedback yet.</div>
                    : feedbackList.map(fb=>(
                      <div key={fb.id} style={{...s.card,marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,gap:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:13,fontWeight:700,color:P.text}}>{fb.company_policies?.title||"Policy"}</div>
                          <span style={{fontSize:11,color:P.muted,fontFamily:MONO,flexShrink:0}}>{fmtDate(fb.created_at)}</span>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {(fb.flags||[]).map(f=><span key={f} style={s.badge(P.borderMid)}>{f}</span>)}
                        </div>
                        {fb.note && <div style={{marginTop:8,fontSize:13,color:P.soft,fontStyle:"italic"}}>"{fb.note}"</div>}
                      </div>
                    ))
                  }
                </div>

                <div style={{marginBottom:20}}>
                  <div style={s.sectionLabel}>Recent Plays</div>
                  <div style={s.card}>
                    {recentSearches.length === 0
                      ? <div style={{color:P.muted,fontSize:13}}>No searches yet.</div>
                      : recentSearches.map((sr,i)=>(
                        <div key={sr.id} style={{...(i>0?{marginTop:12,paddingTop:12,borderTop:`1px solid ${P.border}`}:{})}}>
                          <div style={{fontSize:13,color:P.text,marginBottom:3}}>{sr.situation_text}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            {sr.company_policies?.title && <span style={{fontSize:11,color:P.soft}}>→ {sr.company_policies.title}</span>}
                            {sr.company_policies?.category && <span style={s.badge(P.borderMid)}>{sr.company_policies.category}</span>}
                            <span style={{fontSize:11,color:P.muted,marginLeft:"auto",fontFamily:MONO}}>{timeAgo(sr.created_at)}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV (mobile) ──────────────────────────────────────────── */}
      {isMobile && (
        <nav style={s.bottomNav}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{...s.bottomNavItem,...(activeTab===t.id?s.bottomNavItemActive:{})}}>
              <NavIcon name={t.icon} active={activeTab===t.id}/>
              <span style={{...s.bottomNavLabel,...(activeTab===t.id?{color:P.blue}:{})}}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── POLICY FEEDBACK MODAL ─────────────────────────────────────────── */}
      {showPolicyFeedback && (
        <div style={s.overlay} onClick={closePolicyFeedback}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            {policyFbDone ? (
              <div style={{textAlign:"center",padding:"8px 0 16px"}}>
                <div style={{...s.successIcon,margin:"0 auto 12px"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{fontSize:16,fontWeight:700,color:P.text,marginBottom:8}}>Thanks for flagging that</div>
                <div style={{fontSize:13,color:P.soft,lineHeight:1.55,marginBottom:20}}>Your feedback helps improve policies for everyone.</div>
                <button style={s.primaryBtn} onClick={closePolicyFeedback}>Done</button>
              </div>
            ) : (
              <>
                <div style={s.modalTitle}>Flag Policy</div>
                <div style={{fontSize:13,color:P.soft,marginBottom:16,lineHeight:1.5}}>{result?.title}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {POLICY_FLAGS.map(flag=>(
                    <button key={flag} onClick={()=>togglePolicyFlag(flag)}
                      style={{...s.fbTypeBtn,...(policyFlags.includes(flag)?{...s.fbTypeBtnActive,borderColor:P.blue,color:P.text}:{})}}>
                      {policyFlags.includes(flag)?"✓  ":""}{flag}
                    </button>
                  ))}
                </div>
                <label style={s.fieldLabel}>
                  Optional note <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(max 280 chars)</span>
                </label>
                <textarea value={policyFeedbackNote} onChange={e=>setPolicyFeedbackNote(e.target.value.slice(0,280))}
                  placeholder="Any context…" style={{...s.textInput,minHeight:72,resize:"vertical",marginBottom:4,lineHeight:1.65}}/>
                <div style={{fontSize:10,color:P.muted,textAlign:"right",marginBottom:16}}>{policyFeedbackNote.length}/280</div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...s.primaryBtn,flex:1,...(!policyFlags.length||policyFbSubmitting?{opacity:0.45,pointerEvents:"none"}:{})}}
                    onClick={submitPolicyFeedback} disabled={!policyFlags.length||policyFbSubmitting}>
                    {policyFbSubmitting?"Submitting…":"Submit"}
                  </button>
                  <button style={s.outlineBtn} onClick={closePolicyFeedback}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      {!isMobile && (
        <footer style={s.footer}>
          <a href="/support" style={s.footerLink}>Contact Support</a>
          <span style={s.footerBrand}>Operator Support Systems</span>
        </footer>
      )}
    </div>
  );
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .fade-in           { animation: fadeIn 0.18s ease both; }
  .nav-btn:hover     { color: #EDF1F5 !important; }
  .ghost-btn:hover   { background: rgba(255,255,255,0.05) !important; }
  .list-row:hover    { border-color: #3A5168 !important; background: rgba(74,130,176,0.05) !important; }
  .proc-header:hover { background: rgba(255,255,255,0.02) !important; }
  .fb-type-btn:hover { border-color: #3A5168 !important; }
  textarea:focus, input:focus, select:focus {
    border-color: rgba(74,130,176,0.55) !important;
    box-shadow: 0 0 0 3px rgba(74,130,176,0.10) !important;
    outline: none !important;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #22303F; border-radius: 4px; }
  button { font-family: inherit; }
  a { -webkit-tap-highlight-color: transparent; }
  button { -webkit-tap-highlight-color: transparent; cursor: pointer; }
`;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  shell:  { minHeight:"100vh", background:P.bg, color:P.text, fontFamily:SANS },

  // Top bar
  topBar:       { background:P.surface, borderBottom:`1px solid ${P.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 0 rgba(0,0,0,0.4)" },
  topBarInner:  { maxWidth:900, margin:"0 auto", display:"flex", alignItems:"center", height:52, paddingLeft:16, paddingRight:16, gap:16 },
  brand:        { display:"flex", alignItems:"center", gap:8, flexShrink:0 },
  brandDot:     { width:8, height:8, borderRadius:"50%", background:P.blue, boxShadow:`0 0 8px ${P.blue}`, display:"inline-block" },
  brandName:    { fontWeight:700, fontSize:15, color:P.text, letterSpacing:"-0.01em" },
  proBadge:     { fontSize:9, fontWeight:800, color:P.blue, background:P.blueDim, border:`1px solid rgba(74,130,176,0.30)`, borderRadius:3, padding:"2px 6px", letterSpacing:"0.08em" },
  desktopNav:   { display:"flex", alignItems:"stretch", flex:1, height:52, overflowX:"auto" },
  desktopNavBtn:{ border:"none", borderBottom:"2px solid transparent", borderTop:"2px solid transparent", background:"transparent", color:P.muted, padding:"0 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", letterSpacing:"0.04em", textTransform:"uppercase", display:"flex", alignItems:"center", transition:"color 0.15s ease" },
  desktopNavBtnActive: { borderBottom:`2px solid ${P.blue}`, color:P.text },
  topBarRight:  { display:"flex", alignItems:"center", gap:10, marginLeft:"auto", flexShrink:0 },
  mobileUser:   { fontSize:11, color:P.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" },
  signOutBtn:   { border:`1px solid ${P.border}`, background:"transparent", color:P.muted, borderRadius:5, padding:"6px 12px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", transition:"background 0.15s" },

  // Main
  main: { maxWidth:860, margin:"0 auto", padding:"24px 16px 40px", display:"flex", flexDirection:"column", gap:0 },

  // Page header
  pageHeader:  { marginBottom:24 },
  pageGreeting:{ fontSize:22, fontWeight:700, color:P.text, letterSpacing:"-0.02em", marginBottom:4, lineHeight:1.2 },
  pageTitle:   { fontSize:22, fontWeight:700, color:P.text, letterSpacing:"-0.02em", marginBottom:4 },
  pageSubhead: { fontSize:14, color:P.soft, lineHeight:1.55 },

  // Bottom nav
  bottomNav:          { position:"fixed", bottom:0, left:0, right:0, height:60, background:P.surface, borderTop:`1px solid ${P.border}`, display:"flex", alignItems:"stretch", zIndex:100, boxShadow:"0 -1px 0 rgba(0,0,0,0.5)" },
  bottomNavItem:      { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, border:"none", background:"transparent", padding:"6px 0", minWidth:0, transition:"background 0.15s" },
  bottomNavItemActive:{ background:`rgba(74,130,176,0.07)` },
  bottomNavLabel:     { fontSize:10, fontWeight:600, color:P.muted, letterSpacing:"0.04em", textTransform:"uppercase" },

  // Home screen
  homeGrid:       { display:"flex", flexDirection:"column", gap:12 },
  homeHeroCard:   { width:"100%", background:P.raise, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.blue}`, borderRadius:10, padding:"22px 20px", textAlign:"left", cursor:"pointer", position:"relative", boxShadow:"0 4px 16px rgba(0,0,0,0.3)" },
  homeHeroIcon:   { marginBottom:14, display:"inline-flex", padding:"10px", background:P.blueDim, borderRadius:8 },
  homeHeroTitle:  { fontSize:18, fontWeight:700, color:P.text, marginBottom:4, letterSpacing:"-0.01em" },
  homeHeroSub:    { fontSize:13, color:P.soft, lineHeight:1.5 },
  homeHeroArrow:  { position:"absolute", right:20, top:"50%", transform:"translateY(-50%)", fontSize:18, color:P.blue, fontWeight:700 },
  homeCard:       { width:"100%", background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 18px", textAlign:"left", cursor:"pointer" },
  homeCardIcon:   { width:40, height:40, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  homeCardTitle:  { fontSize:15, fontWeight:700, color:P.text, marginBottom:2 },
  homeCardSub:    { fontSize:13, color:P.soft },
  homeSmallCard:  { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer", minHeight:80, justifyContent:"center" },
  homeSmallTitle: { fontSize:12, fontWeight:700, color:P.soft, textTransform:"uppercase", letterSpacing:"0.06em" },
  homeSectionWrap:{ marginTop:4 },
  homeSectionLabel:{ fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8, paddingLeft:2 },

  // Stat cards
  statsGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:20 },
  statCard:  { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 14px", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" },
  statValue: { fontSize:28, fontWeight:700, color:P.text, fontFamily:MONO, letterSpacing:"-0.03em", lineHeight:1 },
  statLabel: { fontSize:11, fontWeight:600, color:P.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:6 },

  // Alert cards
  alertCard:  { background:P.surface, border:`1px solid ${P.border}`, borderLeft:`3px solid ${P.amber}`, borderRadius:8, padding:"14px 16px", marginBottom:8 },
  alertTitle: { fontSize:14, fontWeight:700, color:P.text, marginBottom:3 },
  alertSub:   { fontSize:12, color:P.soft, lineHeight:1.5 },

  // Section labels
  sectionLabel:     { fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12, paddingLeft:4, borderLeft:`2px solid ${P.borderHigh}` },
  sectionMiniLabel: { fontSize:10, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8, paddingLeft:2 },

  // Cards
  card: { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 18px" },
  cardSection: { marginBottom:20 },

  // Recent rows
  recentRow:     { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"transparent", border:`1px solid ${P.border}`, borderRadius:8, padding:"12px 14px", textAlign:"left", marginBottom:6, transition:"border-color 0.12s,background 0.12s" },
  recentRowText: { fontSize:13, color:P.soft, flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  recentRowTime: { fontSize:11, color:P.muted, fontFamily:MONO, flexShrink:0 },

  // Search
  searchForm:     { display:"flex", flexDirection:"column", gap:12, marginBottom:28 },
  searchTextarea: { width:"100%", minHeight:120, background:P.raise, border:`1px solid ${P.borderMid}`, borderTop:`1px solid ${P.borderHigh}`, borderRadius:10, color:P.text, padding:"16px 18px", fontSize:15, lineHeight:1.65, resize:"vertical", outline:"none", fontFamily:SANS, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.025)" },
  searchSubmitBtn:{ width:"100%", minHeight:52, background:P.blue, border:`1px solid ${P.blue}`, color:"#fff", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em", boxShadow:"0 4px 14px rgba(74,130,176,0.30)", transition:"opacity 0.15s" },
  recentSection:     { marginBottom:24 },
  recentSectionLabel:{ fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8, paddingLeft:2 },
  recentChip:        { width:"100%", display:"flex", alignItems:"center", gap:10, background:"transparent", border:`1px solid ${P.border}`, borderRadius:8, padding:"12px 14px", textAlign:"left", marginBottom:6, transition:"border-color 0.12s,background 0.12s" },
  recentChipText:    { fontSize:13, color:P.soft, flex:1 },

  // Loading / empty
  loadingState: { display:"flex", alignItems:"center", gap:12, padding:"60px 0", justifyContent:"center" },
  spinner:      { width:24, height:24, border:`2px solid ${P.borderMid}`, borderTopColor:P.blue, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 },
  loadingText:  { fontSize:13, color:P.soft },
  emptyState:   { display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"60px 20px", textAlign:"center" },
  emptyIcon:    { width:56, height:56, borderRadius:12, background:P.raise, border:`1px solid ${P.border}`, display:"flex", alignItems:"center", justifyContent:"center" },
  emptyTitle:   { fontSize:17, fontWeight:700, color:P.text },
  emptyBody:    { fontSize:13, color:P.soft, lineHeight:1.6, maxWidth:280 },

  // Result view
  resultActionBar:  { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, gap:12 },
  backTextBtn:      { display:"flex", alignItems:"center", gap:4, background:"transparent", border:"none", color:P.blue, fontSize:14, fontWeight:600, padding:0, cursor:"pointer" },
  chipBtn:          { border:`1px solid ${P.border}`, background:"transparent", color:P.soft, borderRadius:6, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", letterSpacing:"0.02em" },
  chipBtnSaved:     { border:`1px solid rgba(181,144,78,0.4)`, color:P.amber, background:P.amberDim },
  situationEcho:    { background:P.raise, border:`1px solid ${P.border}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:P.soft, lineHeight:1.55, marginBottom:12 },
  resultCard:       { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"18px", marginBottom:10, boxShadow:"0 2px 8px rgba(0,0,0,0.2)" },
  resultCardLabel:  { fontSize:10, fontWeight:800, color:P.muted, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:12, paddingLeft:8, borderLeft:`2px solid ${P.borderHigh}` },
  resultCardBody:   { fontSize:14, lineHeight:1.8, color:P.text, whiteSpace:"pre-wrap" },
  policyName:       { fontSize:16, fontWeight:700, color:P.text, marginBottom:2 },
  altPolicyRow:     { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"transparent", border:`1px solid ${P.border}`, borderRadius:8, padding:"12px 14px", textAlign:"left", marginBottom:6, cursor:"pointer", transition:"border-color 0.12s,background 0.12s" },
  searchAgainWrap:  { marginTop:20, paddingTop:16, borderTop:`1px solid ${P.border}` },
  inlineSearchInput:{ flex:1, height:48, background:P.raise, border:`1px solid ${P.borderMid}`, borderRadius:8, color:P.text, padding:"0 14px", fontSize:14, outline:"none", fontFamily:SANS },
  inlineSearchBtn:  { width:48, height:48, background:P.blue, border:"none", borderRadius:8, color:"#fff", fontSize:18, fontWeight:700, cursor:"pointer", flexShrink:0 },

  // Procedures
  catGroupLabel: { fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", paddingLeft:4, borderLeft:`2px solid ${P.borderHigh}`, marginBottom:10 },
  procCard:      { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, marginBottom:8, overflow:"hidden" },
  procHeader:    { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:"transparent", border:"none", padding:"16px 18px", textAlign:"left", transition:"background 0.12s" },
  procTitle:     { fontSize:15, fontWeight:700, color:P.text, marginBottom:2 },
  procSummaryLine:{ fontSize:12, color:P.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"90%" },
  procBody:      { padding:"0 18px 18px", borderTop:`1px solid ${P.border}` },
  procStepLabel: { fontSize:10, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10, marginTop:16 },
  procSteps:     { fontSize:14, color:P.text, lineHeight:1.8, whiteSpace:"pre-wrap" },

  // Feedback form
  fbTypeGrid:    { display:"flex", flexDirection:"column", gap:8 },
  fbTypeBtn:     { width:"100%", background:"transparent", border:`1px solid ${P.border}`, borderRadius:8, padding:"13px 16px", textAlign:"left", fontSize:14, color:P.soft, transition:"border-color 0.12s" },
  fbTypeBtnActive:{ background:P.raise, color:P.text },
  fieldLabel:    { display:"block", fontSize:11, fontWeight:700, color:P.soft, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 },
  textInput:     { width:"100%", minHeight:48, background:P.raise, border:`1px solid ${P.borderMid}`, borderRadius:8, color:P.text, padding:"13px 16px", fontSize:14, outline:"none", fontFamily:SANS, display:"block" },
  errorBox:      { background:P.redDim, border:`1px solid rgba(168,88,88,0.30)`, borderRadius:8, padding:"12px 16px", fontSize:13, color:P.red, marginBottom:16, lineHeight:1.5 },

  // Buttons
  primaryBtn:  { width:"100%", minHeight:52, background:P.blue, border:`1px solid ${P.blue}`, color:"#fff", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em", display:"block", boxShadow:"0 4px 14px rgba(74,130,176,0.25)" },
  outlineBtn:  { background:"transparent", border:`1px solid ${P.border}`, color:P.soft, borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer", minHeight:44 },
  ghostSmallBtn:{ background:"transparent", border:`1px solid ${P.border}`, color:P.muted, borderRadius:6, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.06em" },

  // Success
  successCard:  { background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:"32px 24px", textAlign:"center" },
  successIcon:  { width:56, height:56, background:P.greenDim, border:`1px solid rgba(94,158,114,0.3)`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" },
  successTitle: { fontSize:18, fontWeight:700, color:P.text, marginBottom:8 },
  successBody:  { fontSize:14, color:P.soft, lineHeight:1.6, marginBottom:24 },

  // Badge helper — call as s.badge(color)
  badge: (c) => ({ display:"inline-flex", alignItems:"center", padding:"3px 8px", borderRadius:4, fontSize:11, fontWeight:600, background:`${c}22`, border:`1px solid ${c}55`, color:c, letterSpacing:"0.04em" }),

  // Section category
  catGroupSection: { marginBottom:24 },

  // Modal
  overlay:    { position:"fixed", inset:0, zIndex:200, background:"rgba(9,14,20,0.85)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0", boxSizing:"border-box" },
  modal:      { background:P.surface, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.borderHigh}`, borderRadius:"16px 16px 0 0", padding:"24px 20px 36px", width:"100%", maxWidth:540, boxShadow:"0 -8px 40px rgba(0,0,0,0.6)", maxHeight:"90vh", overflowY:"auto" },
  modalTitle: { fontSize:18, fontWeight:700, color:P.text, marginBottom:4 },

  // Footer
  footer:      { borderTop:`1px solid ${P.border}`, padding:"16px 20px", textAlign:"center", marginTop:16 },
  footerLink:  { fontSize:11, color:P.muted, textDecoration:"none", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginRight:20 },
  footerBrand: { fontSize:11, color:P.muted, letterSpacing:"0.04em" },
};
