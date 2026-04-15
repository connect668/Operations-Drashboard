import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = {
  compliance:    "compliance",
  policy:        "policy",
  decision:      "decision",
  coaching:      "coaching",
  myLogs:        "my_logs",
  teamDecisions: "team_decisions",
  teamCoaching:  "team_coaching",
  managers:      "managers",
  facilities:    "facilities",
};

const ROLE_LEVELS = {
  Manager:          1,
  "General Manager": 2,
  "Area Coach":      3,
  "Area Manager":    3,
};

const CATEGORIES = ["HR", "Operations", "Food Safety"];

const CATEGORY_KEYWORDS = {
  HR: [
    "employee","hire","hired","firing","fired","termination","terminate",
    "attendance","late","tardy","call out","no call","no show","write up",
    "written up","disciplin","harassment","complaint","policy violation",
    "absence","absent","performance","review","schedule","shift","overtime",
    "pay","wage","benefit","leave","vacation","pto","uniform","dress code",
    "conduct","corrective action","resignation","quit","walked off",
  ],
  "Food Safety": [
    "food","temperature","temp","allergen","cross contaminat","sanitize",
    "sanitation","expir","spoil","label","date label","thaw","cook",
    "raw","storage","refriger","freezer","health inspect","pest","rodent",
    "clean","dish","dishwash","equipment","haccp","glove","handwash",
    "hand wash","contamination","recall","unsafe",
  ],
  Operations: [
    "customer","register","cash","till","deposit","inventory","order",
    "vendor","delivery","waste","portion","recipe","equipment","repair",
    "mainten","opening","closing","procedure","training","safety",
    "emergency","incident","accident","shrink","count","audit","drawer",
    "overring","void","refund","comp","comped","spill","injury",
  ],
};

// Facility score cards (Area Manager view)
// PP/D = Policy Pull to Documentation Ratio — max 6 pulls per 1 decision
const AM_SCORES = [
  { key: "pr",  label: "PR%",  target: 78,  unit: "%",  desc: "Policy Reference Rate",                    decimal: false, max: 100 },
  { key: "pas", label: "PAS%", target: 85,  unit: "%",  desc: "Policy Adherence Score",                   decimal: false, max: 100 },
  { key: "tpr", label: "TPR%", target: 91,  unit: "%",  desc: "Team Performance Rating",                  decimal: false, max: 100 },
  { key: "ppd", label: "PP/D", target: 4.2, unit: "x",  desc: "Policy Pull to Documentation Ratio · /6", decimal: true,  max: 6   },
];

// Area Manager Policy Compliance — mock data (swap these values with Supabase queries when live)
const AM_COMPLIANCE_MOCK = {
  pas:        87,    // Area Policy Adherence Score (%)
  ppd:        3.8,   // Area Policy Pull to Documentation Ratio (out of 6)
  totalPulls: 142,   // Total policy pulls this month
  categories: [
    { label: "HR",           pct: 45 },
    { label: "Operations",   pct: 32 },
    { label: "Food Safety",  pct: 23 },
  ],
};

// GM performance snapshot (General Manager view)
const GM_SCORES = [
  { key: "pr",  label: "PR%",  target: 74,  unit: "%", desc: "Policy Reference Rate",   decimal: false, max: 100 },
  { key: "pas", label: "PAS%", target: 88,  unit: "%", desc: "Policy Adherence Score",  decimal: false, max: 100 },
  { key: "tpr", label: "TPR%", target: 82,  unit: "%", desc: "Team Performance Rating", decimal: false, max: 100 },
];

