import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const P = {
  pageBg:    "#F6F4FA",
  surface:   "#FFFFFF",
  surfaceSub:"#FAF9FD",
  border:    "#E5E0F0",
  borderMid: "#CFC8E8",
  borderHigh:"#A99AC8",
  text:      "#1C1830",
  soft:      "#5C5278",
  muted:     "#9589AE",
  purple:    "#6B5EA8",
  purpleMid: "#7B6BBB",
  purpleDeep:"#4E4280",
  purpleDim: "rgba(107,94,168,0.10)",
  purpleGlow:"rgba(107,94,168,0.05)",
  green:     "#2E7D52",
  greenDim:  "rgba(46,125,82,0.09)",
  amber:     "#8A5E10",
  amberDim:  "rgba(138,94,16,0.09)",
  red:       "#8A2E2E",
  redDim:    "rgba(138,46,46,0.08)",
};
const SANS     = "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif";
const MONO     = '"JetBrains Mono","SF Mono",ui-monospace,monospace';
const BTN_GRAD = "linear-gradient(135deg, #7B6BBB 0%, #5A4D94 100%)";

// ─── ROLES ────────────────────────────────────────────────────────────────────
const RANK = { user:0, manager:1, admin:99 };
const atLeast = (role, min) => (RANK[role]??0) >= (RANK[min]??0);
const ROLE_LABELS = { user:"User", manager:"Manager", admin:"Admin" };

// ─── FEEDBACK TYPES ───────────────────────────────────────────────────────────
const FB_TYPES = [
  { id:"policy_unclear",      label:"Policy unclear"       },
  { id:"process_unrealistic", label:"Process unrealistic"  },
  { id:"hard_to_follow",      label:"Hard to follow"       },
  { id:"training_gap",        label:"Training gap"         },
  { id:"missing_guidance",    label:"Missing guidance"     },
  { id:"other",               label:"Other"                },
];

