import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = {
  policy: "policy",
  decision: "decision",
  coaching: "coaching",
  myLogs: "my_logs",
  teamDecisions: "team_decisions",
  teamCoaching: "team_coaching",
  managers: "managers",
  facilities: "facilities",
};

const ROLE_LEVELS = {
  Manager: 1,
  "General Manager": 2,
  "Area Coach": 3,
  "Area Manager": 3,
};

const CATEGORIES = ["HR", "Operations", "Food Safety"];

// Local keyword map — works before Supabase table is seeded
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

// Auto-detect category from free text
function detectCategory(situation = "", action = "") {
  const text = `${situation} ${action}`.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best; // null if nothing matched
}

// Resolve category from a log row — forward-compat with new column, backward-compat with reasoning
function resolveCategory(item) {
  return item.category || item.reasoning || null;
}

function getNextRole(role) {
  if (role === "Manager") return "General Manager";
  if (role === "General Manager") return "Area Coach";
  return null;
}

// ─── Category badge chip ───────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  HR: { bg: "rgba(139,92,246,0.13)", color: "#a78bfa", border: "rgba(139,92,246,0.35)" },
  Operations: { bg: "rgba(59,130,246,0.13)", color: "#60a5fa", border: "rgba(59,130,246,0.35)" },
  "Food Safety": { bg: "rgba(34,197,94,0.13)", color: "#4ade80", border: "rgba(34,197,94,0.35)" },
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
      marginTop: "10px",
    }}>
      {cat}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TABS.policy);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [policyText, setPolicyText] = useState("");
  const [decisionSituation, setDecisionSituation] = useState("");
  const [decisionAction, setDecisionAction] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [decisionPolicy, setDecisionPolicy] = useState("");
  const [coachingText, setCoachingText] = useState("");

  // Messages
  const [policyMessage, setPolicyMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [coachingMessage, setCoachingMessage] = useState("");
  const [teamDecisionsMessage, setTeamDecisionsMessage] = useState("");
  const [teamCoachingMessage, setTeamCoachingMessage] = useState("");
  const [managersMessage, setManagersMessage] = useState("");

  // Loading flags
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [teamDecisionsLoading, setTeamDecisionsLoading] = useState(false);
  const [teamCoachingLoading, setTeamCoachingLoading] = useState(false);
  const [managersLoading, setManagersLoading] = useState(false);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);

  // Guidance
  const [guidanceActiveId, setGuidanceActiveId] = useState(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [guidanceSubmittingId, setGuidanceSubmittingId] = useState(null);

  // Team data
  const [teamDecisions, setTeamDecisions] = useState([]);
  const [teamCoachingRequests, setTeamCoachingRequests] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedManagerDecisions, setSelectedManagerDecisions] = useState([]);
  const [selectedManagerCoaching, setSelectedManagerCoaching] = useState([]);
  const [managerFileTab, setManagerFileTab] = useState(null);

  // My Logs
  const [myLogType, setMyLogType] = useState(null);
  const [myDecisions, setMyDecisions] = useState([]);
  const [myCoaching, setMyCoaching] = useState([]);
  const [myLogsLoading, setMyLogsLoading] = useState(false);

  // Mobile
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Facilities
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesMessage, setFacilitiesMessage] = useState("");
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityGMs, setFacilityGMs] = useState([]);
  const [facilityGMsLoading, setFacilityGMsLoading] = useState(false);
  const [selectedGM, setSelectedGM] = useState(null);
  const [gmDataLoading, setGmDataLoading] = useState(false);

  // GM detail — counts + manager profiles
  const [gmOwnDecisionCount, setGmOwnDecisionCount] = useState(0);
  const [gmOwnCoachingCount, setGmOwnCoachingCount] = useState(0);
  const [facilityManagerDetails, setFacilityManagerDetails] = useState([]);

  // Compliance animation
  const [complianceDisplay, setComplianceDisplay] = useState(0);

  // ─── Derived role flags ───────────────────────────────────────────────────

  const currentRoleLevel = useMemo(() => ROLE_LEVELS[profile?.role] || 1, [profile]);
  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const isAreaManager = profile?.role === "Area Manager";
  const isGeneralManager = profile?.role === "General Manager";
  const isAreaCoach = profile?.role === "Area Coach";
  // Coaching tab hidden for AM and GM
  const canRequestCoaching = !isAreaManager && !isGeneralManager;
  const canViewFacilities = isAreaManager || isAreaCoach;
  const nextRole = getNextRole(profile?.role);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) { window.location.href = "/"; return; }
        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, company")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) console.error("Profile load error:", profileError);
        setProfile(profileData || null);
      } catch (error) {
        console.error("Dashboard load error:", error);
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

  // Auto-detect category as user types (only if not manually set)
  useEffect(() => {
    if (categoryManuallySet) return;
    const detected = detectCategory(decisionSituation, decisionAction);
    if (detected) setDecisionCategory(detected);
  }, [decisionSituation, decisionAction, categoryManuallySet]);

  // Compliance counter animation
  useEffect(() => {
    if (!selectedGM || gmDataLoading) { setComplianceDisplay(0); return; }
    setComplianceDisplay(0);
    const target = 80; // 80/100 logs referencing policy
    const duration = 1800;
    const startTime = performance.now();
    let raf;
    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setComplianceDisplay(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [selectedGM?.id, gmDataLoading]);

  useEffect(() => {
    if (!profile?.company || !profile?.role || !canViewLeadershipTabs) return;
    fetchTeamDecisions();
    fetchTeamCoachingRequests();
    fetchManagers();
  }, [profile?.company, profile?.role, canViewLeadershipTabs]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handlePullPolicy = () => {
    if (!policyText.trim()) { setPolicyMessage("Please describe the situation first."); return; }
    setPolicyMessage("Policy AI connection comes next.");
  };

  const handleDecisionSubmit = async () => {
    setDecisionMessage("");
    if (!decisionSituation.trim() || !decisionAction.trim()) {
      setDecisionMessage("Please enter both the situation and the action taken.");
      return;
    }
    if (!user) { setDecisionMessage("You must be logged in."); return; }

    setDecisionLoading(true);
    try {
      // Backward-compat: write category to `category` if it exists, else fall back to `reasoning`
      // We attempt to insert with `category`; if the column doesn't exist Supabase returns an error
      // so we catch and retry with `reasoning`.
      const basePayload = {
        user_id: user.id,
        company: profile?.company || null,
        user_name: profile?.full_name || "Unknown User",
        user_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        situation: decisionSituation.trim(),
        action_taken: decisionAction.trim(),
        policy_referenced: decisionPolicy.trim() || null,
        is_read: false,
      };

      const { error: err1 } = await supabase
        .from("decision_logs")
        .insert([{ ...basePayload, category: decisionCategory || null }]);

      if (err1) {
        // Column probably doesn't exist yet — fall back to reasoning field
        const { error: err2 } = await supabase
          .from("decision_logs")
          .insert([{ ...basePayload, reasoning: decisionCategory || null }]);
        if (err2) throw err2;
      }

      setDecisionSituation("");
      setDecisionAction("");
      setDecisionCategory("");
      setCategoryManuallySet(false);
      setDecisionPolicy("");
      setDecisionMessage("Decision submitted successfully.");
    } catch (error) {
      console.error("Decision submit error:", error);
      setDecisionMessage(error.message || "Failed to submit decision.");
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
        user_id: user.id,
        company: profile?.company || null,
        requester_name: profile?.full_name || "Unknown User",
        requester_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        request_text: coachingText.trim(),
        status: "open",
      }]);
      if (error) throw error;
      setCoachingText("");
      setCoachingMessage("Coaching request submitted successfully.");
    } catch (error) {
      console.error("Coaching submit error:", error);
      setCoachingMessage(error.message || "Failed to submit coaching request.");
    } finally {
      setCoachingLoading(false);
    }
  };

  const fetchTeamDecisions = async () => {
    if (!profile?.company || !profile?.role) return;
    setTeamDecisionsLoading(true);
    setTeamDecisionsMessage("");
    try {
      const { data, error } = await supabase
        .from("decision_logs")
        .select("*")
        .eq("company", profile.company)
        .eq("visible_to_role", profile.role)
        .eq("is_read", false)
        .neq("user_id", user?.id || "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTeamDecisions(data || []);
    } catch (error) {
      setTeamDecisionsMessage(error.message || "Failed to load team decisions.");
    } finally {
      setTeamDecisionsLoading(false);
    }
  };

  const fetchTeamCoachingRequests = async () => {
    if (!profile?.company || !profile?.role) return;
    setTeamCoachingLoading(true);
    setTeamCoachingMessage("");
    try {
      const { data, error } = await supabase
        .from("coaching_requests")
        .select("*")
        .eq("company", profile.company)
        .eq("visible_to_role", profile.role)
        .neq("user_id", user?.id || "")
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTeamCoachingRequests(data || []);
    } catch (error) {
      setTeamCoachingMessage(error.message || "Failed to load team coaching requests.");
    } finally {
      setTeamCoachingLoading(false);
    }
  };

  const fetchManagers = async () => {
    if (!profile?.company) return;
    setManagersLoading(true);
    setManagersMessage("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, company")
        .eq("company", profile.company)
        .eq("role", "Manager")
        .order("full_name", { ascending: true });
      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      setManagersMessage(error.message || "Failed to load managers.");
    } finally {
      setManagersLoading(false);
    }
  };

  const openManagerFile = async (manager) => {
    setSelectedManager(manager);
    setSelectedManagerLoading(true);
    setManagersMessage("");
    setManagerFileTab(null);
    try {
      const { data: decisionData, error: dErr } = await supabase
        .from("decision_logs").select("*").eq("user_id", manager.id).order("created_at", { ascending: false });
      if (dErr) throw dErr;

      const { data: coachingData, error: cErr } = await supabase
        .from("coaching_requests").select("*").eq("user_id", manager.id).order("created_at", { ascending: false });
      if (cErr) throw cErr;

      setSelectedManagerDecisions(decisionData || []);
      setSelectedManagerCoaching(coachingData || []);
    } catch (error) {
      setManagersMessage(error.message || "Failed to open manager file.");
    } finally {
      setSelectedManagerLoading(false);
    }
  };

  const markDecisionAsRead = async (id, userId) => {
    try {
      const { error } = await supabase
        .from("decision_logs")
        .update({ is_read: true, read_at: new Date().toISOString(), read_by: user.id })
        .eq("id", id);
      if (error) throw error;
      await fetchTeamDecisions();

      let manager = managers.find((m) => m.id === userId);
      if (!manager) {
        const { data } = await supabase
          .from("profiles").select("id, full_name, role, company").eq("id", userId).maybeSingle();
        manager = data;
      }
      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (error) {
      setTeamDecisionsMessage(error.message || "Failed to mark as read.");
    }
  };

  const handleGiveGuidance = async (requestId, userId) => {
    if (!guidanceText.trim()) return;
    setGuidanceSubmittingId(requestId);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("coaching_requests").update({
        leadership_notes: guidanceText.trim(),
        guidance_response: guidanceText.trim(),
        guidance_given: true,
        guidance_given_at: now,
        guidance_given_by: user.id,
        sent_to_manager_file: true,
        sent_to_manager_file_at: now,
        sent_to_manager_file_by: user.id,
        status: "resolved",
      }).eq("id", requestId);
      if (error) throw error;

      setGuidanceActiveId(null);
      setGuidanceText("");
      await fetchTeamCoachingRequests();

      let manager = managers.find((m) => m.id === userId);
      if (!manager) {
        const { data } = await supabase
          .from("profiles").select("id, full_name, role, company").eq("id", userId).maybeSingle();
        manager = data;
      }
      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (error) {
      setTeamCoachingMessage(error.message || "Failed to save guidance.");
    } finally {
      setGuidanceSubmittingId(null);
    }
  };

  const fetchFacilities = async () => {
    if (!user) return;
    setFacilitiesLoading(true);
    setFacilitiesMessage("");
    setSelectedFacility(null);
    setSelectedGM(null);
    try {
      const { data, error } = await supabase
        .from("area_manager_facilities")
        .select("facility_number, company")
        .eq("area_manager_id", user.id);
      if (error) throw error;
      setFacilities(data || []);
      if ((data || []).length === 0) setFacilitiesMessage("No facilities assigned to your account.");
    } catch (err) {
      setFacilitiesMessage(err.message || "Failed to load facilities.");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const fetchFacilityGMs = async (facility) => {
    setSelectedFacility(facility);
    setSelectedGM(null);
    setFacilityGMs([]);
    setFacilityGMsLoading(true);
    setFacilitiesMessage("");
    setGmOwnDecisionCount(0);
    setGmOwnCoachingCount(0);
    setFacilityManagerDetails([]);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, company, facility_number")
        .eq("role", "General Manager")
        .eq("company", facility.company)
        .eq("facility_number", facility.facility_number);
      if (error) throw error;
      setFacilityGMs(data || []);
      if ((data || []).length === 0) setFacilitiesMessage("No General Managers found in this facility.");
    } catch (err) {
      setFacilitiesMessage(err.message || "Failed to load GMs.");
    } finally {
      setFacilityGMsLoading(false);
    }
  };

  const fetchGMData = async (gm) => {
    setSelectedGM(gm);
    setGmDataLoading(true);
    setGmOwnDecisionCount(0);
    setGmOwnCoachingCount(0);
    setFacilityManagerDetails([]);
    setFacilitiesMessage("");

    try {
      // 1. GM's own submissions
      const [{ count: gmDecCount }, { count: gmCoachCount }] = await Promise.all([
        supabase.from("decision_logs").select("id", { count: "exact", head: true }).eq("user_id", gm.id),
        supabase.from("coaching_requests").select("id", { count: "exact", head: true }).eq("user_id", gm.id),
      ]);
      setGmOwnDecisionCount(gmDecCount || 0);
      setGmOwnCoachingCount(gmCoachCount || 0);

      // 2. Managers assigned to this GM
      const { data: assignments, error: aErr } = await supabase
        .from("gm_manager_assignments")
        .select("manager_id")
        .eq("gm_id", gm.id);
      if (aErr) throw aErr;

      const managerIds = (assignments || []).map((a) => a.manager_id);
      if (managerIds.length === 0) {
        setFacilityManagerDetails([]);
        return;
      }

      // 3. Fetch manager profiles + their log counts in parallel
      const { data: managerProfiles, error: mpErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, company")
        .in("id", managerIds);
      if (mpErr) throw mpErr;

      const countResults = await Promise.all(
        managerIds.map(async (mid) => {
          const [{ count: dc }, { count: cc }] = await Promise.all([
            supabase.from("decision_logs").select("id", { count: "exact", head: true }).eq("user_id", mid),
            supabase.from("coaching_requests").select("id", { count: "exact", head: true }).eq("user_id", mid),
          ]);
          return { managerId: mid, decisionCount: dc || 0, coachingCount: cc || 0 };
        })
      );

      const details = (managerProfiles || []).map((p) => {
        const counts = countResults.find((r) => r.managerId === p.id) || {};
        return { ...p, decisionCount: counts.decisionCount || 0, coachingCount: counts.coachingCount || 0 };
      });
      setFacilityManagerDetails(details);
    } catch (err) {
      console.error("Fetch GM data error:", err);
      setFacilitiesMessage(err.message || "Failed to load GM data.");
    } finally {
      setGmDataLoading(false);
    }
  };

  const fetchMyLogs = async () => {
    if (!user) return;
    setMyLogsLoading(true);
    try {
      const [{ data: decisions }, { data: coaching }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMyDecisions(decisions || []);
      setMyCoaching(coaching || []);
    } catch (error) {
      console.error("Fetch my logs error:", error);
    } finally {
      setMyLogsLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "Unknown date";
    try { return new Date(value).toLocaleString(); } catch { return value; }
  };

  const navClick = (fn) => { fn(); if (isMobile) setMobileMenuOpen(false); };

  // ─── Loading screen ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading dashboard...</div>
      </div>
    );
  }

  // ─── Shared decision log card ──────────────────────────────────────────────

  const DecisionCard = ({ item, actions }) => (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{item.user_name || formatDate(item.created_at)}</div>
          {item.user_role && (
            <div style={styles.feedMeta}>{item.user_role} · {item.company || ""}</div>
          )}
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
        {item.policy_referenced && (
          <span style={styles.policyTag}>Policy: {item.policy_referenced}</span>
        )}
        {item.is_read === false && (
          <span style={{ ...styles.statusBadge, background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
            Unread
          </span>
        )}
      </div>

      {actions && <div style={styles.actionRow}>{actions}</div>}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  // Sidebar nav items helper
  const navItems = [
    { tab: TABS.policy, label: "Request Policy", show: true },
    { tab: TABS.decision, label: "Document Decision", show: true },
    { tab: TABS.coaching, label: "Request Coaching", show: canRequestCoaching },
    { divider: true, show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamDecisions, label: "Team Decisions", show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamCoaching, label: "Team Coaching", show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.managers, label: "Managers", show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchManagers },
    { divider: true, show: canViewFacilities },
    { tab: TABS.facilities, label: "Facilities", show: canViewFacilities, onEnter: fetchFacilities },
  ];

  const complianceColor = complianceDisplay >= 70 ? "#4ade80" : complianceDisplay >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="dashboard-page" style={styles.page}>
      {/* ── Keyframe animations ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes amFadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .am-fade { animation: amFadeUp 0.22s ease both; }
        .am-facility-btn { transition: transform 0.15s ease, border-color 0.15s ease !important; }
        .am-facility-btn:hover { transform: translateY(-1px) !important; }
        .am-gm-card { transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease !important; cursor: pointer; }
        .am-gm-card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; border-color: #334155 !important; }
        .top-nav-btn { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important; }
        .top-nav-btn:hover { background: #1e293b !important; color: #f8fafc !important; }
      `}} />

      {/* ══════════════════════════════════════════════
          TOP NAVIGATION HEADER
      ══════════════════════════════════════════════ */}
      <header style={styles.topNav}>
        {/* Left — user identity */}
        <div style={styles.topNavBrand}>
          <div style={styles.topNavName}>{profile?.full_name || "Dashboard"}</div>
          <div style={styles.topNavMeta}>{profile?.role} · {profile?.company}</div>
        </div>

        {/* Center — nav tabs (desktop) */}
        {!isMobile && (
          <nav style={styles.topNavItems}>
            {navItems.map((item, i) => {
              if (!item.show) return null;
              if (item.divider) return <div key={i} style={styles.topNavDivider} />;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  className="top-nav-btn"
                  style={{
                    ...styles.topNavBtn,
                    ...(isActive ? styles.topNavBtnActive : {}),
                  }}
                  onClick={() => {
                    setActiveTab(item.tab);
                    if (item.onEnter) item.onEnter();
                    if (item.tab === TABS.myLogs) fetchMyLogs();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right — logout (desktop) / hamburger (mobile) */}
        <div style={styles.topNavRight}>
          {!isMobile ? (
            <button style={styles.topNavLogout} onClick={handleLogout}>Log Out</button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={styles.mobileMenuBtn}
                onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); setMobileMenuOpen(false); }}
              >
                My Logs
              </button>
              <button
                style={styles.mobileMenuBtn}
                onClick={() => setMobileMenuOpen((v) => !v)}
              >
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile dropdown nav ── */}
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
                  if (item.tab === TABS.myLogs) fetchMyLogs();
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

      {/* ── Main content ── */}
      <main className="dashboard-main" style={styles.main}>

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

          {/* ════ Document Decision ════ */}
          {activeTab === TABS.decision && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Document Decision</h1>
                <p style={styles.subtitle}>Record the situation, the action taken, and the category.</p>
              </div>
              <div style={styles.panelCard}>
                <label style={styles.label}>Situation</label>
                <textarea
                  value={decisionSituation}
                  onChange={(e) => setDecisionSituation(e.target.value)}
                  placeholder="Describe what happened."
                  style={styles.textareaSmall}
                />

                <label style={styles.label}>Action Taken</label>
                <textarea
                  value={decisionAction}
                  onChange={(e) => setDecisionAction(e.target.value)}
                  placeholder="Describe the action you took."
                  style={styles.textareaSmall}
                />

                {/* Category divider + dropdown */}
                <div style={{ borderTop: "1px solid #1f2937", margin: "4px 0 18px" }} />
                <label style={styles.label}>Category</label>
                <select
                  value={decisionCategory}
                  onChange={(e) => {
                    setDecisionCategory(e.target.value);
                    setCategoryManuallySet(true);
                  }}
                  style={styles.categorySelect}
                >
                  <option value="">— Select a category —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {decisionCategory && !categoryManuallySet && (
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px", marginBottom: "12px" }}>
                    ✦ Auto-detected · <button
                      style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "12px", padding: 0 }}
                      onClick={() => setCategoryManuallySet(true)}
                    >Change manually</button>
                  </div>
                )}

                <div style={{ borderTop: "1px solid #1f2937", margin: "18px 0 16px" }} />
                <input
                  type="text"
                  value={decisionPolicy}
                  onChange={(e) => setDecisionPolicy(e.target.value)}
                  placeholder="Policy referenced (optional)"
                  style={styles.policyInput}
                />

                <button
                  style={{ ...styles.primaryButton, ...(decisionLoading ? styles.buttonDisabled : {}), marginTop: "14px" }}
                  onClick={handleDecisionSubmit}
                  disabled={decisionLoading}
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
                <p style={styles.subtitle}>Ask for leadership support when a second layer of guidance is needed.</p>
              </div>
              <div style={styles.panelCard}>
                <label style={styles.label}>Request coaching support</label>
                <textarea
                  value={coachingText}
                  onChange={(e) => setCoachingText(e.target.value)}
                  placeholder="Describe the situation and what kind of support you need..."
                  style={styles.textarea}
                />
                <button
                  style={{ ...styles.primaryButton, ...(coachingLoading ? styles.buttonDisabled : {}) }}
                  onClick={handleCoachingSubmit}
                  disabled={coachingLoading}
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
                  <p style={styles.message}>Loading your logs...</p>
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
                    {myDecisions.length === 0 ? (
                      <p style={styles.message}>No decision logs yet.</p>
                    ) : myDecisions.map((item) => (
                      <DecisionCard
                        key={item.id}
                        item={{ ...item, user_name: formatDate(item.created_at) }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {myCoaching.length === 0 ? (
                      <p style={styles.message}>No coaching requests yet.</p>
                    ) : myCoaching.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div style={styles.feedName}>{formatDate(item.created_at)}</div>
                          <div style={styles.feedMeta}>{item.status || "open"}</div>
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
                {teamDecisionsLoading ? (
                  <p style={styles.message}>Loading team decisions...</p>
                ) : teamDecisions.length === 0 ? (
                  <p style={styles.message}>No unread team decisions.</p>
                ) : (
                  <div style={styles.cardList}>
                    {teamDecisions.map((item) => (
                      <DecisionCard
                        key={item.id}
                        item={item}
                        actions={
                          <button
                            style={styles.secondaryButton}
                            onClick={() => markDecisionAsRead(item.id, item.user_id)}
                          >
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
                <p style={styles.subtitle}>Review coaching requests routed to your clearance level.</p>
              </div>
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Coaching Queue</div>
                  <button style={styles.secondaryButton} onClick={fetchTeamCoachingRequests}>Refresh</button>
                </div>
                {teamCoachingMessage && <p style={styles.message}>{teamCoachingMessage}</p>}
                {teamCoachingLoading ? (
                  <p style={styles.message}>Loading coaching requests...</p>
                ) : teamCoachingRequests.length === 0 ? (
                  <p style={styles.message}>No open coaching requests.</p>
                ) : (
                  <div style={styles.cardList}>
                    {teamCoachingRequests.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div>
                            <div style={styles.feedName}>{item.requester_name || "Unknown User"}</div>
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
                              <textarea
                                value={guidanceText}
                                onChange={(e) => setGuidanceText(e.target.value)}
                                placeholder="What should this manager do? Be specific..."
                                style={styles.guidanceTextarea}
                              />
                              <div style={styles.guidanceButtons}>
                                <button
                                  style={styles.primaryButton}
                                  onClick={() => handleGiveGuidance(item.id, item.user_id)}
                                  disabled={guidanceSubmittingId === item.id || !guidanceText.trim()}
                                >
                                  {guidanceSubmittingId === item.id ? "Sending..." : "Send to Manager File"}
                                </button>
                                <button
                                  style={styles.secondaryButton}
                                  onClick={() => { setGuidanceActiveId(null); setGuidanceText(""); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              style={styles.secondaryButton}
                              onClick={() => { setGuidanceActiveId(item.id); setGuidanceText(""); }}
                            >
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
              <div className="managers-layout" style={{ ...styles.managersLayout, gridTemplateColumns: isMobile ? "1fr" : "320px 1fr" }}>
                {/* Left: manager list */}
                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Manager Directory</div>
                    <button style={styles.secondaryButton} onClick={fetchManagers}>Refresh</button>
                  </div>
                  {managersMessage && <p style={styles.message}>{managersMessage}</p>}
                  {managersLoading ? (
                    <p style={styles.message}>Loading managers...</p>
                  ) : managers.length === 0 ? (
                    <p style={styles.message}>No managers found.</p>
                  ) : (
                    <div style={styles.cardList}>
                      {managers.map((manager) => (
                        <button
                          key={manager.id}
                          style={{ ...styles.managerRowButton, ...(selectedManager?.id === manager.id ? styles.managerRowButtonActive : {}) }}
                          onClick={() => openManagerFile(manager)}
                        >
                          <div style={styles.managerRowName}>{manager.full_name || "Unnamed"}</div>
                          <div style={styles.managerRowMeta}>{manager.role} · {manager.company}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: manager file */}
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
                    <p style={styles.message}>Loading manager file...</p>
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
                      {selectedManagerDecisions.length === 0 ? (
                        <p style={styles.message}>No decision logs found.</p>
                      ) : selectedManagerDecisions.map((item) => (
                        <DecisionCard
                          key={item.id}
                          item={{ ...item, user_name: formatDate(item.created_at), user_role: item.is_read ? "Read" : "Unread" }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={styles.cardList}>
                      {selectedManagerCoaching.length === 0 ? (
                        <p style={styles.message}>No coaching logs found.</p>
                      ) : selectedManagerCoaching.map((item) => (
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
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Facilities</h1>
                <p style={styles.subtitle}>
                  {selectedGM
                    ? `Viewing GM: ${selectedGM.full_name}`
                    : selectedFacility
                    ? `Facility ${selectedFacility.facility_number} — Select a GM`
                    : "Select a facility to review General Manager performance."}
                </p>

                {/* Breadcrumb */}
                {(selectedFacility || selectedGM) && (
                  <div style={styles.breadcrumb}>
                    <button style={styles.breadcrumbLink} onClick={() => { setSelectedFacility(null); setSelectedGM(null); }}>
                      All Facilities
                    </button>
                    {selectedFacility && (
                      <>
                        <span style={styles.breadcrumbSep}>›</span>
                        <button style={styles.breadcrumbLink} onClick={() => setSelectedGM(null)}>
                          Facility {selectedFacility.facility_number}
                        </button>
                      </>
                    )}
                    {selectedGM && (
                      <>
                        <span style={styles.breadcrumbSep}>›</span>
                        <span style={styles.breadcrumbCurrent}>{selectedGM.full_name}</span>
                      </>
                    )}
                  </div>
                )}

                {/* ── Horizontal selector tabs (replaces side panels) ── */}
                {!selectedGM && (
                  <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Row 1: Facility pills */}
                    {facilities.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {facilitiesLoading ? (
                          <span style={styles.feedMeta}>Loading facilities...</span>
                        ) : facilities.map((f) => {
                          const isSelected = selectedFacility?.facility_number === f.facility_number && selectedFacility?.company === f.company;
                          return (
                            <button
                              key={`${f.company}-${f.facility_number}`}
                              className="am-facility-btn"
                              onClick={() => fetchFacilityGMs(f)}
                              style={{
                                padding: "8px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: 600,
                                border: `1px solid ${isSelected ? "#3b82f6" : "#1f2937"}`,
                                background: isSelected ? "rgba(59,130,246,0.12)" : "#0f172a",
                                color: isSelected ? "#60a5fa" : "#e5e7eb",
                                cursor: "pointer",
                              }}
                            >
                              Facility {f.facility_number}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Row 2: GM pills (only when facility selected) */}
                    {selectedFacility && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {facilityGMsLoading ? (
                          <span style={styles.feedMeta}>Loading GMs...</span>
                        ) : facilityGMs.length === 0 ? (
                          <span style={styles.feedMeta}>No GMs in this facility.</span>
                        ) : facilityGMs.map((gm) => (
                          <button
                            key={gm.id}
                            className="am-facility-btn"
                            onClick={() => fetchGMData(gm)}
                            style={{
                              padding: "8px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: 600,
                              border: "1px solid #1f2937", background: "#0f172a", color: "#e5e7eb", cursor: "pointer",
                            }}
                          >
                            {gm.full_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {facilitiesMessage && <p style={styles.message}>{facilitiesMessage}</p>}

              {/* ── Facilities list (no facility selected) ── */}
              {!selectedFacility && !facilitiesLoading && facilities.length === 0 && (
                <div style={styles.panelCard}>
                  <p style={styles.message}>No facilities assigned to your account.</p>
                </div>
              )}

              {/* ── GM Detail View ── */}
              {selectedGM && (
                gmDataLoading ? (
                  <div style={styles.panelCard}><p style={styles.message}>Loading GM data...</p></div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* GM identity card */}
                    <div style={{ ...styles.panelCard, borderColor: "#1e3a5f" }} className="am-fade">
                      <div style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc" }}>{selectedGM.full_name}</div>
                      <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                        General Manager · {selectedFacility?.company} · Facility {selectedFacility?.facility_number}
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                        {facilityManagerDetails.length} manager{facilityManagerDetails.length !== 1 ? "s" : ""} assigned
                      </div>
                    </div>

                    {/* Policy compliance card — animated 0 → 80% */}
                    <div style={{ ...styles.panelCard }} className="am-fade">
                      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "16px" }}>
                        Policy Compliance Breakdown
                      </div>

                      {/* Big animated number */}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "56px", fontWeight: 800, lineHeight: 1, color: complianceColor, transition: "color 0.3s ease", fontVariantNumeric: "tabular-nums" }}>
                          {complianceDisplay}
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#4ade80", marginBottom: "10px" }}>/100</div>
                        <div style={{ marginLeft: "auto", fontSize: "13px", color: "#94a3b8", marginBottom: "10px" }}>logs</div>
                      </div>

                      {/* Stacked bar */}
                      <div style={{ background: "#1f2937", borderRadius: "999px", height: "10px", overflow: "hidden", marginBottom: "14px" }}>
                        <div style={{ height: "100%", width: `${complianceDisplay}%`, background: complianceColor, borderRadius: "999px", transition: "background 0.3s ease" }} />
                      </div>

                      {/* Legend */}
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4ade80" }} />
                          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                            <strong style={{ color: "#4ade80" }}>{complianceDisplay}</strong> referencing policy
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f87171" }} />
                          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                            <strong style={{ color: "#f87171" }}>{100 - complianceDisplay}</strong> not referencing policy
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BLOCK 1: GM Logs & Requests */}
                    <div style={styles.panelCard} className="am-fade">
                      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "16px" }}>
                        GM Logs &amp; Requests
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "14px", padding: "18px", textAlign: "center" }}>
                          <div style={{ fontSize: "36px", fontWeight: 800, color: "#60a5fa", lineHeight: 1, marginBottom: "6px" }}>
                            {gmOwnDecisionCount}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Decision Logs Submitted</div>
                        </div>
                        <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "14px", padding: "18px", textAlign: "center" }}>
                          <div style={{ fontSize: "36px", fontWeight: 800, color: "#a78bfa", lineHeight: 1, marginBottom: "6px" }}>
                            {gmOwnCoachingCount}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Coaching Requests Submitted</div>
                        </div>
                      </div>
                      {gmOwnDecisionCount === 0 && gmOwnCoachingCount === 0 && (
                        <p style={{ ...styles.message, marginTop: "12px" }}>No activity logged by this GM yet.</p>
                      )}
                    </div>

                    {/* BLOCK 2: Facility Managers */}
                    <div style={styles.panelCard} className="am-fade">
                      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "16px" }}>
                        Facility Managers
                      </div>
                      {facilityManagerDetails.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: "32px", marginBottom: "10px" }}>👥</div>
                          <div style={{ fontSize: "15px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>No managers assigned yet</div>
                          <div style={{ fontSize: "13px", color: "#6b7280" }}>Managers will appear here once assigned to this GM in Supabase.</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {facilityManagerDetails.map((mgr) => (
                            <div
                              key={mgr.id}
                              style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
                            >
                              <div>
                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>{mgr.full_name || "Unnamed"}</div>
                                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Manager</div>
                              </div>
                              <div style={{ display: "flex", gap: "10px" }}>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#60a5fa", lineHeight: 1 }}>{mgr.decisionCount}</div>
                                  <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>Decisions</div>
                                </div>
                                <div style={{ width: "1px", background: "#1f2937" }} />
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{mgr.coachingCount}</div>
                                  <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>Coaching</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )
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
  // ── Top nav header ──────────────────────────────────
  topNav: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#111827",
    borderBottom: "1px solid #1f2937",
    padding: "12px 24px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    flexWrap: "wrap",
  },
  topNavBrand: {
    display: "flex",
    flexDirection: "column",
    marginRight: "8px",
    flexShrink: 0,
  },
  topNavName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#f8fafc",
    lineHeight: 1.2,
  },
  topNavMeta: {
    fontSize: "11px",
    color: "#6b7280",
    marginTop: "1px",
  },
  topNavItems: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flex: 1,
    flexWrap: "wrap",
  },
  topNavDivider: {
    width: "1px",
    height: "20px",
    background: "#1f2937",
    margin: "0 4px",
    flexShrink: 0,
  },
  topNavBtn: {
    padding: "7px 14px",
    borderRadius: "8px",
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  topNavBtnActive: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#f8fafc",
  },
  topNavRight: {
    marginLeft: "auto",
    flexShrink: 0,
  },
  topNavLogout: {
    padding: "7px 14px",
    borderRadius: "8px",
    border: "1px solid #243041",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  // ── Mobile dropdown ──────────────────────────────────
  mobileDropdown: {
    background: "#111827",
    borderBottom: "1px solid #1f2937",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  companyName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#e5e7eb",
    marginBottom: "4px",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  navDivider: {
    height: "1px",
    background: "#1f2937",
    margin: "6px 0 2px",
  },
  navButton: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #1f2937",
    background: "#111827",
    color: "#e5e7eb",
    fontSize: "14px",
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
    transition: "0.15s ease",
  },
  navButtonActive: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#f8fafc",
  },
  logoutWrap: {
    marginTop: "auto",
    paddingTop: "20px",
  },
  logoutButton: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #243041",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    maxWidth: "960px",
    margin: "0 auto",
    width: "100%",
    padding: "24px 24px 40px",
    boxSizing: "border-box",
  },
  headerCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "24px",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.05,
    fontWeight: 700,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    fontSize: "15px",
    color: "#94a3b8",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  panelCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "22px",
  },
  managersLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "18px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e5e7eb",
  },
  textarea: {
    width: "100%",
    minHeight: "200px",
    borderRadius: "14px",
    border: "1px solid #273449",
    background: "#0f172a",
    color: "#f8fafc",
    padding: "14px",
    fontSize: "14px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "14px",
    boxSizing: "border-box",
  },
  textareaSmall: {
    width: "100%",
    minHeight: "100px",
    borderRadius: "14px",
    border: "1px solid #273449",
    background: "#0f172a",
    color: "#f8fafc",
    padding: "14px",
    fontSize: "14px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "14px",
    boxSizing: "border-box",
  },
  categorySelect: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "12px",
    border: "1px solid #273449",
    background: "#0f172a",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
    marginBottom: "4px",
    boxSizing: "border-box",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    paddingRight: "36px",
  },
  primaryButton: {
    padding: "12px 20px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "9px 14px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e5e7eb",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "10px",
    fontSize: "13px",
    color: "#94a3b8",
  },
  loadingCard: {
    maxWidth: "500px",
    margin: "120px auto",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "32px",
    textAlign: "center",
    fontSize: "17px",
    color: "#e5e7eb",
  },
  sectionTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },
  sectionHeading: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  feedCard: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "16px",
  },
  feedTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "10px",
  },
  feedName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "3px",
  },
  feedMeta: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  feedDate: {
    fontSize: "12px",
    color: "#94a3b8",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  feedSection: {
    marginTop: "10px",
  },
  feedLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: "4px",
  },
  feedBody: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#e5e7eb",
    whiteSpace: "pre-wrap",
  },
  statusRow: {
    marginBottom: "8px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "#1e293b",
    color: "#cbd5e1",
    border: "1px solid #334155",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
  },
  managerRowButton: {
    width: "100%",
    textAlign: "left",
    borderRadius: "14px",
    border: "1px solid #1f2937",
    background: "#0f172a",
    padding: "14px",
    cursor: "pointer",
  },
  managerRowButtonActive: {
    border: "1px solid #334155",
    background: "#162033",
  },
  managerRowName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "3px",
  },
  managerRowMeta: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  policyInput: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #1f2937",
    backgroundColor: "#0f172a",
    color: "#cbd5e1",
    fontSize: "13px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  policyTag: {
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid #1e3a5f",
    backgroundColor: "#0c1e35",
    color: "#60a5fa",
    fontSize: "12px",
    display: "inline-block",
    marginTop: "10px",
  },
  guidancePrompt: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  },
  guidanceTextarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    fontSize: "14px",
    resize: "vertical",
    minHeight: "90px",
    outline: "none",
    boxSizing: "border-box",
  },
  guidanceButtons: {
    display: "flex",
    gap: "10px",
  },
  mobileTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "14px 18px",
    marginBottom: "12px",
  },
  mobileTopName: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  mobileTopRole: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  mobileMenuBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#e5e7eb",
    padding: "8px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
  },
  mobileOverlay: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "12px",
  },
  logTypeSelector: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginTop: "8px",
  },
  logTypeButton: {
    padding: "22px 18px",
    borderRadius: "16px",
    border: "1px solid #1f2937",
    background: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  logTypeTitle: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "6px",
  },
  logTypeMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  breadcrumbLink: {
    background: "transparent",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: "13px",
    padding: 0,
  },
  breadcrumbSep: {
    color: "#4b5563",
    fontSize: "13px",
  },
  breadcrumbCurrent: {
    fontSize: "13px",
    color: "#94a3b8",
  },
};