function detectCategory(situation = "", action = "") {
  const text = `${situation} ${action}`.toLowerCase();
  let best = null, bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function resolveCategory(item) {
  return item.category || item.reasoning || null;
}

function getNextRole(role) {
  if (role === "Manager") return "General Manager";
  if (role === "General Manager") return "Area Coach";
  return null;
}

function scoreColor(val, max = 100) {
  const pct = max <= 10 ? (val / max) * 100 : val;
  if (pct >= 85) return "#4ade80";
  if (pct >= 65) return "#fbbf24";
  return "#f87171";
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  HR:            { bg: "rgba(139,92,246,0.13)", color: "#a78bfa", border: "rgba(139,92,246,0.35)" },
  Operations:    { bg: "rgba(59,130,246,0.13)",  color: "#60a5fa", border: "rgba(59,130,246,0.35)" },
  "Food Safety": { bg: "rgba(34,197,94,0.13)",   color: "#4ade80", border: "rgba(34,197,94,0.35)" },
};

function CategoryBadge({ item }) {
  const cat = resolveCategory(item);
  if (!cat) return null;
  const c = CATEGORY_COLORS[cat] || { bg: "#1e293b", color: "#94a3b8", border: "#334155" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {cat}
    </span>
  );
}

// ─── Animated score card ──────────────────────────────────────────────────────

function ScoreCard({ metric, value }) {
  const color = scoreColor(value, metric.max || 100);
  const display = metric.decimal ? value.toFixed(1) : Math.round(value);
  // Progress bar width: for PPD max=6, otherwise percentage of 100
  const barPct = metric.max === 6 ? (value / 6) * 100 : value;
  return (
    <div style={styles.scoreCard}>
      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "10px" }}>
        {metric.label}
      </div>
      <div style={{ fontSize: "40px", fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
        {display}{metric.unit}
      </div>
      <div style={{ background: "#1f2937", borderRadius: "999px", height: "4px", overflow: "hidden", margin: "12px 0 8px" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(barPct, 100)}%`,
          background: color,
          borderRadius: "999px",
          transition: "background 0.3s, width 0.1s",
        }} />
      </div>
      <div style={{ fontSize: "11px", color: "#6b7280" }}>{metric.desc}</div>
    </div>
  );
}

// ─── Shared decision log card ─────────────────────────────────────────────────

function DecisionCard({ item, actions, formatDate }) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{item.user_name || formatDate(item.created_at)}</div>
          {item.user_role && <div style={styles.feedMeta}>{item.user_role}{item.company ? ` · ${item.company}` : ""}</div>}
        </div>
        <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
      </div>
      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Situation</div>
        <div style={styles.feedBody}>{item.situation || "—"}</div>
      </div>
      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Action Taken</div>
        <div style={styles.feedBody}>{item.action_taken || "—"}</div>
      </div>
      <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <CategoryBadge item={item} />
        {item.policy_referenced && <span style={styles.policyTag}>Policy: {item.policy_referenced}</span>}
        {item.is_read === false && (
          <span style={{ ...styles.statusBadge, background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
            Unread
          </span>
        )}
      </div>
      {actions && <div style={styles.actionRow}>{actions}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab]   = useState(TABS.policy);
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);

  // Form state
  const [policyText, setPolicyText]             = useState("");
  const [decisionSituation, setDecisionSituation] = useState("");
  const [decisionAction, setDecisionAction]       = useState("");
  const [decisionCategory, setDecisionCategory]   = useState("");
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [decisionPolicy, setDecisionPolicy]       = useState("");
  const [coachingText, setCoachingText]           = useState("");

  // Messages
  const [policyMessage, setPolicyMessage]           = useState("");
  const [decisionMessage, setDecisionMessage]       = useState("");
  const [coachingMessage, setCoachingMessage]       = useState("");
  const [teamDecisionsMessage, setTeamDecisionsMessage] = useState("");
  const [teamCoachingMessage, setTeamCoachingMessage]   = useState("");
  const [managersMessage, setManagersMessage]           = useState("");

  // Loading flags
  const [decisionLoading, setDecisionLoading]           = useState(false);
  const [coachingLoading, setCoachingLoading]           = useState(false);
  const [teamDecisionsLoading, setTeamDecisionsLoading] = useState(false);
  const [teamCoachingLoading, setTeamCoachingLoading]   = useState(false);
  const [managersLoading, setManagersLoading]           = useState(false);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);

  // Guidance (GM coaching queue)
  const [guidanceActiveId, setGuidanceActiveId]     = useState(null);
  const [guidanceText, setGuidanceText]             = useState("");
  const [guidanceSubmittingId, setGuidanceSubmittingId] = useState(null);

  // Team / manager data
  const [teamDecisions, setTeamDecisions]                   = useState([]);
  const [teamCoachingRequests, setTeamCoachingRequests]     = useState([]);
  const [managers, setManagers]                             = useState([]);
  const [selectedManager, setSelectedManager]               = useState(null);
  const [selectedManagerDecisions, setSelectedManagerDecisions] = useState([]);
  const [selectedManagerCoaching, setSelectedManagerCoaching]   = useState([]);
  const [managerFileTab, setManagerFileTab]                 = useState(null);

  // My Logs
  const [myLogType, setMyLogType]     = useState(null);
  const [myDecisions, setMyDecisions] = useState([]);
  const [myCoaching, setMyCoaching]   = useState([]);
  const [myLogsLoading, setMyLogsLoading] = useState(false);

  // Mobile nav
  const [isMobile, setIsMobile]         = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Facilities — new simplified flow
  const [facilities, setFacilities]           = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesMessage, setFacilitiesMessage] = useState("");
  const [selectedFacility, setSelectedFacility]   = useState(null);

  // All people inside the selected facility (GMs + Managers)
  const [facilityPeople, setFacilityPeople]           = useState([]);
  const [facilityPeopleLoading, setFacilityPeopleLoading] = useState(false);

  // Person file (click to open)
  const [selectedPerson, setSelectedPerson]       = useState(null);
  const [personDecisions, setPersonDecisions]     = useState([]);
  const [personCoaching, setPersonCoaching]       = useState([]);
  const [personFileLoading, setPersonFileLoading] = useState(false);
  const [personFileTab, setPersonFileTab]         = useState("decisions");

  // Animated score values for Facilities (Area Manager)
  const [scoreValues, setScoreValues] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  // Animated score values for GM performance snapshot
  const [gmScoreValues, setGmScoreValues] = useState({ pr: 0, pas: 0, tpr: 0 });
  // Animated values for AM Policy Compliance Dashboard
  const [amComplianceValues, setAmComplianceValues] = useState({ pas: 0, ppd: 0, pulls: 0 });

  // ─── Role flags ───────────────────────────────────────────────────────────

  const currentRoleLevel = useMemo(() => ROLE_LEVELS[profile?.role] || 1, [profile]);
  const isAreaManager   = profile?.role === "Area Manager";
  const isGeneralManager = profile?.role === "General Manager";
  const isAreaCoach     = profile?.role === "Area Coach";

  // Only Managers can request coaching
  const canRequestCoaching   = profile?.role === "Manager";
  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const canViewFacilities    = isAreaManager || isAreaCoach;
  const nextRole             = getNextRole(profile?.role);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Load user + profile
  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) { window.location.href = "/"; return; }
        setUser(user);
        const { data: prof } = await supabase
          .from("profiles").select("id, full_name, role, company").eq("id", user.id).maybeSingle();
        setProfile(prof || null);
      } catch (e) {
        console.error("Dashboard load:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-detect category
  useEffect(() => {
    if (categoryManuallySet) return;
    const detected = detectCategory(decisionSituation, decisionAction);
    if (detected) setDecisionCategory(detected);
  }, [decisionSituation, decisionAction, categoryManuallySet]);

  // Load leadership data when profile is ready
  useEffect(() => {
    if (!profile?.company || !profile?.role || !canViewLeadershipTabs) return;
    fetchTeamDecisions();
    fetchTeamCoachingRequests();
    fetchManagers();
  }, [profile?.company, profile?.role, canViewLeadershipTabs]);

  // Animate AM facility score cards when a facility is selected
  useEffect(() => {
    if (!selectedFacility) { setScoreValues({ pr: 0, pas: 0, tpr: 0, ppd: 0 }); return; }
    setScoreValues({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
    const duration = 1600;
    const start = performance.now();
    let raf;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setScoreValues({
        pr:  parseFloat((eased * 78).toFixed(1)),
        pas: parseFloat((eased * 85).toFixed(1)),
        tpr: parseFloat((eased * 91).toFixed(1)),
        ppd: parseFloat((eased * 4.2).toFixed(2)),
      });
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [selectedFacility?.facility_number, selectedFacility?.company]);

  // Animate GM performance snapshot on load
  useEffect(() => {
    if (!isGeneralManager) return;
    setGmScoreValues({ pr: 0, pas: 0, tpr: 0 });
    const duration = 1600;
    const start = performance.now();
    let raf;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setGmScoreValues({
        pr:  parseFloat((eased * 74).toFixed(1)),
        pas: parseFloat((eased * 88).toFixed(1)),
        tpr: parseFloat((eased * 82).toFixed(1)),
      });
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isGeneralManager]);

  // Default tab for Area Manager: Policy Compliance Dashboard
  useEffect(() => {
    if (isAreaManager) setActiveTab(TABS.compliance);
  }, [isAreaManager]);

  // Animate AM Policy Compliance Dashboard when tab becomes active
  useEffect(() => {
    if (!isAreaManager || activeTab !== TABS.compliance) return;
    setAmComplianceValues({ pas: 0, ppd: 0, pulls: 0 });
    const duration = 1600;
    const start = performance.now();
    let raf;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAmComplianceValues({
        pas:   parseFloat((eased * AM_COMPLIANCE_MOCK.pas).toFixed(1)),
        ppd:   parseFloat((eased * AM_COMPLIANCE_MOCK.ppd).toFixed(2)),
        pulls: Math.round(eased * AM_COMPLIANCE_MOCK.totalPulls),
      });
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isAreaManager, activeTab]);

  // ─── Data fetchers ────────────────────────────────────────────────────────

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  const handlePullPolicy = () => {
    if (!policyText.trim()) { setPolicyMessage("Please describe the situation first."); return; }
    setPolicyMessage("Policy AI connection coming soon.");
  };

  const handleDecisionSubmit = async () => {
    setDecisionMessage("");
    if (!decisionSituation.trim() || !decisionAction.trim()) {
      setDecisionMessage("Please enter both the situation and action taken.");
      return;
    }
    if (!user) { setDecisionMessage("You must be logged in."); return; }
    setDecisionLoading(true);
    try {
      const base = {
        user_id: user.id, company: profile?.company || null,
        user_name: profile?.full_name || "Unknown", user_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager", visible_to_role: nextRole,
        situation: decisionSituation.trim(), action_taken: decisionAction.trim(),
        policy_referenced: decisionPolicy.trim() || null, is_read: false,
      };
      const { error: e1 } = await supabase.from("decision_logs").insert([{ ...base, category: decisionCategory || null }]);
      if (e1) {
        const { error: e2 } = await supabase.from("decision_logs").insert([{ ...base, reasoning: decisionCategory || null }]);
        if (e2) throw e2;
      }
      setDecisionSituation(""); setDecisionAction(""); setDecisionCategory("");
      setCategoryManuallySet(false); setDecisionPolicy("");
      setDecisionMessage("Decision submitted successfully.");
    } catch (e) {
      setDecisionMessage(e.message || "Failed to submit.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleCoachingSubmit = async () => {
    setCoachingMessage("");
    if (!coachingText.trim()) { setCoachingMessage("Please describe the support you need."); return; }
    if (!user) { setCoachingMessage("You must be logged in."); return; }
    setCoachingLoading(true);
    try {
      const { error } = await supabase.from("coaching_requests").insert([{
        user_id: user.id, company: profile?.company || null,
        requester_name: profile?.full_name || "Unknown", requester_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager", visible_to_role: nextRole,
        request_text: coachingText.trim(), status: "open",
      }]);
      if (error) throw error;
      setCoachingText(""); setCoachingMessage("Coaching request submitted.");
    } catch (e) {
      setCoachingMessage(e.message || "Failed to submit.");
    } finally {
      setCoachingLoading(false);
    }
  };

  const fetchTeamDecisions = async () => {
    if (!profile?.company || !profile?.role) return;
    setTeamDecisionsLoading(true); setTeamDecisionsMessage("");
    try {
      const { data, error } = await supabase.from("decision_logs").select("*")
        .eq("company", profile.company).eq("visible_to_role", profile.role)
        .eq("is_read", false).neq("user_id", user?.id || "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTeamDecisions(data || []);
    } catch (e) { setTeamDecisionsMessage(e.message || "Failed to load."); }
    finally { setTeamDecisionsLoading(false); }
  };

  const fetchTeamCoachingRequests = async () => {
    if (!profile?.company || !profile?.role) return;
    setTeamCoachingLoading(true); setTeamCoachingMessage("");
    try {
      const { data, error } = await supabase.from("coaching_requests").select("*")
        .eq("company", profile.company).eq("visible_to_role", profile.role)
        .neq("user_id", user?.id || "")
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTeamCoachingRequests(data || []);
    } catch (e) { setTeamCoachingMessage(e.message || "Failed to load."); }
    finally { setTeamCoachingLoading(false); }
  };

  const fetchManagers = async () => {
    if (!profile?.company) return;
    setManagersLoading(true); setManagersMessage("");
    try {
      const { data, error } = await supabase.from("profiles").select("id, full_name, role, company")
        .eq("company", profile.company).eq("role", "Manager").order("full_name");
      if (error) throw error;
      setManagers(data || []);
    } catch (e) { setManagersMessage(e.message || "Failed to load."); }
    finally { setManagersLoading(false); }
  };

  const openManagerFile = async (manager) => {
    setSelectedManager(manager); setSelectedManagerLoading(true);
    setManagersMessage(""); setManagerFileTab(null);
    try {
      const [{ data: d }, { data: c }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
      ]);
      setSelectedManagerDecisions(d || []); setSelectedManagerCoaching(c || []);
    } catch (e) { setManagersMessage(e.message || "Failed to open file."); }
    finally { setSelectedManagerLoading(false); }
  };

  const markDecisionAsRead = async (id, userId) => {
    try {
      const { error } = await supabase.from("decision_logs")
        .update({ is_read: true, read_at: new Date().toISOString(), read_by: user.id }).eq("id", id);
      if (error) throw error;
      await fetchTeamDecisions();
      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase.from("profiles").select("id, full_name, role, company").eq("id", userId).maybeSingle();
        mgr = data;
      }
      if (mgr) { setActiveTab(TABS.managers); await openManagerFile(mgr); }
    } catch (e) { setTeamDecisionsMessage(e.message || "Failed to mark as read."); }
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
        status: "resolved",
      }).eq("id", requestId);
      if (error) throw error;
      setGuidanceActiveId(null); setGuidanceText("");
      await fetchTeamCoachingRequests();
      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase.from("profiles").select("id, full_name, role, company").eq("id", userId).maybeSingle();
        mgr = data;
      }
      if (mgr) { setActiveTab(TABS.managers); await openManagerFile(mgr); }
    } catch (e) { setTeamCoachingMessage(e.message || "Failed to save guidance."); }
    finally { setGuidanceSubmittingId(null); }
  };

  // ─── Facilities fetchers (new simplified, no gm_manager_assignments) ──────

  const fetchFacilities = async () => {
    if (!user) return;
    setFacilitiesLoading(true); setFacilitiesMessage("");
    setSelectedFacility(null); setFacilityPeople([]); setSelectedPerson(null);
    try {
      const { data, error } = await supabase
        .from("area_manager_facilities")
        .select("facility_number, company")
        .eq("area_manager_id", user.id);
      if (error) throw error;
      setFacilities(data || []);
      if ((data || []).length === 0) setFacilitiesMessage("No facilities assigned to your account.");
    } catch (e) {
      setFacilitiesMessage(e.message || "Failed to load facilities.");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  // Fetch ALL people in a facility (GMs + Managers) — no gm_manager_assignments needed
  const fetchFacilityPeople = async (facility) => {
    setSelectedFacility(facility);
    setSelectedPerson(null); setPersonDecisions([]); setPersonCoaching([]);
    setFacilityPeople([]); setFacilityPeopleLoading(true); setFacilitiesMessage("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, company, facility_number")
        .eq("company", facility.company)
        .eq("facility_number", facility.facility_number)
        .in("role", ["General Manager", "Manager"])
        .order("role", { ascending: false }) // GMs first
        .order("full_name");
      if (error) throw error;
      setFacilityPeople(data || []);
      if ((data || []).length === 0)
        setFacilitiesMessage("No staff found in this facility.");
    } catch (e) {
      setFacilitiesMessage(e.message || "Failed to load people.");
    } finally {
      setFacilityPeopleLoading(false);
    }
  };

  // Open a person's full log file
  const openPersonFile = async (person) => {
    setSelectedPerson(person); setPersonFileLoading(true);
    setPersonDecisions([]); setPersonCoaching([]); setPersonFileTab("decisions");
    try {
      const [{ data: d, error: de }, { data: c, error: ce }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
      ]);
      if (de) throw de;
      if (ce) throw ce;
      setPersonDecisions(d || []); setPersonCoaching(c || []);
    } catch (e) {
      console.error("Open person file:", e);
    } finally {
      setPersonFileLoading(false);
    }
  };

  const fetchMyLogs = async () => {
    if (!user) return;
    setMyLogsLoading(true);
    try {
      const [{ data: d }, { data: c }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMyDecisions(d || []); setMyCoaching(c || []);
    } catch (e) { console.error("My logs:", e); }
    finally { setMyLogsLoading(false); }
  };

  const formatDate = (v) => {
    if (!v) return "Unknown date";
    try { return new Date(v).toLocaleString(); } catch { return v; }
  };

  // ─── Loading screen ────────────────────────────────────────────────────────

  if (loading) {
    return <div style={styles.page}><div style={styles.loadingCard}>Loading dashboard...</div></div>;
  }

  // ─── Nav items ────────────────────────────────────────────────────────────

  const navItems = [
    { tab: TABS.compliance,    label: "Policy Compliance",  show: isAreaManager },
    { divider: true,                                         show: isAreaManager },
    { tab: TABS.policy,        label: "Request Policy",     show: true },
    { tab: TABS.decision,      label: "Document Decision",  show: !isAreaManager },
    { tab: TABS.coaching,      label: "Request Coaching",   show: canRequestCoaching },
    { divider: true,                                         show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamDecisions, label: "Team Decisions",     show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamCoaching,  label: "Team Coaching",      show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.managers,      label: "Managers",           show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchManagers },
    { divider: true,                                         show: canViewFacilities },
    { tab: TABS.facilities,    label: "Facilities",         show: canViewFacilities, onEnter: fetchFacilities },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page" style={styles.page}>

      {/* ── Animations ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.2s ease both; }
        .nav-tab:hover { background: #1e293b !important; color: #f8fafc !important; }
        .person-row:hover { border-color: #334155 !important; background: #131f35 !important; }
      `}} />

      {/* ══════════════════════════════════════════════
          STICKY TOP NAV
      ══════════════════════════════════════════════ */}
      <header style={{ ...styles.topNav, padding: isMobile ? "14px 16px" : "12px 20px" }}>
        {/* Identity */}
        <div style={styles.topNavBrand}>
          <div style={{ ...styles.topNavName, fontSize: isMobile ? "17px" : "14px" }}>
            {profile?.full_name || "Dashboard"}
          </div>
          <div style={{ ...styles.topNavMeta, fontSize: isMobile ? "13px" : "11px", marginTop: isMobile ? "3px" : "1px" }}>
            {profile?.role} · {profile?.company}
          </div>
        </div>

        {/* Desktop nav tabs */}
        {!isMobile && (
          <nav style={styles.topNavItems}>
            {/* My Logs — hidden for Area Manager */}
            {!isAreaManager && (
              <>
                <button
                  className="nav-tab"
                  style={{ ...styles.topNavBtn, ...(activeTab === TABS.myLogs ? styles.topNavBtnActive : {}) }}
                  onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); }}
                >
                  My Logs
                </button>
                <div style={styles.topNavDivider} />
              </>
            )}
            {navItems.map((item, i) => {
              if (!item.show) return null;
              if (item.divider) return <div key={i} style={styles.topNavDivider} />;
              return (
                <button
                  key={item.tab}
                  className="nav-tab"
                  style={{ ...styles.topNavBtn, ...(activeTab === item.tab ? styles.topNavBtnActive : {}) }}
                  onClick={() => {
                    setActiveTab(item.tab);
                    if (item.onEnter) item.onEnter();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right actions */}
        <div style={styles.topNavRight}>
          {!isMobile ? (
            <button style={styles.topNavLogout} onClick={handleLogout}>Log Out</button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              {!isAreaManager && (
                <button style={styles.mobileMenuBtn} onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); setMobileMenuOpen(false); }}>
                  My Logs
                </button>
              )}
              <button style={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen((v) => !v)}>
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile dropdown ── */}
      {isMobile && mobileMenuOpen && (
        <div style={styles.mobileDropdown}>
          {navItems.map((item, i) => {
            if (!item.show) return null;
            if (item.divider) return <div key={i} style={styles.navDivider} />;
            return (
              <button
                key={item.tab}
                style={{ ...styles.navButton, ...(activeTab === item.tab ? styles.navButtonActive : {}) }}
                onClick={() => {
                  setActiveTab(item.tab);
                  if (item.onEnter) item.onEnter();
                  setMobileMenuOpen(false);
                }}
              >
                {item.label}
              </button>
            );
          })}
          <div style={styles.navDivider} />
          <button style={styles.logoutButton} onClick={handleLogout}>Log Out</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════ */}
      <main className="dashboard-main" style={styles.main}>

        {/* ════ GM Performance Snapshot (always visible for General Manager) ════ */}
        {isGeneralManager && (
          <div style={{ ...styles.scoreRow, gridTemplateColumns: "repeat(3, 1fr)" }} className="fade-up">
            {GM_SCORES.map((metric) => (
              <ScoreCard key={metric.key} metric={metric} value={gmScoreValues[metric.key] || 0} />
            ))}
          </div>
        )}

        {/* ════ Policy Compliance Dashboard (Area Manager only) ════ */}
        {activeTab === TABS.compliance && isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Policy Compliance Dashboard</h1>
              <p style={styles.subtitle}>Area-wide adherence, pull patterns, and documentation health.</p>
            </div>

            {/* ── Top metric row: PAS% · PP/D · Total Pulls ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }} className="fade-up">
              {/* Area PAS% */}
              <ScoreCard
                metric={{ label: "Area PAS%", unit: "%", desc: "Policy Adherence Score · Area-wide", decimal: false, max: 100 }}
                value={amComplianceValues.pas}
              />
              {/* Area PP/D */}
              <ScoreCard
                metric={{ label: "Area PP/D", unit: "x", desc: "Policy Pull to Documentation Ratio · /6", decimal: true, max: 6 }}
                value={amComplianceValues.ppd}
              />
              {/* Total policy pulls */}
              <div style={styles.scoreCard}>
                <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "10px" }}>
                  Pulls / Month
                </div>
                <div style={{ fontSize: "40px", fontWeight: 800, color: "#60a5fa", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {amComplianceValues.pulls}
                </div>
                <div style={{ background: "#1f2937", borderRadius: "999px", height: "4px", overflow: "hidden", margin: "12px 0 8px" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min((amComplianceValues.pulls / AM_COMPLIANCE_MOCK.totalPulls) * 100, 100)}%`,
                    background: "#60a5fa",
                    borderRadius: "999px",
                    transition: "background 0.3s, width 0.1s",
                  }} />
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>Total policy pulls this month</div>
              </div>
            </div>

            {/* ── Category breakdown ── */}
            <div style={styles.panelCard} className="fade-up">
              <div style={styles.sectionHeading}>Policy Pull Breakdown by Category</div>
              <p style={{ ...styles.subtitle, marginTop: "6px", marginBottom: "20px" }}>
                Distribution of policy pulls across categories this month.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {AM_COMPLIANCE_MOCK.categories.map((cat, idx) => {
                  const catColor = CATEGORY_COLORS[cat.label] || { color: "#94a3b8", border: "rgba(148,163,184,0.3)", bg: "rgba(148,163,184,0.1)" };
                  // Animate the bar width based on amComplianceValues.pulls progress proxy
                  const animatedPct = amComplianceValues.pulls > 0
                    ? parseFloat(((amComplianceValues.pulls / AM_COMPLIANCE_MOCK.totalPulls) * cat.pct).toFixed(1))
                    : 0;
                  return (
                    <div key={cat.label}>
                      {/* Label row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {idx === 0 && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
                              background: "rgba(251,191,36,0.12)", color: "#fbbf24",
                              border: "1px solid rgba(251,191,36,0.3)",
                              padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase",
                            }}>
                              Most Common
                            </span>
                          )}
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "3px 10px", borderRadius: "999px",
                            fontSize: "11px", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            background: catColor.bg, color: catColor.color, border: `1px solid ${catColor.border}`,
                          }}>
                            {cat.label}
                          </span>
                        </div>
                        <span style={{ fontSize: "20px", fontWeight: 800, color: catColor.color, fontVariantNumeric: "tabular-nums" }}>
                          {animatedPct.toFixed(0)}%
                        </span>
                      </div>
                      {/* Bar */}
                      <div style={{ background: "#1f2937", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(animatedPct, 100)}%`,
                          background: catColor.color,
                          borderRadius: "999px",
                          transition: "width 0.1s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════ Request Policy ════ */}
        {activeTab === TABS.policy && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Policy</h1>
              <p style={styles.subtitle}>Describe the situation and pull the applicable standard.</p>
            </div>
            <div style={styles.panelCard}>
              <label style={styles.label}>Describe situation for policy reference</label>
              <textarea
                value={policyText} onChange={(e) => setPolicyText(e.target.value)}
                placeholder="Example: An employee showed up 30 minutes late without calling. What does company policy say I should do?"
                style={styles.textarea}
              />
              <button style={styles.primaryButton} onClick={handlePullPolicy}>Pull Policy</button>
              {policyMessage && <p style={styles.message}>{policyMessage}</p>}
            </div>
          </>
        )}

        {/* ════ Document Decision ════ */}
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

              <div style={{ borderTop: "1px solid #1f2937", margin: "4px 0 18px" }} />
              <label style={styles.label}>Category</label>
              <select
                value={decisionCategory}
                onChange={(e) => { setDecisionCategory(e.target.value); setCategoryManuallySet(true); }}
                style={styles.categorySelect}
              >
                <option value="">— Select a category —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {decisionCategory && !categoryManuallySet && (
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px", marginBottom: "12px" }}>
                  ✦ Auto-detected ·{" "}
                  <button
                    style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "12px", padding: 0 }}
                    onClick={() => setCategoryManuallySet(true)}
                  >Change manually</button>
                </div>
              )}

              <div style={{ borderTop: "1px solid #1f2937", margin: "18px 0 16px" }} />
              <input
                type="text" value={decisionPolicy} onChange={(e) => setDecisionPolicy(e.target.value)}
                placeholder="Policy referenced (optional)" style={styles.policyInput}
              />

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

        {/* ════ Request Coaching (Manager only) ════ */}
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

        {/* ════ My Logs ════ */}
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
                {myLogType && (
                  <button style={styles.secondaryButton} onClick={() => setMyLogType(null)}>← Back</button>
                )}
              </div>

              {myLogsLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : !myLogType ? (
                <div className="log-type-selector" style={styles.logTypeSelector}>
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
                  {myDecisions.length === 0 ? <p style={styles.message}>No decision logs yet.</p> :
                    myDecisions.map((item) => (
                      <DecisionCard key={item.id} item={{ ...item, user_name: formatDate(item.created_at) }} formatDate={formatDate} />
                    ))}
                </div>
              ) : (
                <div style={styles.cardList}>
                  {myCoaching.length === 0 ? <p style={styles.message}>No coaching requests yet.</p> :
                    myCoaching.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div style={styles.feedName}>{formatDate(item.created_at)}</div>
                          <span style={styles.statusBadge}>{item.status || "open"}</span>
                        </div>
                        <div style={styles.feedBody}>{item.request_text || "—"}</div>
                        {item.leadership_notes ? (
                          <div style={{ ...styles.feedSection, borderLeft: "3px solid #2563eb", paddingLeft: "12px", marginTop: "12px" }}>
                            <div style={{ ...styles.feedLabel, color: "#60a5fa" }}>GM Guidance</div>
                            <div style={styles.feedBody}>{item.leadership_notes}</div>
                          </div>
                        ) : (
                          <div style={{ ...styles.feedLabel, color: "#6b7280", marginTop: "12px" }}>Awaiting guidance</div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════ Team Decisions ════ */}
        {activeTab === TABS.teamDecisions && canViewLeadershipTabs && (
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
              {teamDecisionsLoading ? <p style={styles.message}>Loading...</p> :
                teamDecisions.length === 0 ? <p style={styles.message}>No unread team decisions.</p> : (
                  <div style={styles.cardList}>
                    {teamDecisions.map((item) => (
                      <DecisionCard
                        key={item.id} item={item} formatDate={formatDate}
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

        {/* ════ Team Coaching ════ */}
        {activeTab === TABS.teamCoaching && canViewLeadershipTabs && (
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
              {teamCoachingLoading ? <p style={styles.message}>Loading...</p> :
                teamCoachingRequests.length === 0 ? <p style={styles.message}>No open coaching requests.</p> : (
                  <div style={styles.cardList}>
                    {teamCoachingRequests.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div>
                            <div style={styles.feedName}>{item.requester_name || "Unknown"}</div>
                            <div style={styles.feedMeta}>{item.requester_role || "Manager"} · {item.company || ""}</div>
                          </div>
                          <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                        </div>
                        <div style={styles.statusRow}>
                          <span style={styles.statusBadge}>{item.status || "open"}</span>
                        </div>
                        <div style={styles.feedBody}>{item.request_text || "—"}</div>
                        {item.leadership_notes && (
                          <div style={{ ...styles.feedSection, borderLeft: "3px solid #2563eb", paddingLeft: "12px" }}>
                            <div style={{ ...styles.feedLabel, color: "#60a5fa" }}>Leadership Notes</div>
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
                                  disabled={guidanceSubmittingId === item.id || !guidanceText.trim()}>
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

        {/* ════ Managers ════ */}
        {activeTab === TABS.managers && canViewLeadershipTabs && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Managers</h1>
              <p style={styles.subtitle}>Review managers and open their documentation history.</p>
            </div>
            <div className="managers-layout" style={{ ...styles.managersLayout, gridTemplateColumns: isMobile ? "1fr" : "300px 1fr" }}>
              {/* Left: list */}
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Manager Directory</div>
                  <button style={styles.secondaryButton} onClick={fetchManagers}>Refresh</button>
                </div>
                {managersMessage && <p style={styles.message}>{managersMessage}</p>}
                {managersLoading ? <p style={styles.message}>Loading...</p> :
                  managers.length === 0 ? <p style={styles.message}>No managers found.</p> : (
                    <div style={styles.cardList}>
                      {managers.map((m) => (
                        <button key={m.id}
                          style={{ ...styles.managerRowButton, ...(selectedManager?.id === m.id ? styles.managerRowButtonActive : {}) }}
                          onClick={() => openManagerFile(m)}>
                          <div style={styles.managerRowName}>{m.full_name || "Unnamed"}</div>
                          <div style={styles.managerRowMeta}>{m.role} · {m.company}</div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Right: file */}
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>
                    {selectedManager
                      ? `${selectedManager.full_name} — ${managerFileTab === "decisions" ? "Decision Logs" : managerFileTab === "coaching" ? "Coaching Logs" : "Select Log Type"}`
                      : "Manager File"}
                  </div>
                  {managerFileTab && (
                    <button style={styles.secondaryButton} onClick={() => setManagerFileTab(null)}>← Back</button>
                  )}
                </div>

                {!selectedManager ? (
                  <p style={styles.message}>Select a manager to view their documentation.</p>
                ) : selectedManagerLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : !managerFileTab ? (
                  <div className="log-type-selector" style={styles.logTypeSelector}>
                    <button style={styles.logTypeButton} onClick={() => setManagerFileTab("decisions")}>
                      <div style={styles.logTypeTitle}>Decision Logs</div>
                      <div style={styles.logTypeMeta}>{selectedManagerDecisions.length} record{selectedManagerDecisions.length !== 1 ? "s" : ""}</div>
                    </button>
                    <button style={styles.logTypeButton} onClick={() => setManagerFileTab("coaching")}>
                      <div style={styles.logTypeTitle}>Coaching Logs</div>
                      <div style={styles.logTypeMeta}>{selectedManagerCoaching.length} record{selectedManagerCoaching.length !== 1 ? "s" : ""}</div>
                    </button>
                  </div>
                ) : managerFileTab === "decisions" ? (
                  <div style={styles.cardList}>
                    {selectedManagerDecisions.length === 0 ? <p style={styles.message}>No decision logs found.</p> :
                      selectedManagerDecisions.map((item) => (
                        <DecisionCard key={item.id}
                          item={{ ...item, user_name: formatDate(item.created_at), user_role: item.is_read ? "Read" : "Unread" }}
                          formatDate={formatDate} />
                      ))}
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {selectedManagerCoaching.length === 0 ? <p style={styles.message}>No coaching logs found.</p> :
                      selectedManagerCoaching.map((item) => (
                        <div key={item.id} style={styles.feedCard}>
                          <div style={styles.feedTop}>
                            <div style={styles.feedName}>{formatDate(item.created_at)}</div>
                            <span style={styles.statusBadge}>{item.status || "open"}</span>
                          </div>
                          <div style={styles.feedBody}>{item.request_text || "—"}</div>
                          {item.leadership_notes && (
                            <div style={{ ...styles.feedSection, borderLeft: "3px solid #2563eb", paddingLeft: "12px", marginTop: "12px" }}>
                              <div style={{ ...styles.feedLabel, color: "#60a5fa" }}>Operational Guidance</div>
                              <div style={styles.feedBody}>{item.leadership_notes}</div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════ Facilities ════ */}
        {activeTab === TABS.facilities && canViewFacilities && (
          <>
            {/* ── Header card with breadcrumb + facility selector ── */}
            <div style={styles.headerCard}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h1 style={styles.title}>Facilities</h1>
                  <p style={{ ...styles.subtitle, marginBottom: 0 }}>
                    {selectedPerson
                      ? `${selectedPerson.full_name} — ${selectedPerson.role}`
                      : selectedFacility
                      ? `Facility ${selectedFacility.facility_number} · ${selectedFacility.company}`
                      : "Select a facility to inspect performance and staff."}
                  </p>
                </div>
                {/* Back button */}
                {selectedPerson && (
                  <button style={styles.secondaryButton} onClick={() => { setSelectedPerson(null); setPersonDecisions([]); setPersonCoaching([]); }}>
                    ← Back to People
                  </button>
                )}
                {selectedFacility && !selectedPerson && (
                  <button style={styles.secondaryButton} onClick={() => { setSelectedFacility(null); setFacilityPeople([]); setFacilitiesMessage(""); }}>
                    ← All Facilities
                  </button>
                )}
              </div>

              {/* Breadcrumb */}
              {(selectedFacility || selectedPerson) && (
                <div style={styles.breadcrumb}>
                  <button style={styles.breadcrumbLink} onClick={() => { setSelectedFacility(null); setSelectedPerson(null); setFacilityPeople([]); }}>
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

              {/* Facility pill selector */}
              {!selectedFacility && (
                <div style={{ marginTop: "16px" }}>
                  {facilitiesLoading ? (
                    <p style={{ ...styles.message, marginTop: 0 }}>Loading facilities...</p>
                  ) : facilities.length === 0 ? (
                    <p style={{ ...styles.message, marginTop: 0 }}>{facilitiesMessage || "No facilities found."}</p>
                  ) : (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {facilities.map((f) => (
                        <button
                          key={`${f.company}-${f.facility_number}`}
                          onClick={() => fetchFacilityPeople(f)}
                          style={styles.facilityPill}
                        >
                          Facility {f.facility_number}
                          <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "6px" }}>{f.company}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {facilitiesMessage && !selectedFacility && <p style={styles.message}>{facilitiesMessage}</p>}

            {/* ── Animated score cards — shown when facility selected and no person open ── */}
            {selectedFacility && !selectedPerson && (
              <>
                <div style={styles.scoreRow} className="fade-up">
                  {AM_SCORES.map((metric) => (
                    <ScoreCard key={metric.key} metric={metric} value={scoreValues[metric.key] || 0} />
                  ))}
                </div>

                {/* ── Facility people list ── */}
                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Staff</div>
                    <button style={styles.secondaryButton} onClick={() => fetchFacilityPeople(selectedFacility)}>
                      Refresh
                    </button>
                  </div>
                  {facilitiesMessage && <p style={styles.message}>{facilitiesMessage}</p>}
                  {facilityPeopleLoading ? (
                    <p style={styles.message}>Loading staff...</p>
                  ) : facilityPeople.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <div style={{ fontSize: "28px", marginBottom: "10px" }}>👥</div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "#94a3b8" }}>No staff found</div>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                        Make sure profiles have the correct facility_number set in Supabase.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                      {facilityPeople.map((person) => (
                        <div
                          key={person.id}
                          className="person-row"
                          onClick={() => openPersonFile(person)}
                          style={styles.personRow}
                        >
                          <div>
                            <div style={styles.personName}>{person.full_name || "Unnamed"}</div>
                            <div style={styles.personMeta}>{person.role} · Facility {person.facility_number}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                              ...styles.statusBadge,
                              background: person.role === "General Manager" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)",
                              color: person.role === "General Manager" ? "#60a5fa" : "#a78bfa",
                              border: `1px solid ${person.role === "General Manager" ? "rgba(59,130,246,0.3)" : "rgba(139,92,246,0.3)"}`,
                            }}>
                              {person.role === "General Manager" ? "GM" : "MGR"}
                            </span>
                            <span style={{ color: "#6b7280", fontSize: "18px" }}>›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Person detail / log file ── */}
            {selectedPerson && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="fade-up">

                {/* Identity card */}
                <div style={{ ...styles.panelCard, borderColor: "#1e3a5f" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc" }}>{selectedPerson.full_name}</div>
                  <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                    {selectedPerson.role} · {selectedPerson.company} · Facility {selectedPerson.facility_number}
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", gap: "12px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#60a5fa" }}>{personDecisions.length}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>Decisions</div>
                    </div>
                    <div style={{ width: "1px", background: "#1f2937" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#a78bfa" }}>{personCoaching.length}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>Coaching</div>
                    </div>
                  </div>
                </div>

                {personFileLoading ? (
                  <div style={styles.panelCard}><p style={styles.message}>Loading logs...</p></div>
                ) : (
                  <div style={styles.panelCard}>
                    {/* Tab row */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                      {[
                        { key: "decisions", label: "Decision Logs",    count: personDecisions.length },
                        { key: "coaching",  label: "Coaching Logs",    count: personCoaching.length },
                      ].map(({ key, label, count }) => (
                        <button
                          key={key}
                          onClick={() => setPersonFileTab(key)}
                          style={{
                            flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                            border: `1px solid ${personFileTab === key ? "#3b82f6" : "#1f2937"}`,
                            background: personFileTab === key ? "rgba(59,130,246,0.1)" : "transparent",
                            color: personFileTab === key ? "#60a5fa" : "#6b7280",
                            fontSize: "13px", fontWeight: 600, transition: "all 0.15s ease",
                          }}
                        >
                          {label} <span style={{ opacity: 0.7, fontSize: "11px" }}>({count})</span>
                        </button>
                      ))}
                    </div>

                    {/* Decision logs */}
                    {personFileTab === "decisions" && (
                      personDecisions.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: "13px", color: "#6b7280" }}>No decision logs on record.</div>
                        </div>
                      ) : (
                        <div style={styles.cardList}>
                          {personDecisions.map((item) => (
                            <DecisionCard key={item.id}
                              item={{ ...item, user_name: formatDate(item.created_at) }}
                              formatDate={formatDate} />
                          ))}
                        </div>
                      )
                    )}

                    {/* Coaching logs */}
                    {personFileTab === "coaching" && (
                      personCoaching.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: "13px", color: "#6b7280" }}>No coaching logs on record.</div>
                        </div>
                      ) : (
                        <div style={styles.cardList}>
                          {personCoaching.map((item) => (
                            <div key={item.id} style={styles.feedCard}>
                              <div style={styles.feedTop}>
                                <div style={styles.feedName}>{formatDate(item.created_at)}</div>
                                <span style={styles.statusBadge}>{item.status || "open"}</span>
                              </div>
                              <div style={styles.feedBody}>{item.request_text || "—"}</div>
                              {item.leadership_notes && (
                                <div style={{ ...styles.feedSection, borderLeft: "3px solid #2563eb", paddingLeft: "12px", marginTop: "12px" }}>
                                  <div style={{ ...styles.feedLabel, color: "#60a5fa" }}>Guidance Given</div>
                                  <div style={styles.feedBody}>{item.leadership_notes}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e5e7eb",
    boxSizing: "border-box",
    overflowX: "hidden",
    maxWidth: "100vw",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  // ── Top nav ──────────────────────────────────────────────────────────────
  topNav: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "#111827", borderBottom: "1px solid #1f2937",
    padding: "12px 20px", position: "sticky", top: 0, zIndex: 100,
    flexWrap: "wrap",
  },
  topNavBrand: { display: "flex", flexDirection: "column", flexShrink: 0, marginRight: "8px" },
  topNavName:  { fontSize: "14px", fontWeight: 700, color: "#f8fafc", lineHeight: 1.2 },
  topNavMeta:  { fontSize: "11px", color: "#6b7280", marginTop: "1px" },
  topNavItems: { display: "flex", alignItems: "center", gap: "2px", flex: 1, flexWrap: "wrap" },
  topNavDivider: { width: "1px", height: "18px", background: "#1f2937", margin: "0 4px", flexShrink: 0 },
  topNavBtn: {
    padding: "6px 12px", borderRadius: "8px", border: "1px solid transparent",
    background: "transparent", color: "#94a3b8", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
  },
  topNavBtnActive: { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" },
  topNavRight:  { marginLeft: "auto", flexShrink: 0 },
  topNavLogout: {
    padding: "6px 12px", borderRadius: "8px", border: "1px solid #243041",
    background: "transparent", color: "#6b7280", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
  // ── Mobile ───────────────────────────────────────────────────────────────
  mobileMenuBtn: {
    background: "transparent", border: "1px solid #334155", color: "#e5e7eb",
    padding: "7px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600,
  },
  mobileDropdown: {
    background: "#111827", borderBottom: "1px solid #1f2937",
    padding: "10px 16px", display: "flex", flexDirection: "column", gap: "6px",
  },
  navGroup:   { display: "flex", flexDirection: "column", gap: "6px" },
  navDivider: { height: "1px", background: "#1f2937", margin: "4px 0" },
  navButton:  {
    width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #1f2937",
    background: "#111827", color: "#e5e7eb", fontSize: "14px", fontWeight: 600,
    textAlign: "left", cursor: "pointer",
  },
  navButtonActive: { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" },
  logoutButton: {
    width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #243041",
    background: "transparent", color: "#cbd5e1", fontSize: "14px", fontWeight: 600, cursor: "pointer",
  },
  // ── Layout ───────────────────────────────────────────────────────────────
  main: {
    display: "flex", flexDirection: "column", gap: "18px",
    maxWidth: "960px", margin: "0 auto", width: "100%",
    padding: "24px 24px 48px", boxSizing: "border-box",
  },
  managersLayout: { display: "grid", gridTemplateColumns: "300px 1fr", gap: "18px" },
  // ── Cards ─────────────────────────────────────────────────────────────
  headerCard: { background: "#111827", border: "1px solid #1f2937", borderRadius: "20px", padding: "24px" },
  panelCard:  { background: "#111827", border: "1px solid #1f2937", borderRadius: "20px", padding: "22px" },
  loadingCard: {
    maxWidth: "500px", margin: "120px auto", background: "#111827",
    border: "1px solid #1f2937", borderRadius: "20px", padding: "32px",
    textAlign: "center", fontSize: "17px", color: "#e5e7eb",
  },
  // ── Score cards ───────────────────────────────────────────────────────
  scoreRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  scoreCard: {
    background: "#111827", border: "1px solid #1f2937", borderRadius: "16px",
    padding: "20px 16px",
  },
  // ── Facility people ───────────────────────────────────────────────────
  facilityPill: {
    padding: "8px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: 600,
    border: "1px solid #1f2937", background: "#0f172a", color: "#e5e7eb",
    cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
  },
  personRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderRadius: "14px", border: "1px solid #1f2937",
    background: "#0f172a", cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
  },
  personName: { fontSize: "15px", fontWeight: 700, color: "#f8fafc", marginBottom: "3px" },
  personMeta: { fontSize: "12px", color: "#6b7280" },
  // ── Typography ────────────────────────────────────────────────────────
  title:    { margin: 0, fontSize: "32px", lineHeight: 1.05, fontWeight: 700, color: "#f8fafc" },
  subtitle: { marginTop: "8px", marginBottom: 0, fontSize: "14px", color: "#94a3b8", lineHeight: 1.6 },
  label:    { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600, color: "#e5e7eb" },
  message:  { marginTop: "10px", fontSize: "13px", color: "#94a3b8" },
  // ── Inputs ────────────────────────────────────────────────────────────
  textarea: {
    width: "100%", minHeight: "190px", borderRadius: "14px", border: "1px solid #273449",
    background: "#0f172a", color: "#f8fafc", padding: "14px", fontSize: "14px",
    lineHeight: 1.6, outline: "none", resize: "vertical", marginBottom: "14px", boxSizing: "border-box",
  },
  textareaSmall: {
    width: "100%", minHeight: "96px", borderRadius: "14px", border: "1px solid #273449",
    background: "#0f172a", color: "#f8fafc", padding: "14px", fontSize: "14px",
    lineHeight: 1.6, outline: "none", resize: "vertical", marginBottom: "14px", boxSizing: "border-box",
  },
  categorySelect: {
    width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1px solid #273449",
    background: "#0f172a", color: "#f8fafc", fontSize: "14px", outline: "none",
    cursor: "pointer", marginBottom: "4px", boxSizing: "border-box", appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px",
  },
  policyInput: {
    padding: "10px 12px", borderRadius: "10px", border: "1px solid #1f2937",
    backgroundColor: "#0f172a", color: "#cbd5e1", fontSize: "13px",
    width: "100%", outline: "none", boxSizing: "border-box",
  },
  // ── Buttons ───────────────────────────────────────────────────────────
  primaryButton: {
    padding: "12px 20px", borderRadius: "12px", border: "1px solid #334155",
    background: "#1e293b", color: "#f8fafc", fontSize: "14px", fontWeight: 600, cursor: "pointer",
  },
  secondaryButton: {
    padding: "8px 14px", borderRadius: "10px", border: "1px solid #334155",
    background: "#0f172a", color: "#e5e7eb", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
  buttonDisabled: { opacity: 0.65, cursor: "not-allowed" },
  // ── Feed / log cards ──────────────────────────────────────────────────
  cardList: { display: "flex", flexDirection: "column", gap: "12px" },
  feedCard: { background: "#0f172a", border: "1px solid #1f2937", borderRadius: "16px", padding: "16px" },
  feedTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" },
  feedName: { fontSize: "15px", fontWeight: 700, color: "#f8fafc", marginBottom: "3px" },
  feedMeta: { fontSize: "12px", color: "#94a3b8" },
  feedDate: { fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 },
  feedSection: { marginTop: "10px" },
  feedLabel: { fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "4px" },
  feedBody: { fontSize: "14px", lineHeight: 1.6, color: "#e5e7eb", whiteSpace: "pre-wrap" },
  statusRow: { marginBottom: "8px" },
  statusBadge: {
    display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px",
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155",
  },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" },
  policyTag: {
    padding: "3px 10px", borderRadius: "6px", border: "1px solid #1e3a5f",
    backgroundColor: "#0c1e35", color: "#60a5fa", fontSize: "12px", display: "inline-block",
  },
  // ── Guidance ──────────────────────────────────────────────────────────
  guidancePrompt: { display: "flex", flexDirection: "column", gap: "10px", width: "100%" },
  guidanceTextarea: {
    width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155",
    backgroundColor: "#0f172a", color: "#e5e7eb", fontSize: "14px",
    resize: "vertical", minHeight: "90px", outline: "none", boxSizing: "border-box",
  },
  guidanceButtons: { display: "flex", gap: "10px" },
  // ── Manager file ──────────────────────────────────────────────────────
  sectionTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" },
  sectionHeading: { fontSize: "17px", fontWeight: 700, color: "#f8fafc" },
  managerRowButton: {
    width: "100%", textAlign: "left", borderRadius: "12px", border: "1px solid #1f2937",
    background: "#0f172a", padding: "12px 14px", cursor: "pointer",
  },
  managerRowButtonActive: { border: "1px solid #334155", background: "#162033" },
  managerRowName: { fontSize: "14px", fontWeight: 700, color: "#f8fafc", marginBottom: "3px" },
  managerRowMeta: { fontSize: "12px", color: "#94a3b8" },
  // ── Log type selector ─────────────────────────────────────────────────
  logTypeSelector: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "8px" },
  logTypeButton: {
    padding: "22px 18px", borderRadius: "16px", border: "1px solid #1f2937",
    background: "#0f172a", color: "#e5e7eb", cursor: "pointer", textAlign: "left",
    transition: "border-color 0.15s ease",
  },
  logTypeTitle: { fontSize: "17px", fontWeight: 700, color: "#f8fafc", marginBottom: "6px" },
  logTypeMeta:  { fontSize: "13px", color: "#94a3b8" },
  // ── Breadcrumb ────────────────────────────────────────────────────────
  breadcrumb:       { display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", flexWrap: "wrap" },
  breadcrumbLink:   { background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "13px", padding: 0 },
  breadcrumbSep:    { color: "#4b5563", fontSize: "13px" },
  breadcrumbCurrent:{ fontSize: "13px", color: "#94a3b8" },
};