const POLICY_FLAGS = [
  "Hard to understand",
  "Not specific enough",
  "Did not match situation",
  "Missing escalation guidance",
  "Could not find answer fast enough",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = v => UUID_RE.test(v) ? v : null;

function applyScope(q, profile) {
  const cid = safeUuid(profile?.company_id);
  if (cid) return q.eq("company_id", cid);
  if (profile?.company) return q.eq("company", profile.company);
  return q;
}

function buildFacilityContext(profile) {
  const fac = profile?.facility_number;
  const co  = profile?.company;
  if (fac && co)  return `Facility ${fac}: ${co}`;
  if (fac)        return `Facility ${fac}`;
  if (co)         return co;
  return ROLE_LABELS[profile?.role] || profile?.role || "";
}

function timeAgo(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ─── MATCH REASON ─────────────────────────────────────────────────────────────
function getMatchReason(policy, term) {
  if (!term) return "Relevant to your situation";
  const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const hit   = (val) => val && words.some(w => val.toLowerCase().includes(w));
  if (hit(policy.title))       return "Policy title matches your scenario";
  if (hit(policy.keywords))    return "Tagged with keywords from your search";
  if (hit(policy.category))    return `Covers "${policy.category}" situations`;
  if (hit(policy.summary))     return "Policy summary addresses this scenario";
  if (hit(policy.policy_text)) return "Policy content is relevant";
  return "Broadly relevant to your situation";
}

function getRelevanceLabel(index) {
  if (index === 0) return "Best Match";
  if (index <= 2)  return "Strong Match";
  return "Related";
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function buildTabs(role) {
  if (role === "admin") return [
    { id:"home",       label:"Dashboard", icon:"analytics" },
    { id:"ask",        label:"Ask",       icon:"ask"       },
    { id:"jack",       label:"Jack AI",   icon:"jack"      },
    { id:"procedures", label:"Guides",    icon:"guides"    },
    { id:"feedback",   label:"Feedback",  icon:"feedback"  },
  ];
  if (role === "manager") return [
    { id:"home",       label:"Home",     icon:"home"     },
    { id:"ask",        label:"Ask",      icon:"ask"      },
    { id:"jack",       label:"Jack AI",  icon:"jack"     },
    { id:"procedures", label:"Guides",   icon:"guides"   },
    { id:"feedback",   label:"Feedback", icon:"feedback" },
  ];
  // user
  return [
    { id:"home",       label:"Home",     icon:"home"     },
    { id:"ask",        label:"Ask",      icon:"ask"      },
    { id:"procedures", label:"Guides",   icon:"guides"   },
    { id:"feedback",   label:"Feedback", icon:"feedback" },
  ];
}

// ─── NAV ICONS ────────────────────────────────────────────────────────────────
function NavIcon({ name, active }) {
  const c = active ? P.purple : P.muted;
  const w = 20, sw = "1.8";
  const icons = {
    home:      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
    ask:       <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    jack:      <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a4 4 0 018 0v2"/><circle cx="8.5" cy="14" r="1" fill={c}/><circle cx="15.5" cy="14" r="1" fill={c}/><path d="M9.5 17.5h5"/></svg>,
    guides:    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
    feedback:  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    signals:   <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    analytics: <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  };
  return icons[name] || null;
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="18" rx="2" fill={P.purple} opacity="0.15"/>
      <rect x="3" y="2" width="14" height="18" rx="2" stroke={P.purple} strokeWidth="1.6"/>
      <path d="M7 7h6M7 11h6M7 15h4" stroke={P.purple} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="18" cy="17" r="4" fill={P.purpleDim} stroke={P.purple} strokeWidth="1.4"/>
      <path d="M18 15v4M16 17h4" stroke={P.purple} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

// ─── PDF ICON ─────────────────────────────────────────────────────────────────
function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PlaybookApp() {
  const router = useRouter();

  const [profile,     setProfile]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab,   setActiveTab]   = useState("home");
  const [isMobile,    setIsMobile]    = useState(false);

  // ── Ask / Search
  const [query,             setQuery]             = useState("");
  const [searching,         setSearching]         = useState(false);
  const [results,           setResults]           = useState([]);
  const [selectedPolicy,    setSelectedPolicy]    = useState(null);
  const [policyRefs,        setPolicyRefs]        = useState([]);
  const [policyRefsLoading, setPolicyRefsLoading] = useState(false);
  const [noResult,          setNoResult]          = useState(false);
  const [searchId,          setSearchId]          = useState(null);
  const [isSaved,           setIsSaved]           = useState(false);
  const [recents,           setRecents]           = useState([]);
  const [savedPlays,        setSavedPlays]        = useState([]);

  // ── Helpful feedback (per policy view)
  const [helpfulChoice,   setHelpfulChoice]   = useState(null);  // null | true | false
  const [helpfulSaving,   setHelpfulSaving]   = useState(false);
  const [helpfulSaved,    setHelpfulSaved]    = useState(false);
  const [helpfulFbRowId,  setHelpfulFbRowId]  = useState(null);  // existing row to update

  // ── Policy flag modal
  const [showPolicyFeedback, setShowPolicyFeedback] = useState(false);
  const [policyFlags,        setPolicyFlags]        = useState([]);
  const [policyFeedbackNote, setPolicyFeedbackNote] = useState("");
  const [policyFbSubmitting, setPolicyFbSubmitting] = useState(false);
  const [policyFbDone,       setPolicyFbDone]       = useState(false);

  // ── Procedures
  const [procedures,   setProcedures]   = useState([]);
  const [procsLoading, setProcsLoading] = useState(false);
  const [procsFetched, setProcsFetched] = useState(false);
  const [expandedProc, setExpandedProc] = useState(null);
  const [procSearch,   setProcSearch]   = useState("");

  // ── Anonymous feedback
  const [fbType,        setFbType]        = useState("");
  const [fbCategory,    setFbCategory]    = useState("");
  const [fbDescription, setFbDescription] = useState("");
  const [fbSubmitting,  setFbSubmitting]  = useState(false);
  const [fbDone,        setFbDone]        = useState(false);
  const [fbError,       setFbError]       = useState("");

  // ── Signals
  const [sigLoading,     setSigLoading]     = useState(false);
  const [sigFetched,     setSigFetched]     = useState(false);
  const [totalSearches,  setTotalSearches]  = useState(0);
  const [catBreakdown,   setCatBreakdown]   = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [feedbackList,   setFeedbackList]   = useState([]);
  const [anonFeedback,   setAnonFeedback]   = useState([]);

  // ── Helpfulness analytics (admin)
  const [helpStats,        setHelpStats]        = useState(null);
  const [helpStatsLoading, setHelpStatsLoading] = useState(false);
  const [helpStatsFetched, setHelpStatsFetched] = useState(false);

  // ── Jack AI
  const [jackMessages, setJackMessages] = useState([
    { role:"assistant", content:"Hey, I'm Jack. Describe the situation and I'll help you handle it." }
  ]);
  const [jackInput,   setJackInput]   = useState("");
  const [jackLoading, setJackLoading] = useState(false);

  const queryRef  = useRef(null);
  const jackEndRef = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    (async () => {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: prof } = await supabase.from("profiles")
        .select("id,full_name,facility_number,company,company_id,role,plan")
        .eq("id", user.id).maybeSingle();
      if (!prof) { router.replace("/"); return; }
      if (live) { setProfile(prof); setAuthLoading(false); }
    })();
    return () => { live = false; };
  }, [router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { if (profile) loadRecents(); }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (activeTab === "procedures" && !procsFetched) loadProcedures();
    if (activeTab === "signals" && !sigFetched) loadSignals();
    if (activeTab === "home" && profile.role === "admin") {
      if (!sigFetched) loadSignals();
      if (!helpStatsFetched) loadHelpStats();
    }
  }, [activeTab, profile]);

  // Reset helpful feedback state whenever a new policy is selected
  useEffect(() => {
    setHelpfulChoice(null);
    setHelpfulSaved(false);
    setHelpfulFbRowId(null);
  }, [selectedPolicy?.id]);

  const role      = profile?.role || "user";
  const isManager = role === "manager" || role === "admin";
  const isAdmin   = role === "admin";
  const tabs      = profile ? buildTabs(role) : [];

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadRecents = async () => {
    try {
      const { data } = await supabase.from("playbook_searches")
        .select("id,situation_text,policy_id,saved,created_at")
        .eq("user_id", profile.id).order("created_at",{ascending:false}).limit(20);
      const all = data || [];
      setRecents(all.filter(r=>!r.saved).slice(0,6));
      setSavedPlays(all.filter(r=>r.saved));
    } catch {}
  };

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

  const loadSignals = async () => {
    setSigLoading(true);
    try {
      let sq = supabase.from("playbook_searches")
        .select("id,situation_text,created_at,policy_id,company_policies(title,category)")
        .order("created_at",{ascending:false}).limit(500);
      sq = applyScope(sq, profile);
      const { data: searches } = await sq;
      const allS = searches || [];
      setTotalSearches(allS.length);
      setRecentSearches(allS.slice(0,30));
      const catMap = {};
      allS.forEach(s => { const cat = s.company_policies?.category||"Uncategorized"; catMap[cat]=(catMap[cat]||0)+1; });
      setCatBreakdown(Object.entries(catMap).sort((a,b)=>b[1]-a[1]));

      let fq = supabase.from("policy_feedback")
        .select("id,flags,note,created_at,facility_number,policy_id,company_policies(title)")
        .order("created_at",{ascending:false}).limit(100);
      fq = applyScope(fq, profile);
      const { data: fb } = await fq;
      setFeedbackList(fb||[]);

      let aq = supabase.from("anonymous_feedback")
        .select("id,feedback_type,category,description,created_at,facility_number")
        .order("created_at",{ascending:false}).limit(100);
      aq = applyScope(aq, profile);
      const { data: af } = await aq;
      setAnonFeedback(af||[]);
    } catch (err) { console.warn("signals:", err.message); }
    setSigLoading(false); setSigFetched(true);
  };

  const loadHelpStats = async () => {
    setHelpStatsLoading(true);
    try {
      let q = supabase.from("policy_helpfulness_feedback")
        .select("id,policy_id,policy_title,helpful,created_at,facility_number,user_id");
      q = applyScope(q, profile);
      const { data } = await q.limit(1000);
      const all = data || [];

      const positiveCount = all.filter(r => r.helpful).length;
      const negativeCount = all.filter(r => !r.helpful).length;

      // Group by policy_title for rankings
      const pMap = {};
      all.forEach(r => {
        if (!pMap[r.policy_title]) pMap[r.policy_title] = { title:r.policy_title, id:r.policy_id, helpful:0, not:0 };
        if (r.helpful) pMap[r.policy_title].helpful++;
        else           pMap[r.policy_title].not++;
      });
      const pList = Object.values(pMap).map(p => ({
        ...p, total: p.helpful + p.not,
        score: p.helpful / (p.helpful + p.not),
      })).filter(p => p.total >= 1);

      setHelpStats({
        total:       all.length,
        positive:    positiveCount,
        negative:    negativeCount,
        mostHelpful: pList.sort((a,b)=>b.score-a.score||b.total-a.total).slice(0,5),
        leastHelpful:pList.sort((a,b)=>a.score-b.score||b.total-a.total).slice(0,5),
        recent:      [...all].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10),
      });
    } catch (err) { console.warn("help stats:", err.message); }
    setHelpStatsLoading(false); setHelpStatsFetched(true);
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const doSearch = async (term) => {
    if (!term.trim()) return;
    setSearching(true);
    setNoResult(false); setResults([]); setSelectedPolicy(null);
    setPolicyRefs([]); setSearchId(null); setIsSaved(false);

    try {
      let q = supabase.from("company_policies")
        .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
        .eq("is_active", true);
      q = applyScope(q, profile);
      q = q.or(`title.ilike.%${term}%,policy_text.ilike.%${term}%,keywords.ilike.%${term}%,summary.ilike.%${term}%,category.ilike.%${term}%`);
      const { data: primary } = await q.limit(8);
      let hits = primary || [];

      if (!hits.length) {
        for (const w of term.split(/\s+/).filter(w=>w.length>3).slice(0,5)) {
          let wq = supabase.from("company_policies")
            .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
            .eq("is_active",true);
          wq = applyScope(wq, profile);
          wq = wq.or(`title.ilike.%${w}%,keywords.ilike.%${w}%,summary.ilike.%${w}%,category.ilike.%${w}%`);
          const { data: wr } = await wq.limit(6);
          if (wr?.length) { hits = wr; break; }
        }
      }

      if (!hits.length) {
        setNoResult(true);
      } else {
        setResults(hits);
        try {
          const { data: logged } = await supabase.from("playbook_searches")
            .insert({ user_id:profile.id, facility_number:profile.facility_number||null, company_id:safeUuid(profile.company_id), situation_text:term, policy_id:hits[0].id, saved:false })
            .select("id").single();
          if (logged?.id) { setSearchId(logged.id); loadRecents(); }
        } catch {}
      }
    } finally { setSearching(false); }
  };

  // ── Select policy ──────────────────────────────────────────────────────────
  const selectPolicy = async (policy) => {
    setSelectedPolicy(policy);
    setPolicyRefs([]); setPolicyRefsLoading(true);
    try {
      const { data: refs } = await supabase.from("policy_references")
        .select("id,file_name,file_url,description,created_at")
        .eq("policy_id", String(policy.id)).order("created_at",{ascending:true});
      setPolicyRefs(refs||[]);
    } catch { setPolicyRefs([]); }
    setPolicyRefsLoading(false);
  };

  const handleSearch  = e => { e?.preventDefault(); doSearch(query.trim()); };
  const clearSearch   = () => {
    setResults([]); setSelectedPolicy(null); setPolicyRefs([]);
    setNoResult(false); setQuery(""); setSearchId(null); setIsSaved(false);
    setTimeout(() => queryRef.current?.focus(), 50);
  };
  const backToResults = () => { setSelectedPolicy(null); setPolicyRefs([]); };

  const reopenRecent = async (r) => {
    setQuery(r.situation_text);
    if (r.policy_id) {
      setSearching(true); setResults([]); setSelectedPolicy(null); setPolicyRefs([]);
      try {
        const { data } = await supabase.from("company_policies")
          .select("id,title,policy_code,category,severity,summary,policy_text,action_steps,escalation_guidance,incorrect_examples,keywords")
          .eq("id",r.policy_id).maybeSingle();
        if (data) { setResults([data]); setSearchId(r.id); setIsSaved(r.saved||false); await selectPolicy(data); }
        else await doSearch(r.situation_text);
      } finally { setSearching(false); }
    } else { await doSearch(r.situation_text); }
  };

  const handleSave = async () => {
    if (!searchId) return;
    try { await supabase.from("playbook_searches").update({saved:!isSaved}).eq("id",searchId); setIsSaved(!isSaved); loadRecents(); } catch {}
  };

  // ── Helpful feedback ──────────────────────────────────────────────────────
  const submitHelpfulFeedback = async (isHelpful) => {
    if (helpfulSaving) return;
    setHelpfulSaving(true);
    setHelpfulChoice(isHelpful);
    try {
      if (helpfulFbRowId) {
        // Update existing row if user changes their mind
        await supabase.from("policy_helpfulness_feedback")
          .update({ helpful: isHelpful, updated_at: new Date().toISOString() })
          .eq("id", helpfulFbRowId);
      } else {
        // Check for existing row this session (same user + policy)
        const { data: existing } = await supabase.from("policy_helpfulness_feedback")
          .select("id")
          .eq("user_id", profile.id)
          .eq("policy_id", String(selectedPolicy.id))
          .order("created_at",{ascending:false})
          .limit(1).maybeSingle();

        if (existing) {
          setHelpfulFbRowId(existing.id);
          await supabase.from("policy_helpfulness_feedback")
            .update({ helpful: isHelpful, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          const { data: inserted } = await supabase.from("policy_helpfulness_feedback")
            .insert({
              user_id:         profile.id,
              company_id:      safeUuid(profile.company_id),
              facility_number: profile.facility_number || null,
              policy_id:       String(selectedPolicy.id),
              policy_title:    selectedPolicy.title,
              helpful:         isHelpful,
            }).select("id").single();
          if (inserted?.id) setHelpfulFbRowId(inserted.id);
        }
      }
      setHelpfulSaved(true);
    } catch (err) { console.warn("helpful feedback:", err.message); }
    setHelpfulSaving(false);
  };

  // ── Policy flag modal ─────────────────────────────────────────────────────
  const togglePolicyFlag     = f => setPolicyFlags(p => p.includes(f) ? p.filter(x=>x!==f) : [...p,f]);
  const submitPolicyFeedback = async () => {
    if (!policyFlags.length) return;
    setPolicyFbSubmitting(true);
    try { await supabase.from("policy_feedback").insert({ user_id:profile.id, policy_id:selectedPolicy?.id||null, facility_number:profile.facility_number||null, company_id:safeUuid(profile.company_id), flags:policyFlags, note:policyFeedbackNote.trim()||null }); } catch {}
    setPolicyFbDone(true); setPolicyFbSubmitting(false);
  };
  const closePolicyFeedback = () => { setShowPolicyFeedback(false); setPolicyFlags([]); setPolicyFeedbackNote(""); setPolicyFbDone(false); };

  // ── Jack AI ───────────────────────────────────────────────────────────────
  useEffect(() => {
    jackEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [jackMessages]);

  const sendJackMessage = async () => {
    const text = jackInput.trim();
    if (!text || jackLoading) return;
    const updated = [...jackMessages, { role:"user", content:text }];
    setJackMessages(updated);
    setJackInput("");
    setJackLoading(true);
    try {
      const res  = await fetch("/api/jack", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setJackMessages(prev => [...prev, { role:"assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setJackMessages(prev => [...prev, { role:"assistant", content:"Something went wrong. Please try again." }]);
    }
    setJackLoading(false);
  };

  // ── Anon feedback ─────────────────────────────────────────────────────────
  const submitAnonFeedback = async () => {
    if (!fbType) { setFbError("Please select a feedback type."); return; }
    setFbSubmitting(true); setFbError("");
    try {
      await supabase.from("anonymous_feedback").insert({ company_id:safeUuid(profile.company_id)||null, company:profile.company||null, facility_number:profile.facility_number||null, feedback_type:fbType, category:fbCategory.trim()||null, description:fbDescription.trim()||null });
      setFbDone(true);
    } catch { setFbError("Submission failed. Please try again."); }
    setFbSubmitting(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const anonByType = anonFeedback.reduce((acc,f)=>{ acc[f.feedback_type]=(acc[f.feedback_type]||0)+1; return acc; },{});

  // Admin dashboard computed values (from recentSearches — up to 500 records)
  const facilityBreakdown = (() => {
    if (!recentSearches.length) return [];
    const map = {};
    recentSearches.forEach(s => {
      const f = s.facility_number ? `Facility ${s.facility_number}` : "No Facility";
      map[f] = (map[f]||0) + 1;
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,12);
  })();

  const commonSearchTitles = (() => {
    if (!recentSearches.length) return [];
    const map = {};
    recentSearches.forEach(s => {
      const t = s.company_policies?.title;
      if (t) { map[t] = (map[t]||0) + 1; }
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,8);
  })();

  const helpfulnessPct = helpStats && helpStats.total > 0
    ? Math.round((helpStats.positive / helpStats.total) * 100)
    : null;
  const frictionAlerts = catBreakdown.filter(([cat,count]) => {
    if (count < 3) return false;
    return feedbackList.some(f=>f.company_policies?.title?.toLowerCase().includes(cat.toLowerCase())) || count>=5;
  }).slice(0,3);
  const filteredProcs = procedures.filter(p => {
    if (!procSearch.trim()) return true;
    const s = procSearch.toLowerCase();
    return (p.title||"").toLowerCase().includes(s)||(p.category||"").toLowerCase().includes(s)||(p.summary||"").toLowerCase().includes(s);
  });
  const procsByCategory = filteredProcs.reduce((acc,p)=>{ const cat=p.category||"General"; if(!acc[cat])acc[cat]=[]; acc[cat].push(p); return acc; },{});

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:P.pageBg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:32,height:32,border:`2px solid ${P.borderMid}`,borderTopColor:P.purple,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 14px"}}/>
        <p style={{color:P.muted,fontSize:12,fontFamily:SANS,margin:0}}>Loading Playbook…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={s.shell}>
      <Head><title>Playbook by OSS</title></Head>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.brand}>
            <Logo size={22}/>
            <div style={s.brandText}>
              <span style={s.brandName}>Playbook</span>
              <span style={s.brandBy}>by OSS</span>
            </div>
          </div>

          {!isMobile && (
            <nav style={s.desktopNav}>
              {tabs.map(t => (
                <button key={t.id} className="nav-tab"
                  style={{...s.navTab,...(activeTab===t.id?s.navTabActive:{})}}
                  onClick={() => setActiveTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div style={s.headerRight}>
            {!isMobile && (
              <span style={s.headerContext}>{buildFacilityContext(profile)}</span>
            )}
            <button className="signout-btn" style={s.signOutBtn}
              onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <main style={{...s.main, paddingBottom: isMobile ? 80 : 48}}>

        {/* ══ HOME — ADMIN DASHBOARD ══════════════════════════════════ */}
        {activeTab === "home" && isAdmin && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>Operations Dashboard</h1>
              <p style={s.pageSubtitle}>{buildFacilityContext(profile) || "Usage, searches, and policy feedback overview"}</p>
            </div>

            {/* ── TOP STATS ── */}
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <div style={s.statVal}>{sigLoading ? "…" : totalSearches}</div>
                <div style={s.statLbl}>Total Plays</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statVal}>{sigLoading ? "…" : facilityBreakdown.length}</div>
                <div style={s.statLbl}>Facilities Active</div>
              </div>
              {helpfulnessPct !== null ? (
                <div style={{...s.statCard, borderTopColor: helpfulnessPct>=70?P.green:helpfulnessPct>=50?P.amber:P.red}}>
                  <div style={{...s.statVal, color: helpfulnessPct>=70?P.green:helpfulnessPct>=50?P.amber:P.red}}>
                    {helpfulnessPct}%
                  </div>
                  <div style={s.statLbl}>Helpfulness Rate</div>
                </div>
              ) : (
                <div style={s.statCard}>
                  <div style={{...s.statVal,color:P.muted,fontSize:18}}>No data</div>
                  <div style={s.statLbl}>Helpfulness Rate</div>
                </div>
              )}
            </div>

            {/* ── PER-FACILITY BREAKDOWN ── */}
            <div style={{marginBottom:28}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={s.sectionLabel}>Plays by Facility</div>
                <button className="ghost-btn" style={s.ghostBtn} onClick={()=>{setSigFetched(false);setHelpStatsFetched(false);}}>Refresh</button>
              </div>
              {sigLoading ? (
                <div style={s.loadingBlock}><div style={s.spinner}/></div>
              ) : facilityBreakdown.length === 0 ? (
                <div style={s.emptyCard}>No play data yet.</div>
              ) : (
                <div style={s.dataCard}>
                  {facilityBreakdown.map(([fac,count],i) => {
                    const pct = Math.round((count/facilityBreakdown[0][1])*100);
                    return (
                      <div key={fac} style={i>0?{marginTop:14,paddingTop:14,borderTop:`1px solid ${P.border}`}:{}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:13,fontWeight:600,color:P.text}}>{fac}</span>
                          <span style={{fontSize:12,color:P.muted,fontFamily:MONO}}>{count} plays</span>
                        </div>
                        <div style={{height:5,background:P.border,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:BTN_GRAD,borderRadius:3,transition:"width 0.4s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── COMMON SEARCHES ── */}
            <div style={{marginBottom:28}}>
              <div style={s.sectionLabel}>Most Searched Policies</div>
              {sigLoading ? (
                <div style={s.loadingBlock}><div style={s.spinner}/></div>
              ) : commonSearchTitles.length === 0 ? (
                <div style={s.emptyCard}>No search data yet.</div>
              ) : (
                <div style={s.dataCard}>
                  {commonSearchTitles.map(([title,count],i) => {
                    const pct = Math.round((count/commonSearchTitles[0][1])*100);
                    return (
                      <div key={title} style={i>0?{marginTop:14,paddingTop:14,borderTop:`1px solid ${P.border}`}:{}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:13,fontWeight:600,color:P.text,flex:1,marginRight:8}}>{title}</span>
                          <span style={{fontSize:12,color:P.muted,fontFamily:MONO,flexShrink:0}}>{count}×</span>
                        </div>
                        <div style={{height:5,background:P.border,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${P.purpleMid},${P.purple})`,borderRadius:3,transition:"width 0.4s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── POLICY HELPFULNESS ── */}
            <div style={{marginBottom:28}}>
              <div style={s.sectionLabel}>Policy Helpfulness</div>
              {helpStatsLoading ? (
                <div style={s.loadingBlock}><div style={s.spinner}/></div>
              ) : !helpStats || helpStats.total === 0 ? (
                <div style={s.emptyCard}>No helpfulness ratings yet. These appear after users view and rate policies.</div>
              ) : (
                <>
                  {/* Big % number */}
                  <div style={{...s.dataCard, display:"flex", alignItems:"center", gap:20, marginBottom:10, flexWrap:"wrap"}}>
                    <div style={{textAlign:"center", minWidth:80}}>
                      <div style={{
                        fontSize:52, fontWeight:800, fontFamily:MONO, letterSpacing:"-0.04em", lineHeight:1,
                        color: helpfulnessPct>=70 ? P.green : helpfulnessPct>=50 ? P.amber : P.red,
                      }}>{helpfulnessPct}%</div>
                      <div style={{fontSize:11,fontWeight:600,color:P.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:4}}>Helpful</div>
                    </div>
                    <div style={{flex:1, display:"flex", flexDirection:"column", gap:8, minWidth:160}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:13,color:P.green,fontWeight:600,minWidth:28}}>✓ {helpStats.positive}</span>
                        <div style={{flex:1,height:6,background:P.border,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${helpStats.total?Math.round(helpStats.positive/helpStats.total*100):0}%`,background:P.green,borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:11,color:P.muted,minWidth:40,textAlign:"right"}}>Helpful</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:13,color:P.red,fontWeight:600,minWidth:28}}>✗ {helpStats.negative}</span>
                        <div style={{flex:1,height:6,background:P.border,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${helpStats.total?Math.round(helpStats.negative/helpStats.total*100):0}%`,background:P.red,borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:11,color:P.muted,minWidth:40,textAlign:"right"}}>Not helpful</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-policy table */}
                  {helpStats.mostHelpful.length > 0 && (
                    <div style={s.dataCard}>
                      <div style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Per-Policy Breakdown</div>
                      {[...helpStats.mostHelpful, ...helpStats.leastHelpful.filter(p=>p.score<1&&!helpStats.mostHelpful.find(m=>m.title===p.title))]
                        .slice(0,8).map((p,i) => {
                          const pct = Math.round(p.score*100);
                          const col = pct>=70?P.green:pct>=50?P.amber:P.red;
                          return (
                            <div key={p.title} style={i>0?{marginTop:12,paddingTop:12,borderTop:`1px solid ${P.border}`}:{}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:5}}>
                                <span style={{fontSize:13,fontWeight:600,color:P.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                                <span style={{fontSize:13,fontWeight:700,color:col,fontFamily:MONO,flexShrink:0}}>{pct}%</span>
                              </div>
                              <div style={{height:5,background:P.border,borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:3,opacity:0.7}}/>
                              </div>
                              <div style={{display:"flex",gap:12,marginTop:4}}>
                                <span style={{fontSize:11,color:P.green}}>✓ {p.helpful}</span>
                                <span style={{fontSize:11,color:P.red}}>✗ {p.not}</span>
                                <span style={{fontSize:11,color:P.muted}}>{p.total} total</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ HOME — USER / MANAGER ═══════════════════════════════════ */}
        {activeTab === "home" && !isAdmin && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>
                {profile?.full_name ? `Good to see you, ${profile.full_name.split(" ")[0]}` : "Welcome"}
              </h1>
              <p style={s.pageSubtitle}>
                {isManager ? "Policy guidance, manager tools, and Jack AI" : "Quick answers for your shift"}
              </p>
            </div>

            {/* User */}
            {!isManager && (
              <div style={s.homeGrid}>
                <button className="hero-card" style={s.heroCard} onClick={() => setActiveTab("ask")}>
                  <div style={s.heroCardIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <div style={s.heroCardTitle}>Ask Playbook</div>
                  <div style={s.heroCardSub}>Get a quick answer to any work situation</div>
                  <div style={s.heroCardArrow}>→</div>
                </button>
                <button className="feature-card" style={s.featureCard} onClick={() => setActiveTab("procedures")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                  <div style={s.featureCardText}>
                    <div style={s.featureCardTitle}>Step-by-Step Guides</div>
                    <div style={s.featureCardSub}>Company procedures and workflows</div>
                  </div>
                  <span style={s.featureCardArrow}>→</span>
                </button>
                <button className="feature-card" style={s.featureCard} onClick={() => setActiveTab("feedback")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <div style={s.featureCardText}>
                    <div style={s.featureCardTitle}>Give Feedback</div>
                    <div style={s.featureCardSub}>Anonymously flag unclear policies</div>
                  </div>
                  <span style={s.featureCardArrow}>→</span>
                </button>
              </div>
            )}

            {/* Manager */}
            {isManager && (
              <div style={s.homeGrid}>
                <button className="hero-card" style={s.heroCard} onClick={() => setActiveTab("ask")}>
                  <div style={s.heroCardIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <div style={s.heroCardTitle}>Ask Playbook</div>
                  <div style={s.heroCardSub}>Policy-backed guidance for any situation</div>
                  <div style={s.heroCardArrow}>→</div>
                </button>
                <button className="hero-card" style={{...s.heroCard,borderTopColor:P.purpleMid}} onClick={() => setActiveTab("jack")}>
                  <div style={s.heroCardIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a4 4 0 018 0v2"/><circle cx="8.5" cy="14" r="1" fill={P.purple}/><circle cx="15.5" cy="14" r="1" fill={P.purple}/><path d="M9.5 17.5h5"/></svg>
                  </div>
                  <div style={s.heroCardTitle}>Ask Jack AI</div>
                  <div style={s.heroCardSub}>AI-powered help for tricky workplace situations</div>
                  <div style={s.heroCardArrow}>→</div>
                </button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <button className="feature-card" style={{...s.featureCard,flexDirection:"column",alignItems:"flex-start",gap:10}} onClick={() => setActiveTab("procedures")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    <div style={{fontSize:13,fontWeight:700,color:P.text}}>Guides</div>
                  </button>
                  <button className="feature-card" style={{...s.featureCard,flexDirection:"column",alignItems:"flex-start",gap:10}} onClick={() => setActiveTab("feedback")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div style={{fontSize:13,fontWeight:700,color:P.text}}>Feedback</div>
                  </button>
                </div>
                {recents.length > 0 && (
                  <div>
                    <div style={s.sectionLabel}>Recent plays</div>
                    {recents.slice(0,3).map(r => (
                      <button key={r.id} className="list-row" style={s.listRow}
                        onClick={() => { setActiveTab("ask"); reopenRecent(r); }}>
                        <span style={s.listRowText}>{r.situation_text}</span>
                        <span style={s.listRowMeta}>{timeAgo(r.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ ASK ═════════════════════════════════════════════════════ */}
        {activeTab === "ask" && (
          <div className="fade-in">

            {/* SEARCH FORM */}
            {!results.length && !noResult && !searching && (
              <>
                <div style={s.pageHead}>
                  <h1 style={s.pageTitle}>What's the situation?</h1>
                  <p style={s.pageSubtitle}>Describe the issue and we'll find the relevant policies.</p>
                </div>
                <form onSubmit={handleSearch} style={s.searchBlock}>
                  <textarea
                    ref={queryRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSearch();} }}
                    placeholder={isManager
                      ? "e.g.  Employee called off 30 min before shift\n       Customer dispute over return policy"
                      : "e.g.  What do I do if a customer wants a refund?\n       Who do I call for an equipment issue?"}
                    style={s.searchInput} rows={4} autoFocus
                  />
                  <div style={s.searchBtnRow}>
                    <button type="submit"
                      style={{...s.searchBtn,...(!query.trim()?{opacity:0.45,cursor:"not-allowed"}:{})}}
                      disabled={!query.trim()}>
                      Get the Play →
                    </button>
                  </div>
                </form>

                {savedPlays.length > 0 && (
                  <div style={s.recentBlock}>
                    <div style={s.sectionLabel}>Saved plays</div>
                    {savedPlays.map(r => (
                      <button key={r.id} className="list-row" style={s.listRow} onClick={() => reopenRecent(r)}>
                        <span style={{color:P.amber,fontSize:12,flexShrink:0}}>★</span>
                        <span style={s.listRowText}>{r.situation_text}</span>
                      </button>
                    ))}
                  </div>
                )}
                {recents.length > 0 && (
                  <div style={s.recentBlock}>
                    <div style={s.sectionLabel}>Recent</div>
                    {recents.map(r => (
                      <button key={r.id} className="list-row" style={s.listRow} onClick={() => reopenRecent(r)}>
                        <span style={s.listRowText}>{r.situation_text}</span>
                        <span style={s.listRowMeta}>{timeAgo(r.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* SEARCHING */}
            {searching && (
              <div style={s.loadingBlock} className="fade-in">
                <div style={s.spinner}/>
                <span style={{fontSize:14,color:P.soft}}>Finding relevant policies…</span>
              </div>
            )}

            {/* NO RESULT */}
            {noResult && !searching && (
              <div style={s.emptyBlock} className="fade-in">
                <div style={s.emptyIconWrap}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                </div>
                <div style={s.emptyTitle}>No matching policy found</div>
                <div style={s.emptyBody}>Try different keywords, or check with your manager if this situation isn't covered.</div>
                <button style={s.outlineBtn} onClick={clearSearch}>Try again</button>
              </div>
            )}

            {/* RESULTS LIST */}
            {results.length > 0 && !selectedPolicy && !searching && (
              <div className="fade-in">
                <div style={s.resultTopBar}>
                  <button style={s.backBtn} onClick={clearSearch}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    New search
                  </button>
                </div>
                <div style={s.situationPill}>
                  <span style={{color:P.muted,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em"}}>Situation · </span>
                  <span style={{color:P.soft}}>{query}</span>
                </div>
                <div style={s.sectionLabel}>Relevant Policies</div>
                {results.map((policy, i) => (
                  <button key={policy.id} className="policy-card"
                    style={{...s.policyCard,...(i===0?s.policyCardTop:{})}}
                    onClick={() => selectPolicy(policy)}>
                    <div style={s.policyCardInner}>
                      <div style={s.policyCardLeft}>
                        <div style={s.policyCardTitle}>{policy.title}</div>
                        <div style={s.policyCardReason}>{getMatchReason(policy, query)}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                          {policy.category    && <span style={s.pill(P.soft)}>{policy.category}</span>}
                          {policy.policy_code && <span style={s.pill(P.muted)}>{policy.policy_code}</span>}
                        </div>
                      </div>
                      <div style={s.policyCardRight}>
                        <span style={{...s.relevanceBadge,...(i===0?s.relevanceBadgeBest:i<=2?s.relevanceBadgeStrong:s.relevanceBadgeRelated)}}>
                          {getRelevanceLabel(i)}
                        </span>
                        <svg style={{marginTop:8,flexShrink:0}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </div>
                  </button>
                ))}
                <div style={s.searchAgain}>
                  <form onSubmit={handleSearch} style={{display:"flex",gap:8}}>
                    <input value={query} onChange={e=>setQuery(e.target.value)}
                      placeholder="Search another situation…" style={s.inlineInput}/>
                    <button type="submit" style={s.inlineBtn} disabled={!query.trim()}>→</button>
                  </form>
                </div>
              </div>
            )}

            {/* POLICY DETAIL */}
            {selectedPolicy && !searching && (
              <div className="fade-in">
                <div style={s.resultTopBar}>
                  <button style={s.backBtn} onClick={results.length>1 ? backToResults : clearSearch}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    {results.length>1 ? "Back to results" : "New search"}
                  </button>
                  <div style={{display:"flex",gap:8}}>
                    <button className="chip-btn" style={{...s.chipBtn,...(isSaved?s.chipBtnSaved:{})}} onClick={handleSave}>
                      {isSaved ? "★ Saved" : "☆ Save"}
                    </button>
                    <button className="chip-btn" style={s.chipBtn}
                      onClick={() => { setShowPolicyFeedback(true); setPolicyFbDone(false); }}>
                      Flag
                    </button>
                  </div>
                </div>

                <div style={s.situationPill}>
                  <span style={{color:P.muted,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em"}}>Situation · </span>
                  <span style={{color:P.soft}}>{query}</span>
                </div>

                {/* Policy header */}
                <div style={s.detailHeaderCard}>
                  <div style={s.detailPolicyTitle}>{selectedPolicy.title}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                    {selectedPolicy.policy_code && <span style={s.pill(P.purple)}>{selectedPolicy.policy_code}</span>}
                    {selectedPolicy.category    && <span style={s.pill(P.soft)}>{selectedPolicy.category}</span>}
                    {selectedPolicy.severity    && <span style={s.pill(P.muted)}>{selectedPolicy.severity}</span>}
                  </div>
                  {selectedPolicy.summary && (
                    <div style={s.detailSummary}>{selectedPolicy.summary}</div>
                  )}
                </div>

                {/* The Play */}
                {(selectedPolicy.action_steps || selectedPolicy.policy_text) && (
                  <div style={s.resultCard}>
                    <div style={s.resultCardTag}>The Play</div>
                    <div style={s.resultCardBody}>{selectedPolicy.action_steps || selectedPolicy.policy_text}</div>
                  </div>
                )}

                {/* Avoid This */}
                {selectedPolicy.incorrect_examples && (
                  <div style={{...s.resultCard,borderLeft:`3px solid ${P.amber}`}}>
                    <div style={{...s.resultCardTag,color:P.amber}}>Avoid This</div>
                    <div style={s.resultCardBody}>{selectedPolicy.incorrect_examples}</div>
                  </div>
                )}

                {/* Escalation */}
                {selectedPolicy.escalation_guidance && (
                  <div style={{...s.resultCard,borderLeft:`3px solid ${P.red}`}}>
                    <div style={{...s.resultCardTag,color:P.red}}>Escalate If</div>
                    <div style={s.resultCardBody}>{selectedPolicy.escalation_guidance}</div>
                  </div>
                )}

                {/* Reference PDFs */}
                {policyRefsLoading && (
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 0"}}>
                    <div style={s.spinner}/><span style={{fontSize:13,color:P.muted}}>Loading references…</span>
                  </div>
                )}
                {!policyRefsLoading && policyRefs.length > 0 && (
                  <div style={s.resultCard}>
                    <div style={s.resultCardTag}>Reference Documents</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
                      {policyRefs.map(ref => (
                        <div key={ref.id} style={s.pdfRow}>
                          <div style={s.pdfIcon}><PdfIcon/></div>
                          <div style={s.pdfInfo}>
                            <div style={s.pdfName}>{ref.file_name}</div>
                            {ref.description && <div style={s.pdfDesc}>{ref.description}</div>}
                          </div>
                          <a href={ref.file_url} target="_blank" rel="noopener noreferrer" style={s.pdfOpenBtn}>Open ↗</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── HELPFUL FEEDBACK ── */}
                <div style={s.helpfulBlock}>
                  {!helpfulSaved ? (
                    <>
                      <div style={s.helpfulLabel}>Was this policy helpful?</div>
                      <div style={s.helpfulBtnRow}>
                        <button
                          className="helpful-btn"
                          style={{...s.helpfulBtn,...(helpfulChoice===true?s.helpfulBtnYesActive:{})}}
                          onClick={() => submitHelpfulFeedback(true)}
                          disabled={helpfulSaving}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke={helpfulChoice===true?"#fff":P.green} strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Helpful
                        </button>
                        <button
                          className="helpful-btn"
                          style={{...s.helpfulBtn,...(helpfulChoice===false?s.helpfulBtnNoActive:{})}}
                          onClick={() => submitHelpfulFeedback(false)}
                          disabled={helpfulSaving}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke={helpfulChoice===false?"#fff":P.red} strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Not helpful
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={s.helpfulConfirm}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Feedback saved.
                      <button style={s.helpfulChangeBtn} onClick={() => setHelpfulSaved(false)}>Change</button>
                    </div>
                  )}
                </div>

                <div style={s.searchAgain}>
                  <form onSubmit={handleSearch} style={{display:"flex",gap:8}}>
                    <input value={query} onChange={e=>setQuery(e.target.value)}
                      placeholder="Search another situation…" style={s.inlineInput}/>
                    <button type="submit" style={s.inlineBtn} disabled={!query.trim()}>→</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ JACK AI ═════════════════════════════════════════════════ */}
        {activeTab === "jack" && (
          <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 140px)",minHeight:400}}>
            <div style={{...s.pageHead,marginBottom:16}}>
              <h1 style={s.pageTitle}>Jack AI</h1>
              <p style={s.pageSubtitle}>Describe any workplace situation — call-offs, disputes, performance, safety, and more.</p>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
              {jackMessages.map((m,i) => (
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  {m.role === "assistant" && (
                    <div style={{width:28,height:28,borderRadius:"50%",background:P.purpleDim,border:`1px solid rgba(107,94,168,0.25)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:8,marginTop:2}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a4 4 0 018 0v2"/><circle cx="8.5" cy="14" r="1" fill={P.purple}/><circle cx="15.5" cy="14" r="1" fill={P.purple}/></svg>
                    </div>
                  )}
                  <div style={{
                    maxWidth:"78%",
                    padding:"12px 15px",
                    borderRadius: m.role==="user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                    background: m.role==="user" ? BTN_GRAD : P.surface,
                    border: m.role==="user" ? "none" : `1px solid ${P.border}`,
                    color: m.role==="user" ? "#fff" : P.text,
                    fontSize:14,
                    lineHeight:1.7,
                    boxShadow: m.role==="user" ? "0 2px 10px rgba(107,94,168,0.25)" : "0 1px 4px rgba(107,94,168,0.05)",
                    whiteSpace:"pre-wrap",
                  }}>{m.content}</div>
                </div>
              ))}
              {jackLoading && (
                <div style={{display:"flex",justifyContent:"flex-start",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:P.purpleDim,border:`1px solid rgba(107,94,168,0.25)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a4 4 0 018 0v2"/></svg>
                  </div>
                  <div style={{padding:"10px 14px",background:P.surface,border:`1px solid ${P.border}`,borderRadius:"14px 14px 14px 3px",display:"flex",gap:5,alignItems:"center"}}>
                    <div style={{...s.spinner,width:12,height:12}}/>
                    <span style={{fontSize:13,color:P.muted}}>Jack is thinking…</span>
                  </div>
                </div>
              )}
              <div ref={jackEndRef}/>
            </div>

            {/* Input row */}
            <div style={{paddingTop:12,borderTop:`1px solid ${P.border}`,display:"flex",gap:8,flexShrink:0}}>
              <input
                value={jackInput}
                onChange={e => setJackInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendJackMessage();} }}
                placeholder="Describe the situation…"
                disabled={jackLoading}
                style={{...s.inlineInput,flex:1}}
              />
              <button
                onClick={sendJackMessage}
                disabled={!jackInput.trim()||jackLoading}
                style={{...s.inlineBtn,opacity:(!jackInput.trim()||jackLoading)?0.45:1,transition:"opacity 0.15s"}}>
                →
              </button>
            </div>
          </div>
        )}

        {/* ══ GUIDES ══════════════════════════════════════════════════ */}
        {activeTab === "procedures" && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>Step-by-Step Guides</h1>
              <p style={s.pageSubtitle}>Company procedures and workflows</p>
            </div>
            <div style={{position:"relative",marginBottom:24}}>
              <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={procSearch} onChange={e=>setProcSearch(e.target.value)}
                placeholder="Search guides…"
                style={{...s.inlineInput,paddingLeft:40,width:"100%",boxSizing:"border-box"}}/>
            </div>
            {procsLoading && <div style={s.loadingBlock}><div style={s.spinner}/></div>}
            {!procsLoading && procedures.length===0 && (
              <div style={s.emptyBlock}><div style={s.emptyTitle}>No guides yet</div><div style={s.emptyBody}>Company procedures will appear here once added.</div></div>
            )}
            {!procsLoading && Object.entries(procsByCategory).map(([cat,items]) => (
              <div key={cat} style={{marginBottom:28}}>
                <div style={s.catLabel}>{cat}</div>
                {items.map(proc => (
                  <div key={proc.id} style={s.procCard}>
                    <button className="proc-toggle" style={s.procToggle}
                      onClick={() => setExpandedProc(expandedProc===proc.id?null:proc.id)}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={s.procTitle}>{proc.title}</div>
                        {proc.summary&&expandedProc!==proc.id&&<div style={s.procPreview}>{proc.summary}</div>}
                      </div>
                      <svg style={{transform:`rotate(${expandedProc===proc.id?180:0}deg)`,transition:"transform 0.2s",flexShrink:0}}
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {expandedProc===proc.id && (
                      <div style={s.procBody}>
                        <div style={s.procStepLabel}>Steps</div>
                        <div style={s.procContent}>{proc.action_steps||proc.policy_text||proc.summary||"No content available."}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ══ FEEDBACK ════════════════════════════════════════════════ */}
        {activeTab === "feedback" && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>Anonymous Feedback</h1>
              <p style={s.pageSubtitle}>Help improve company systems. Your identity is never recorded.</p>
            </div>
            {fbDone ? (
              <div style={s.successCard}>
                <div style={s.successCheck}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div style={s.successTitle}>Feedback submitted</div>
                <div style={s.successBody}>Thanks. Your feedback helps leadership improve the systems you work with every day.</div>
                <button style={s.primaryBtn} onClick={() => { setFbDone(false);setFbType("");setFbCategory("");setFbDescription(""); }}>Submit another</button>
              </div>
            ) : (
              <div style={s.formCard}>
                <div style={s.formSection}>
                  <div style={s.fieldLabel}>What kind of issue?</div>
                  <div style={s.fbGrid}>
                    {FB_TYPES.map(ft => (
                      <button key={ft.id} className="fb-opt"
                        style={{...s.fbOpt,...(fbType===ft.id?s.fbOptActive:{})}}
                        onClick={() => setFbType(ft.id)}>
                        {fbType===ft.id&&<span style={{color:P.purple,marginRight:4}}>✓</span>}{ft.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={s.formSection}>
                  <label style={s.fieldLabel}>Related area <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
                  <input value={fbCategory} onChange={e=>setFbCategory(e.target.value)} placeholder="e.g. call-offs, food safety, returns…" style={s.textInput}/>
                </div>
                <div style={s.formSection}>
                  <label style={s.fieldLabel}>Tell us more <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional, anonymous)</span></label>
                  <textarea value={fbDescription} onChange={e=>setFbDescription(e.target.value.slice(0,400))} placeholder="Describe what's confusing or what could be clearer…" style={{...s.textInput,minHeight:120,resize:"vertical",lineHeight:1.65}}/>
                  <div style={{fontSize:11,color:P.muted,textAlign:"right",marginTop:4}}>{fbDescription.length}/400</div>
                </div>
                {fbError&&<div style={s.errorBox}>{fbError}</div>}
                <button style={{...s.primaryBtn,...(!fbType||fbSubmitting?{opacity:0.45,cursor:"not-allowed"}:{})}}
                  onClick={submitAnonFeedback} disabled={!fbType||fbSubmitting}>
                  {fbSubmitting?"Submitting…":"Submit Feedback"}
                </button>
                <div style={s.privacyNote}>🔒 Your name and account are never linked to this submission.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ SIGNALS ═════════════════════════════════════════════════ */}
        {activeTab === "signals" && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>Operational Signals</h1>
              <p style={s.pageSubtitle}>Where your systems are creating friction</p>
            </div>
            {sigLoading
              ? <div style={s.loadingBlock}><div style={s.spinner}/><span style={{fontSize:14,color:P.soft}}>Loading signals…</span></div>
              : (
              <>
                <div style={s.statsRow}>
                  <div style={s.statCard}><div style={s.statVal}>{totalSearches}</div><div style={s.statLbl}>Total plays pulled</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{feedbackList.length}</div><div style={s.statLbl}>Policy flags</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{anonFeedback.length}</div><div style={s.statLbl}>Anon feedback</div></div>
                </div>
                {frictionAlerts.length>0&&(
                  <div style={{marginBottom:28}}>
                    <div style={s.sectionLabel}>Friction Alerts</div>
                    {frictionAlerts.map(([cat,count])=>(
                      <div key={cat} style={s.alertCard}>
                        <div style={s.alertTitle}>High activity: {cat}</div>
                        <div style={s.alertSub}>{count} searches — may indicate unclear guidance in this area</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginBottom:28}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={s.sectionLabel}>Policy Pulls by Category</div>
                    <button className="ghost-btn" style={s.ghostBtn} onClick={()=>{setSigFetched(false);loadSignals();}}>Refresh</button>
                  </div>
                  {catBreakdown.length===0?<div style={s.emptyCard}>No data yet.</div>:(
                    <div style={s.dataCard}>
                      {catBreakdown.map(([cat,count],i)=>{
                        const pct=Math.round((count/catBreakdown[0][1])*100);
                        return(
                          <div key={cat} style={i>0?{marginTop:16,paddingTop:16,borderTop:`1px solid ${P.border}`}:{}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{fontSize:14,fontWeight:600,color:P.text}}>{cat}</span>
                              <span style={{fontSize:13,color:P.muted,fontFamily:MONO}}>{count}</span>
                            </div>
                            <div style={{height:5,background:P.border,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${pct}%`,background:BTN_GRAD,borderRadius:3,transition:"width 0.4s ease"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {feedbackList.length>0&&(
                  <div style={{marginBottom:28}}>
                    <div style={s.sectionLabel}>Policy Flags</div>
                    {feedbackList.map(fb=>(
                      <div key={fb.id} style={{...s.dataCard,marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:13,fontWeight:700,color:P.text,flex:1}}>{fb.company_policies?.title||"Policy"}</div>
                          <span style={{fontSize:11,color:P.muted,fontFamily:MONO,flexShrink:0}}>{fmtDate(fb.created_at)}</span>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(fb.flags||[]).map(flag=><span key={flag} style={s.pill(P.muted)}>{flag}</span>)}</div>
                        {fb.note&&<div style={{marginTop:8,fontSize:13,color:P.soft,fontStyle:"italic"}}>"{fb.note}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ANALYTICS (admin) ═══════════════════════════════════════ */}
        {activeTab === "analytics" && isAdmin && (
          <div className="fade-in">
            <div style={s.pageHead}>
              <h1 style={s.pageTitle}>Analytics</h1>
              <p style={s.pageSubtitle}>Usage data, helpfulness ratings, and policy flags</p>
            </div>

            {/* Helpfulness summary */}
            {!helpStatsLoading && helpStats && helpStats.total > 0 && (
              <div style={{marginBottom:28}}>
                <div style={s.sectionLabel}>Policy Helpfulness</div>
                <div style={s.statsRow}>
                  <div style={{...s.statCard,borderTopColor:P.green}}>
                    <div style={{...s.statVal,color:P.green}}>{helpStats.positive}</div>
                    <div style={s.statLbl}>Helpful</div>
                  </div>
                  <div style={{...s.statCard,borderTopColor:P.red}}>
                    <div style={{...s.statVal,color:P.red}}>{helpStats.negative}</div>
                    <div style={s.statLbl}>Not helpful</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statVal}>{helpStats.total ? Math.round((helpStats.positive/helpStats.total)*100) : 0}%</div>
                    <div style={s.statLbl}>Helpful rate</div>
                  </div>
                </div>
                {helpStats.mostHelpful.length > 0 && (
                  <div style={{...s.dataCard,marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Top rated policies</div>
                    {helpStats.mostHelpful.map((p,i)=>(
                      <div key={p.title} style={i>0?{marginTop:12,paddingTop:12,borderTop:`1px solid ${P.border}`}:{}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                          <span style={{fontSize:13,color:P.text,fontWeight:600,flex:1}}>{p.title}</span>
                          <span style={s.pill(P.green)}>{Math.round(p.score*100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search stats */}
            {sigLoading
              ? <div style={s.loadingBlock}><div style={s.spinner}/></div>
              : (
              <>
                <div style={s.statsRow}>
                  <div style={s.statCard}><div style={s.statVal}>{totalSearches}</div><div style={s.statLbl}>Total plays</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{catBreakdown.length}</div><div style={s.statLbl}>Categories</div></div>
                  <div style={s.statCard}><div style={s.statVal}>{feedbackList.length}</div><div style={s.statLbl}>Policy flags</div></div>
                </div>
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={s.sectionLabel}>Plays by Category</div>
                    <button className="ghost-btn" style={s.ghostBtn} onClick={()=>{setSigFetched(false);loadSignals();}}>Refresh</button>
                  </div>
                  <div style={s.dataCard}>
                    {catBreakdown.length===0?<span style={{color:P.muted,fontSize:13}}>No data yet.</span>:catBreakdown.map(([cat,count],i)=>{
                      const pct=Math.round((count/catBreakdown[0][1])*100);
                      return(
                        <div key={cat} style={i>0?{marginTop:14,paddingTop:14,borderTop:`1px solid ${P.border}`}:{}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,fontWeight:600,color:P.text}}>{cat}</span><span style={{fontSize:12,color:P.muted,fontFamily:MONO}}>{count}</span></div>
                          <div style={{height:5,background:P.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:BTN_GRAD,borderRadius:3}}/></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginBottom:24}}>
                  <div style={s.sectionLabel}>Policy Feedback</div>
                  {feedbackList.length===0?<div style={s.emptyCard}>No feedback yet.</div>:feedbackList.map(fb=>(
                    <div key={fb.id} style={{...s.dataCard,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,gap:8,flexWrap:"wrap"}}>
                        <div style={{fontSize:13,fontWeight:700,color:P.text}}>{fb.company_policies?.title||"Policy"}</div>
                        <span style={{fontSize:11,color:P.muted,fontFamily:MONO,flexShrink:0}}>{fmtDate(fb.created_at)}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{(fb.flags||[]).map(f=><span key={f} style={s.pill(P.muted)}>{f}</span>)}</div>
                      {fb.note&&<div style={{marginTop:8,fontSize:13,color:P.soft,fontStyle:"italic"}}>"{fb.note}"</div>}
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:24}}>
                  <div style={s.sectionLabel}>Recent Plays</div>
                  <div style={s.dataCard}>
                    {recentSearches.length===0?<span style={{color:P.muted,fontSize:13}}>No searches yet.</span>:recentSearches.map((sr,i)=>(
                      <div key={sr.id} style={i>0?{marginTop:12,paddingTop:12,borderTop:`1px solid ${P.border}`}:{}}>
                        <div style={{fontSize:13,color:P.text,marginBottom:3}}>{sr.situation_text}</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          {sr.company_policies?.title&&<span style={{fontSize:11,color:P.soft}}>→ {sr.company_policies.title}</span>}
                          {sr.company_policies?.category&&<span style={s.pill(P.muted)}>{sr.company_policies.category}</span>}
                          <span style={{fontSize:11,color:P.muted,marginLeft:"auto",fontFamily:MONO}}>{timeAgo(sr.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV ──────────────────────────────────────────────── */}
      {isMobile && (
        <nav style={s.bottomNav}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{...s.bottomNavBtn,...(activeTab===t.id?s.bottomNavBtnActive:{})}}>
              <NavIcon name={t.icon} active={activeTab===t.id}/>
              <span style={{...s.bottomNavLabel,...(activeTab===t.id?{color:P.purple}:{})}}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── POLICY FLAG MODAL ───────────────────────────────────────── */}
      {showPolicyFeedback && (
        <div style={s.overlay} onClick={closePolicyFeedback}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            {policyFbDone?(
              <div style={{textAlign:"center",padding:"8px 0 8px"}}>
                <div style={{...s.successCheck,margin:"0 auto 14px"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div style={{fontSize:17,fontWeight:700,color:P.text,marginBottom:8}}>Thanks for flagging that</div>
                <div style={{fontSize:13,color:P.soft,lineHeight:1.55,marginBottom:20}}>Your feedback helps improve policies for everyone.</div>
                <button style={s.primaryBtn} onClick={closePolicyFeedback}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:17,fontWeight:700,color:P.text,marginBottom:4}}>Flag Policy</div>
                <div style={{fontSize:13,color:P.soft,marginBottom:16,lineHeight:1.5}}>{selectedPolicy?.title}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {POLICY_FLAGS.map(flag=>(
                    <button key={flag} className="fb-opt"
                      style={{...s.fbOpt,...(policyFlags.includes(flag)?s.fbOptActive:{})}}
                      onClick={()=>togglePolicyFlag(flag)}>
                      {policyFlags.includes(flag)&&<span style={{color:P.purple,marginRight:4}}>✓</span>}{flag}
                    </button>
                  ))}
                </div>
                <label style={s.fieldLabel}>Optional note <span style={{color:P.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(max 280 chars)</span></label>
                <textarea value={policyFeedbackNote} onChange={e=>setPolicyFeedbackNote(e.target.value.slice(0,280))}
                  placeholder="Any context…" style={{...s.textInput,minHeight:72,resize:"vertical",marginBottom:4,lineHeight:1.65}}/>
                <div style={{fontSize:11,color:P.muted,textAlign:"right",marginBottom:16}}>{policyFeedbackNote.length}/280</div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...s.primaryBtn,flex:1,...(!policyFlags.length||policyFbSubmitting?{opacity:0.45,cursor:"not-allowed"}:{})}}
                    onClick={submitPolicyFeedback} disabled={!policyFlags.length||policyFbSubmitting}>
                    {policyFbSubmitting?"Submitting…":"Submit"}
                  </button>
                  <button className="ghost-btn" style={s.ghostBtn} onClick={closePolicyFeedback}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      {!isMobile && (
        <footer style={s.footer}>
          <a href="/support" style={s.footerLink}>Contact Support</a>
          <span style={s.footerBrand}>Playbook by OSS · Operator Support Systems</span>
        </footer>
      )}
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; background: #F6F4FA; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
  @keyframes spin   { to { transform: rotate(360deg); } }
  .fade-in { animation: fadeIn 0.16s ease both; }

  .nav-tab:hover       { color: #1C1830 !important; }
  .hero-card:hover     { box-shadow: 0 6px 24px rgba(107,94,168,0.15) !important; transform: translateY(-1px); }
  .feature-card:hover  { border-color: #A99AC8 !important; background: #FAF9FD !important; }
  .list-row:hover      { border-color: #CFC8E8 !important; background: #FAF9FD !important; }
  .chip-btn:hover      { border-color: #A99AC8 !important; }
  .proc-toggle:hover   { background: #FAF9FD !important; }
  .fb-opt:hover        { border-color: #A99AC8 !important; }
  .ghost-btn:hover     { border-color: #A99AC8 !important; background: #FAF9FD !important; }
  .signout-btn:hover   { color: #1C1830 !important; border-color: #A99AC8 !important; }
  .policy-card:hover   { border-color: rgba(107,94,168,0.40) !important; box-shadow: 0 3px 16px rgba(107,94,168,0.10) !important; transform: translateY(-1px); }
  .helpful-btn:hover   { filter: brightness(0.93); }

  textarea:focus, input:focus, select:focus {
    border-color: rgba(107,94,168,0.50) !important;
    box-shadow: 0 0 0 3px rgba(107,94,168,0.08) !important;
    outline: none !important;
  }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D4CEEA; border-radius: 4px; }
  button { font-family: inherit; cursor: pointer; }
  button, a { -webkit-tap-highlight-color: transparent; }
`;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  shell: { minHeight:"100vh", background:P.pageBg, color:P.text, fontFamily:SANS },

  // Header
  header:        { background:P.surface, borderBottom:`1px solid ${P.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(107,94,168,0.06)" },
  headerInner:   { maxWidth:1120, margin:"0 auto", display:"flex", alignItems:"center", height:60, paddingLeft:28, paddingRight:24, gap:20 },
  brand:         { display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  brandText:     { display:"flex", alignItems:"baseline", gap:5 },
  brandName:     { fontWeight:700, fontSize:16, color:P.text, letterSpacing:"-0.01em" },
  brandBy:       { fontSize:11, color:P.muted, letterSpacing:"0.03em" },
  proBadge:      { fontSize:9, fontWeight:800, color:P.purple, background:P.purpleDim, border:`1px solid rgba(107,94,168,0.25)`, borderRadius:4, padding:"2px 7px", letterSpacing:"0.10em", textTransform:"uppercase" },
  desktopNav:    { display:"flex", alignItems:"stretch", flex:1, height:60, overflowX:"auto" },
  navTab:        { border:"none", borderBottom:"2px solid transparent", borderTop:"2px solid transparent", background:"transparent", color:P.muted, padding:"0 16px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", letterSpacing:"0.01em", display:"flex", alignItems:"center", transition:"color 0.15s" },
  navTabActive:  { borderBottom:`2px solid ${P.purple}`, color:P.text },
  headerRight:   { display:"flex", alignItems:"center", gap:12, marginLeft:"auto", flexShrink:0 },
  headerContext: { fontSize:12, color:P.soft, fontWeight:600, letterSpacing:"0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:240 },
  signOutBtn:    { border:`1px solid ${P.border}`, background:"transparent", color:P.muted, borderRadius:7, padding:"7px 14px", fontSize:12, fontWeight:600, letterSpacing:"0.02em", transition:"all 0.15s", flexShrink:0 },

  // Main
  main: { maxWidth:1120, margin:"0 auto", padding:"36px 28px 48px" },

  // Page heading
  pageHead:    { marginBottom:32 },
  pageTitle:   { fontSize:26, fontWeight:700, color:P.text, margin:"0 0 8px", letterSpacing:"-0.02em", lineHeight:1.2 },
  pageSubtitle:{ fontSize:15, color:P.soft, margin:0, lineHeight:1.55 },

  // Bottom nav
  bottomNav:          { position:"fixed", bottom:0, left:0, right:0, height:62, background:P.surface, borderTop:`1px solid ${P.border}`, display:"flex", alignItems:"stretch", zIndex:100, boxShadow:"0 -1px 8px rgba(107,94,168,0.07)" },
  bottomNavBtn:       { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, border:"none", background:"transparent", padding:"6px 4px", minWidth:0, transition:"background 0.15s" },
  bottomNavBtnActive: { background:P.purpleGlow },
  bottomNavLabel:     { fontSize:10, fontWeight:600, color:P.muted, letterSpacing:"0.03em" },

  // Home
  homeGrid:         { display:"flex", flexDirection:"column", gap:14 },
  heroCard:         { width:"100%", background:P.surface, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.purple}`, borderRadius:12, padding:"24px 22px", textAlign:"left", cursor:"pointer", position:"relative", boxShadow:"0 2px 12px rgba(107,94,168,0.08)", transition:"all 0.18s ease" },
  heroCardIcon:     { marginBottom:14, display:"inline-flex", padding:"10px", background:P.purpleDim, borderRadius:10 },
  heroCardTitle:    { fontSize:18, fontWeight:700, color:P.text, marginBottom:4, letterSpacing:"-0.01em" },
  heroCardSub:      { fontSize:13, color:P.soft, lineHeight:1.5 },
  heroCardArrow:    { position:"absolute", right:22, top:"50%", transform:"translateY(-50%)", fontSize:18, color:P.purple, fontWeight:700 },
  featureCard:      { width:"100%", background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"all 0.15s", textAlign:"left" },
  featureCardText:  { flex:1, minWidth:0 },
  featureCardTitle: { fontSize:14, fontWeight:700, color:P.text, marginBottom:2 },
  featureCardSub:   { fontSize:12, color:P.soft },
  featureCardArrow: { color:P.muted, fontSize:15, flexShrink:0 },

  // Stats
  statsRow: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12, marginBottom:24 },
  statCard:  { background:P.surface, border:`1px solid ${P.border}`, borderTop:`2px solid ${P.purple}`, borderRadius:10, padding:"18px 16px", boxShadow:"0 1px 4px rgba(107,94,168,0.06)" },
  statVal:   { fontSize:30, fontWeight:700, color:P.text, fontFamily:MONO, letterSpacing:"-0.03em", lineHeight:1 },
  statLbl:   { fontSize:11, fontWeight:600, color:P.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:6 },

  // Alert
  alertCard:  { background:"#FFFBF0", border:`1px solid #F0DFA0`, borderLeft:`3px solid ${P.amber}`, borderRadius:8, padding:"14px 16px", marginBottom:8 },
  alertTitle: { fontSize:14, fontWeight:700, color:P.amber, marginBottom:3 },
  alertSub:   { fontSize:12, color:P.soft, lineHeight:1.5 },

  // Labels
  sectionLabel: { fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12, paddingLeft:10, borderLeft:`2px solid ${P.purple}` },
  catLabel:     { fontSize:11, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10, paddingLeft:10, borderLeft:`2px solid ${P.borderMid}` },

  // List rows
  listRow:     { width:"100%", display:"flex", alignItems:"center", gap:12, background:P.surface, border:`1px solid ${P.border}`, borderRadius:8, padding:"12px 16px", textAlign:"left", marginBottom:6, transition:"all 0.12s", cursor:"pointer" },
  listRowText: { fontSize:13, color:P.soft, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  listRowMeta: { fontSize:11, color:P.muted, fontFamily:MONO, flexShrink:0 },

  // Search
  searchBlock:  { display:"flex", flexDirection:"column", gap:0, marginBottom:32 },
  searchInput:  { width:"100%", background:P.surface, border:`1px solid ${P.borderMid}`, borderRadius:10, color:P.text, padding:"18px 20px", fontSize:15, lineHeight:1.65, resize:"vertical", outline:"none", fontFamily:SANS, boxShadow:"0 1px 4px rgba(107,94,168,0.06)", marginBottom:14 },
  searchBtnRow: { display:"flex", justifyContent:"flex-end" },
  searchBtn:    { background:BTN_GRAD, border:"none", color:"#fff", borderRadius:9, padding:"13px 28px", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em", boxShadow:"0 3px 12px rgba(107,94,168,0.28)", transition:"opacity 0.15s" },
  recentBlock:  { marginBottom:28 },

  // Policy list cards
  policyCard:       { width:"100%", background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 18px", marginBottom:10, textAlign:"left", cursor:"pointer", boxShadow:"0 1px 4px rgba(107,94,168,0.05)", transition:"all 0.16s ease" },
  policyCardTop:    { borderLeft:`3px solid ${P.purple}` },
  policyCardInner:  { display:"flex", alignItems:"flex-start", gap:12 },
  policyCardLeft:   { flex:1, minWidth:0 },
  policyCardRight:  { display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0 },
  policyCardTitle:  { fontSize:15, fontWeight:700, color:P.text, marginBottom:4, lineHeight:1.3 },
  policyCardReason: { fontSize:12, color:P.muted, lineHeight:1.5 },

  // Relevance badges
  relevanceBadge:        { fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:5, letterSpacing:"0.05em", textTransform:"uppercase", display:"inline-block" },
  relevanceBadgeBest:    { background:"rgba(107,94,168,0.12)", color:P.purple, border:`1px solid rgba(107,94,168,0.30)` },
  relevanceBadgeStrong:  { background:"rgba(46,125,82,0.09)",  color:P.green,  border:`1px solid rgba(46,125,82,0.25)` },
  relevanceBadgeRelated: { background:P.surfaceSub, color:P.muted, border:`1px solid ${P.border}` },

  // Policy detail
  detailHeaderCard:   { background:P.surface, border:`1px solid ${P.border}`, borderTop:`2px solid ${P.purple}`, borderRadius:10, padding:"22px 22px 20px", marginBottom:10, boxShadow:"0 2px 8px rgba(107,94,168,0.07)" },
  detailPolicyTitle:  { fontSize:20, fontWeight:700, color:P.text, lineHeight:1.25, letterSpacing:"-0.01em" },
  detailSummary:      { fontSize:14, color:P.soft, lineHeight:1.65, marginTop:14, paddingTop:14, borderTop:`1px solid ${P.border}` },

  // Helpful feedback
  helpfulBlock:     { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"18px 20px", marginTop:10, marginBottom:4, display:"flex", flexDirection:"column", gap:12 },
  helpfulLabel:     { fontSize:13, fontWeight:600, color:P.soft },
  helpfulBtnRow:    { display:"flex", gap:10 },
  helpfulBtn:       { display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.14s", border:`1.5px solid ${P.border}`, background:P.surfaceSub, color:P.soft },
  helpfulBtnYesActive: { background:P.green, border:`1.5px solid ${P.green}`, color:"#fff", boxShadow:"0 2px 8px rgba(46,125,82,0.25)" },
  helpfulBtnNoActive:  { background:P.red,   border:`1.5px solid ${P.red}`,   color:"#fff", boxShadow:"0 2px 8px rgba(138,46,46,0.22)" },
  helpfulConfirm:   { display:"flex", alignItems:"center", gap:7, fontSize:13, color:P.green, fontWeight:600 },
  helpfulChangeBtn: { background:"transparent", border:"none", fontSize:12, color:P.muted, cursor:"pointer", textDecoration:"underline", padding:0, marginLeft:6 },

  // Admin helpful badges
  helpBadgePos: { fontSize:11, fontWeight:700, color:P.green, background:"rgba(46,125,82,0.09)", border:`1px solid rgba(46,125,82,0.25)`, borderRadius:5, padding:"2px 8px" },
  helpBadgeNeg: { fontSize:11, fontWeight:700, color:P.red,   background:"rgba(138,46,46,0.08)", border:`1px solid rgba(138,46,46,0.20)`, borderRadius:5, padding:"2px 8px" },

  // Loading / empty
  loadingBlock: { display:"flex", alignItems:"center", gap:12, padding:"60px 0", justifyContent:"center" },
  spinner:      { width:22, height:22, border:`2px solid ${P.borderMid}`, borderTopColor:P.purple, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 },
  emptyBlock:   { display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"60px 20px", textAlign:"center" },
  emptyIconWrap:{ width:56, height:56, borderRadius:14, background:P.surface, border:`1px solid ${P.border}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(107,94,168,0.06)" },
  emptyTitle:   { fontSize:17, fontWeight:700, color:P.text },
  emptyBody:    { fontSize:13, color:P.soft, lineHeight:1.6, maxWidth:280 },
  emptyCard:    { background:P.surfaceSub, border:`1px solid ${P.border}`, borderRadius:10, padding:"24px", textAlign:"center", color:P.muted, fontSize:13 },

  // Result / detail cards
  resultTopBar:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:12 },
  backBtn:        { display:"flex", alignItems:"center", gap:5, background:"transparent", border:"none", color:P.purple, fontSize:13, fontWeight:600, padding:0, cursor:"pointer" },
  chipBtn:        { border:`1px solid ${P.border}`, background:P.surface, color:P.soft, borderRadius:7, padding:"7px 13px", fontSize:12, fontWeight:600, cursor:"pointer", transition:"border-color 0.12s" },
  chipBtnSaved:   { border:`1px solid rgba(138,94,16,0.35)`, color:P.amber, background:"rgba(138,94,16,0.06)" },
  situationPill:  { background:P.surfaceSub, border:`1px solid ${P.border}`, borderRadius:8, padding:"10px 16px", fontSize:13, lineHeight:1.5, marginBottom:16 },
  resultCard:     { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"20px", marginBottom:10, boxShadow:"0 1px 4px rgba(107,94,168,0.05)" },
  resultCardTag:  { fontSize:10, fontWeight:800, color:P.muted, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:12, paddingLeft:8, borderLeft:`2px solid ${P.purple}` },
  resultCardBody: { fontSize:14, lineHeight:1.8, color:P.text, whiteSpace:"pre-wrap" },
  searchAgain:    { marginTop:20, paddingTop:18, borderTop:`1px solid ${P.border}` },
  inlineInput:    { flex:1, height:46, background:P.surface, border:`1px solid ${P.borderMid}`, borderRadius:8, color:P.text, padding:"0 14px", fontSize:14, outline:"none", fontFamily:SANS },
  inlineBtn:      { width:46, height:46, background:BTN_GRAD, border:"none", borderRadius:8, color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", flexShrink:0 },

  // PDF references
  pdfRow:    { display:"flex", alignItems:"flex-start", gap:12, padding:"12px 14px", background:P.surfaceSub, border:`1px solid ${P.border}`, borderRadius:8 },
  pdfIcon:   { flexShrink:0, marginTop:1 },
  pdfInfo:   { flex:1, minWidth:0 },
  pdfName:   { fontSize:14, fontWeight:600, color:P.text, marginBottom:2, lineHeight:1.3 },
  pdfDesc:   { fontSize:12, color:P.muted, lineHeight:1.5 },
  pdfOpenBtn:{ flexShrink:0, background:BTN_GRAD, color:"#fff", border:"none", borderRadius:6, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", textDecoration:"none", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", boxShadow:"0 2px 8px rgba(107,94,168,0.20)" },

  // Procedures
  procCard:     { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, marginBottom:8, overflow:"hidden" },
  procToggle:   { width:"100%", display:"flex", alignItems:"center", gap:12, background:"transparent", border:"none", padding:"16px 18px", textAlign:"left", transition:"background 0.12s" },
  procTitle:    { fontSize:15, fontWeight:700, color:P.text, marginBottom:2 },
  procPreview:  { fontSize:12, color:P.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  procBody:     { padding:"0 18px 18px", borderTop:`1px solid ${P.border}` },
  procStepLabel:{ fontSize:10, fontWeight:700, color:P.muted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10, marginTop:16 },
  procContent:  { fontSize:14, color:P.text, lineHeight:1.8, whiteSpace:"pre-wrap" },

  // Feedback form
  formCard:    { background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:"24px" },
  formSection: { marginBottom:22 },
  fbGrid:      { display:"flex", flexDirection:"column", gap:8 },
  fbOpt:       { width:"100%", background:P.surfaceSub, border:`1px solid ${P.border}`, borderRadius:8, padding:"13px 16px", textAlign:"left", fontSize:14, color:P.soft, transition:"border-color 0.12s" },
  fbOptActive: { background:P.purpleDim, border:`1px solid rgba(107,94,168,0.40)`, color:P.text, fontWeight:600 },
  fieldLabel:  { display:"block", fontSize:11, fontWeight:700, color:P.soft, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 },
  textInput:   { width:"100%", minHeight:48, background:P.surface, border:`1px solid ${P.borderMid}`, borderRadius:8, color:P.text, padding:"13px 16px", fontSize:14, outline:"none", fontFamily:SANS, display:"block" },
  errorBox:    { background:P.redDim, border:`1px solid rgba(138,46,46,0.25)`, borderRadius:8, padding:"12px 16px", fontSize:13, color:P.red, marginBottom:16, lineHeight:1.5 },
  privacyNote: { marginTop:16, padding:14, background:P.surfaceSub, borderRadius:8, border:`1px solid ${P.border}`, fontSize:12, color:P.muted, lineHeight:1.6 },

  // Buttons
  primaryBtn: { width:"100%", minHeight:50, background:BTN_GRAD, border:"none", color:"#fff", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em", boxShadow:"0 3px 12px rgba(107,94,168,0.25)", display:"block" },
  outlineBtn: { background:"transparent", border:`1px solid ${P.border}`, color:P.soft, borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer", minHeight:44 },
  ghostBtn:   { background:"transparent", border:`1px solid ${P.border}`, color:P.muted, borderRadius:7, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.12s" },

  // Success
  successCard:  { background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:"36px 24px", textAlign:"center", boxShadow:"0 2px 12px rgba(107,94,168,0.07)" },
  successCheck: { width:54, height:54, background:"rgba(46,125,82,0.09)", border:"1px solid rgba(46,125,82,0.25)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" },
  successTitle: { fontSize:18, fontWeight:700, color:P.text, marginBottom:8 },
  successBody:  { fontSize:14, color:P.soft, lineHeight:1.6, marginBottom:24 },

  // Pill
  pill: (c) => ({ display:"inline-flex", alignItems:"center", padding:"3px 9px", borderRadius:5, fontSize:11, fontWeight:600, background:`${c}18`, border:`1px solid ${c}40`, color:c, letterSpacing:"0.03em" }),

  // Data cards
  dataCard: { background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"18px 20px", boxShadow:"0 1px 4px rgba(107,94,168,0.05)" },

  // Modal
  overlay: { position:"fixed", inset:0, zIndex:200, background:"rgba(28,24,48,0.45)", backdropFilter:"blur(2px)", display:"flex", alignItems:"flex-end", justifyContent:"center", boxSizing:"border-box" },
  modal:   { background:P.surface, border:`1px solid ${P.borderMid}`, borderTop:`2px solid ${P.purple}`, borderRadius:"16px 16px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:540, boxShadow:"0 -8px 32px rgba(107,94,168,0.15)", maxHeight:"90vh", overflowY:"auto" },

  // Footer
  footer:      { borderTop:`1px solid ${P.border}`, padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12 },
  footerLink:  { fontSize:12, color:P.muted, textDecoration:"none", fontWeight:600 },
  footerBrand: { fontSize:12, color:P.muted },
};
