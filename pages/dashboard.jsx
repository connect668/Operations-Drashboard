import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

function getNextRole(role) {
  if (role === "Manager") return "General Manager";
  if (role === "General Manager") return "Area Coach";
  return null;
}

function formatDate(value) {
  if (!value) return "Unknown date";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getManagerDisplayName(manager) {
  return manager?.full_name || "Unnamed Manager";
}

function calculateCompliance(decisionLogs) {
  if (!decisionLogs || decisionLogs.length === 0) return 92;

  const referencedCount = decisionLogs.filter((item) =>
    String(item?.policy_referenced || "").trim()
  ).length;

  return Math.max(
    0,
    Math.min(100, Math.round((referencedCount / decisionLogs.length) * 100))
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TABS.coaching);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [policyText, setPolicyText] = useState("");
  const [decisionSituation, setDecisionSituation] = useState("");
  const [decisionAction, setDecisionAction] = useState("");
  const [decisionReasoning, setDecisionReasoning] = useState("");
  const [decisionPolicy, setDecisionPolicy] = useState("");
  const [coachingText, setCoachingText] = useState("");

  const [policyMessage, setPolicyMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [coachingMessage, setCoachingMessage] = useState("");
  const [teamDecisionsMessage, setTeamDecisionsMessage] = useState("");
  const [teamCoachingMessage, setTeamCoachingMessage] = useState("");
  const [managersMessage, setManagersMessage] = useState("");
  const [facilitiesMessage, setFacilitiesMessage] = useState("");

  const [decisionLoading, setDecisionLoading] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [teamDecisionsLoading, setTeamDecisionsLoading] = useState(false);
  const [teamCoachingLoading, setTeamCoachingLoading] = useState(false);
  const [managersLoading, setManagersLoading] = useState(false);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilityGMsLoading, setFacilityGMsLoading] = useState(false);
  const [gmDataLoading, setGmDataLoading] = useState(false);

  const [guidanceActiveId, setGuidanceActiveId] = useState(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [guidanceSubmittingId, setGuidanceSubmittingId] = useState(null);

  const [teamDecisions, setTeamDecisions] = useState([]);
  const [teamCoachingRequests, setTeamCoachingRequests] = useState([]);

  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedManagerDecisions, setSelectedManagerDecisions] = useState([]);
  const [selectedManagerCoaching, setSelectedManagerCoaching] = useState([]);
  const [managerFileTab, setManagerFileTab] = useState(null);

  const [myLogType, setMyLogType] = useState(null);
  const [myDecisions, setMyDecisions] = useState([]);
  const [myCoaching, setMyCoaching] = useState([]);
  const [myLogsLoading, setMyLogsLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityGMs, setFacilityGMs] = useState([]);
  const [selectedGM, setSelectedGM] = useState(null);

  const [gmOwnDecisionLogs, setGmOwnDecisionLogs] = useState([]);
  const [gmOwnCoachingRequests, setGmOwnCoachingRequests] = useState([]);
  const [facilityManagerSummaries, setFacilityManagerSummaries] = useState([]);
  const [gmManagerIds, setGmManagerIds] = useState([]);

  const [complianceTarget, setComplianceTarget] = useState(92);
  const [complianceDisplay, setComplianceDisplay] = useState(0);

  const currentRoleLevel = useMemo(
    () => ROLE_LEVELS[profile?.role] || 1,
    [profile]
  );

  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const isAreaManager = profile?.role === "Area Manager";
  const canViewFacilities =
    profile?.role === "Area Manager" || profile?.role === "Area Coach";
  const nextRole = getNextRole(profile?.role);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!authUser) {
          window.location.href = "/";
          return;
        }

        setUser(authUser);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, facility_number")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile load error:", profileError);
        }

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
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!profile?.role) return;

    if (profile.role === "Area Manager") {
      setActiveTab(TABS.facilities);
    }
  }, [profile?.role]);

  useEffect(() => {
    if (
      profile?.role === "Area Manager" &&
      activeTab === TABS.facilities &&
      user?.id
    ) {
      fetchFacilities();
    }
  }, [profile?.role, activeTab, user?.id]);

  useEffect(() => {
    const target = complianceTarget ?? 0;
    setComplianceDisplay(0);

    const duration = 900;
    const startTime = performance.now();
    let rafId;

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setComplianceDisplay(Math.round(target * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId);
  }, [complianceTarget, selectedGM?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    if (tab === TABS.myLogs) {
      fetchMyLogs();
    }

    if (tab === TABS.teamDecisions) {
      fetchTeamDecisions();
    }

    if (tab === TABS.teamCoaching) {
      fetchTeamCoachingRequests();
    }

    if (tab === TABS.managers) {
      fetchManagers();
    }

    if (tab === TABS.facilities) {
      fetchFacilities();
    }
  };

  const handlePullPolicy = async () => {
    setPolicyMessage("");

    if (!policyText.trim()) {
      setPolicyMessage("Please describe the situation first.");
      return;
    }

    setPolicyMessage("Policy AI connection comes next.");
  };

  const handleDecisionSubmit = async () => {
    setDecisionMessage("");

    if (!decisionSituation.trim() || !decisionAction.trim()) {
      setDecisionMessage("Please enter both the situation and the action taken.");
      return;
    }

    if (!user) {
      setDecisionMessage("You must be logged in.");
      return;
    }

    setDecisionLoading(true);

    try {
      const { error } = await supabase.from("decision_logs").insert([
        {
          user_id: user.id,
          company: profile?.company || null,
          user_name: profile?.full_name || "Unknown User",
          user_role: profile?.role || "Manager",
          submitted_by_role: profile?.role || "Manager",
          visible_to_role: nextRole,
          situation: decisionSituation.trim(),
          action_taken: decisionAction.trim(),
          reasoning: decisionReasoning.trim() || null,
          policy_referenced: decisionPolicy.trim() || null,
          is_read: false,
        },
      ]);

      if (error) throw error;

      setDecisionSituation("");
      setDecisionAction("");
      setDecisionReasoning("");
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

    if (!coachingText.trim()) {
      setCoachingMessage("Please describe the support you need.");
      return;
    }

    if (!user) {
      setCoachingMessage("You must be logged in.");
      return;
    }

    setCoachingLoading(true);

    try {
      const { error } = await supabase.from("coaching_requests").insert([
        {
          user_id: user.id,
          company: profile?.company || null,
          requester_name: profile?.full_name || "Unknown User",
          requester_role: profile?.role || "Manager",
          submitted_by_role: profile?.role || "Manager",
          visible_to_role: nextRole,
          request_text: coachingText.trim(),
          status: "open",
        },
      ]);

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
    if (!profile?.company || !profile?.role || !user?.id) return;

    setTeamDecisionsLoading(true);
    setTeamDecisionsMessage("");

    try {
      const { data, error } = await supabase
        .from("decision_logs")
        .select("*")
        .eq("company", profile.company)
        .eq("visible_to_role", profile.role)
        .eq("is_read", false)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTeamDecisions(data || []);
    } catch (error) {
      console.error("Fetch team decisions error:", error);
      setTeamDecisionsMessage(
        error.message || "Failed to load team decisions."
      );
    } finally {
      setTeamDecisionsLoading(false);
    }
  };

  const fetchTeamCoachingRequests = async () => {
    if (!profile?.company || !profile?.role || !user?.id) return;

    setTeamCoachingLoading(true);
    setTeamCoachingMessage("");

    try {
      const { data, error } = await supabase
        .from("coaching_requests")
        .select("*")
        .eq("company", profile.company)
        .eq("visible_to_role", profile.role)
        .neq("user_id", user.id)
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTeamCoachingRequests(data || []);
    } catch (error) {
      console.error("Fetch team coaching error:", error);
      setTeamCoachingMessage(
        error.message || "Failed to load team coaching requests."
      );
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
      console.error("Fetch managers error:", error);
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
      const [{ data: decisionData, error: decisionError }, { data: coachingData, error: coachingError }] =
        await Promise.all([
          supabase
            .from("decision_logs")
            .select("*")
            .eq("user_id", manager.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("coaching_requests")
            .select("*")
            .eq("user_id", manager.id)
            .order("created_at", { ascending: false }),
        ]);

      if (decisionError) throw decisionError;
      if (coachingError) throw coachingError;

      setSelectedManagerDecisions(decisionData || []);
      setSelectedManagerCoaching(coachingData || []);
    } catch (error) {
      console.error("Open manager file error:", error);
      setManagersMessage(error.message || "Failed to open manager file.");
    } finally {
      setSelectedManagerLoading(false);
    }
  };

  const markDecisionAsRead = async (id, userId) => {
    try {
      const { error } = await supabase
        .from("decision_logs")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: user.id,
        })
        .eq("id", id);

      if (error) throw error;

      await fetchTeamDecisions();

      let manager = managers.find((item) => item.id === userId);

      if (!manager) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, company")
          .eq("id", userId)
          .maybeSingle();

        manager = data;
      }

      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (error) {
      console.error("Mark as read error:", error);
      setTeamDecisionsMessage(error.message || "Failed to mark as read.");
    }
  };

  const handleGiveGuidance = async (requestId, userId) => {
    if (!guidanceText.trim()) return;

    setGuidanceSubmittingId(requestId);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("coaching_requests")
        .update({
          leadership_notes: guidanceText.trim(),
          guidance_response: guidanceText.trim(),
          guidance_given: true,
          guidance_given_at: now,
          guidance_given_by: user.id,
          sent_to_manager_file: true,
          sent_to_manager_file_at: now,
          sent_to_manager_file_by: user.id,
          status: "resolved",
        })
        .eq("id", requestId);

      if (error) throw error;

      setGuidanceActiveId(null);
      setGuidanceText("");
      await fetchTeamCoachingRequests();

      let manager = managers.find((item) => item.id === userId);

      if (!manager) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, company")
          .eq("id", userId)
          .maybeSingle();

        manager = data;
      }

      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (error) {
      console.error("Give guidance error:", error);
      setTeamCoachingMessage(error.message || "Failed to save guidance.");
    } finally {
      setGuidanceSubmittingId(null);
    }
  };

  const fetchMyLogs = async () => {
    if (!user?.id) return;

    setMyLogsLoading(true);

    try {
      const [{ data: decisions }, { data: coaching }] = await Promise.all([
        supabase
          .from("decision_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("coaching_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      setMyDecisions(decisions || []);
      setMyCoaching(coaching || []);
    } catch (error) {
      console.error("Fetch my logs error:", error);
    } finally {
      setMyLogsLoading(false);
    }
  };

  const fetchFacilities = async () => {
    if (!user?.id) return;

    setFacilitiesLoading(true);
    setFacilitiesMessage("");
    setSelectedFacility(null);
    setFacilityGMs([]);
    setSelectedGM(null);
    setGmOwnDecisionLogs([]);
    setGmOwnCoachingRequests([]);
    setFacilityManagerSummaries([]);
    setGmManagerIds([]);
    setComplianceTarget(92);

    try {
      const { data, error } = await supabase
        .from("area_manager_facilities")
        .select("facility_number, company")
        .eq("area_manager_id", user.id);

      if (error) throw error;

      setFacilities(data || []);

      if (!data || data.length === 0) {
        setFacilitiesMessage("No facilities assigned to your account.");
      }
    } catch (error) {
      console.error("Fetch facilities error:", error);
      setFacilitiesMessage(error.message || "Failed to load facilities.");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const fetchFacilityGMs = async (facility) => {
    if (!facility) return;

    setSelectedFacility(facility);
    setSelectedGM(null);
    setFacilityGMs([]);
    setGmOwnDecisionLogs([]);
    setGmOwnCoachingRequests([]);
    setFacilityManagerSummaries([]);
    setGmManagerIds([]);
    setComplianceTarget(92);
    setFacilitiesMessage("");
    setFacilityGMsLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, company, facility_number")
        .eq("role", "General Manager")
        .eq("company", facility.company)
        .eq("facility_number", facility.facility_number)
        .order("full_name", { ascending: true });

      if (error) throw error;

      setFacilityGMs(data || []);

      if (!data || data.length === 0) {
        setFacilitiesMessage("No General Managers found in this facility.");
      }
    } catch (error) {
      console.error("Fetch facility GMs error:", error);
      setFacilitiesMessage(error.message || "Failed to load general managers.");
    } finally {
      setFacilityGMsLoading(false);
    }
  };

  const fetchGMData = async (gm) => {
    if (!gm?.id) return;

    setSelectedGM(gm);
    setFacilitiesMessage("");
    setGmOwnDecisionLogs([]);
    setGmOwnCoachingRequests([]);
    setFacilityManagerSummaries([]);
    setGmManagerIds([]);
    setComplianceTarget(92);
    setGmDataLoading(true);

    try {
      const [
        { data: assignmentRows, error: assignmentError },
        { data: gmDecisionRows, error: gmDecisionError },
        { data: gmCoachingRows, error: gmCoachingError },
      ] = await Promise.all([
        supabase
          .from("gm_manager_assignments")
          .select("manager_id")
          .eq("gm_id", gm.id),
        supabase
          .from("decision_logs")
          .select("id, user_id, created_at, policy_referenced")
          .eq("user_id", gm.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("coaching_requests")
          .select("id, user_id, created_at, status")
          .eq("user_id", gm.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assignmentError) throw assignmentError;
      if (gmDecisionError) throw gmDecisionError;
      if (gmCoachingError) throw gmCoachingError;

      const managerIds = (assignmentRows || [])
        .map((row) => row.manager_id)
        .filter(Boolean);

      setGmManagerIds(managerIds);
      setGmOwnDecisionLogs(gmDecisionRows || []);
      setGmOwnCoachingRequests(gmCoachingRows || []);

      let managerProfiles = [];
      let managerDecisionRows = [];
      let managerCoachingRows = [];

      if (managerIds.length > 0) {
        const [
          { data: managerProfileRows, error: managerProfileError },
          { data: managerDecisionData, error: managerDecisionDataError },
          { data: managerCoachingData, error: managerCoachingDataError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role, company, facility_number")
            .in("id", managerIds)
            .order("full_name", { ascending: true }),
          supabase
            .from("decision_logs")
            .select("id, user_id, created_at, policy_referenced")
            .in("user_id", managerIds),
          supabase
            .from("coaching_requests")
            .select("id, user_id, created_at, status")
            .in("user_id", managerIds),
        ]);

        if (managerProfileError) throw managerProfileError;
        if (managerDecisionDataError) throw managerDecisionDataError;
        if (managerCoachingDataError) throw managerCoachingDataError;

        managerProfiles = managerProfileRows || [];
        managerDecisionRows = managerDecisionData || [];
        managerCoachingRows = managerCoachingData || [];
      }

      const decisionCountMap = managerDecisionRows.reduce((acc, item) => {
        acc[item.user_id] = (acc[item.user_id] || 0) + 1;
        return acc;
      }, {});

      const coachingCountMap = managerCoachingRows.reduce((acc, item) => {
        acc[item.user_id] = (acc[item.user_id] || 0) + 1;
        return acc;
      }, {});

      const summaries = managerProfiles.map((manager) => ({
        id: manager.id,
        full_name: manager.full_name,
        role: manager.role || "Manager",
        company: manager.company,
        facility_number: manager.facility_number,
        decisionCount: decisionCountMap[manager.id] || 0,
        coachingCount: coachingCountMap[manager.id] || 0,
      }));

      setFacilityManagerSummaries(summaries);

      const complianceSource = [...(gmDecisionRows || []), ...managerDecisionRows];
      setComplianceTarget(calculateCompliance(complianceSource));

      if (managerIds.length === 0) {
        setFacilitiesMessage("No managers assigned to this GM yet.");
      }
    } catch (error) {
      console.error("Fetch GM data error:", error);
      setFacilitiesMessage(error.message || "Failed to load GM data.");
    } finally {
      setGmDataLoading(false);
    }
  };

  const complianceColor =
    complianceDisplay >= 80
      ? "#4ade80"
      : complianceDisplay >= 60
      ? "#fbbf24"
      : "#f87171";

  const navItems = [
    { key: TABS.policy, label: "Request Policy" },
    { key: TABS.decision, label: "Document Decision" },
    { key: TABS.coaching, label: "Request Coaching" },
    { key: TABS.myLogs, label: "My Logs" },
    ...(canViewLeadershipTabs && !isAreaManager
      ? [
          { key: TABS.teamDecisions, label: "Team Decisions" },
          { key: TABS.teamCoaching, label: "Team Coaching" },
          { key: TABS.managers, label: "Managers" },
        ]
      : []),
    ...(canViewFacilities ? [{ key: TABS.facilities, label: "Facilities" }] : []),
  ];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.topHeader}>
          <div style={styles.headerIdentity}>
            <div style={styles.smallLabel}>SIGNED IN AS</div>
            <div style={styles.topName}>
              {profile?.full_name || "No name found"}
            </div>
            <div style={styles.topMeta}>
              {profile?.role || "No role assigned"}
            </div>
            <div style={styles.topCompany}>
              {profile?.company || "No company assigned"}
            </div>
            <div style={styles.companyMotto}>company motto here</div>
          </div>

          <div style={styles.headerActions}>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </header>

        <div
          style={{
            ...styles.navWrap,
            flexWrap: isMobile ? "nowrap" : "wrap",
            overflowX: isMobile ? "auto" : "visible",
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.key}
              style={{
                ...styles.navButton,
                ...(activeTab === item.key ? styles.navButtonActive : {}),
                flex: isMobile ? "0 0 auto" : "0 0 auto",
              }}
              onClick={() => handleTabChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main style={styles.main}>
          {activeTab === TABS.policy && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Request Policy</h1>
                <p style={styles.subtitle}>
                  Describe the situation and pull the applicable standard.
                </p>
              </div>

              <div style={styles.panelCard}>
                <label style={styles.label}>
                  Describe situation for policy reference
                </label>
                <textarea
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  placeholder="Example: An employee showed up 30 minutes late without calling. What does company policy say I should do?"
                  style={styles.textarea}
                />
                <button style={styles.primaryButton} onClick={handlePullPolicy}>
                  Pull Policy
                </button>
                {policyMessage ? (
                  <p style={styles.message}>{policyMessage}</p>
                ) : null}
              </div>
            </>
          )}

          {activeTab === TABS.decision && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Document Decision</h1>
                <p style={styles.subtitle}>
                  Record the situation, the action taken, and the reasoning.
                </p>
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

                <label style={styles.label}>Reasoning</label>
                <textarea
                  value={decisionReasoning}
                  onChange={(e) => setDecisionReasoning(e.target.value)}
                  placeholder="Optional: explain why this was the right call."
                  style={styles.textareaSmall}
                />

                <input
                  type="text"
                  value={decisionPolicy}
                  onChange={(e) => setDecisionPolicy(e.target.value)}
                  placeholder="Policy referenced (optional)"
                  style={styles.textInput}
                />

                <button
                  style={{
                    ...styles.primaryButton,
                    ...(decisionLoading ? styles.buttonDisabled : {}),
                  }}
                  onClick={handleDecisionSubmit}
                  disabled={decisionLoading}
                >
                  {decisionLoading ? "Submitting..." : "Submit Decision"}
                </button>

                {decisionMessage ? (
                  <p style={styles.message}>{decisionMessage}</p>
                ) : null}
              </div>
            </>
          )}

          {activeTab === TABS.coaching && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Request Coaching</h1>
                <p style={styles.subtitle}>
                  Ask for leadership support when a second layer of guidance is
                  needed.
                </p>
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
                  style={{
                    ...styles.primaryButton,
                    ...(coachingLoading ? styles.buttonDisabled : {}),
                  }}
                  onClick={handleCoachingSubmit}
                  disabled={coachingLoading}
                >
                  {coachingLoading ? "Submitting..." : "Request Coaching"}
                </button>
                {coachingMessage ? (
                  <p style={styles.message}>{coachingMessage}</p>
                ) : null}
              </div>
            </>
          )}

          {activeTab === TABS.teamDecisions && canViewLeadershipTabs && !isAreaManager && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Team Decisions</h1>
                <p style={styles.subtitle}>
                  Review decisions routed to your clearance level.
                </p>
              </div>

              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Decision Feed</div>
                  <button style={styles.secondaryButton} onClick={fetchTeamDecisions}>
                    Refresh
                  </button>
                </div>

                {teamDecisionsMessage ? (
                  <p style={styles.message}>{teamDecisionsMessage}</p>
                ) : null}

                {teamDecisionsLoading ? (
                  <p style={styles.message}>Loading team decisions...</p>
                ) : teamDecisions.length === 0 ? (
                  <p style={styles.message}>No team decisions found yet.</p>
                ) : (
                  <div style={styles.cardList}>
                    {teamDecisions.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div>
                            <div style={styles.feedName}>
                              {item.user_name || "Unknown User"}
                            </div>
                            <div style={styles.feedMeta}>
                              {item.user_role || "Manager"} • {item.company || "No company"}
                            </div>
                          </div>
                          <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                        </div>

                        <div style={styles.feedSection}>
                          <div style={styles.feedLabel}>Situation</div>
                          <div style={styles.feedBody}>
                            {item.situation || "No situation found."}
                          </div>
                        </div>

                        <div style={styles.feedSection}>
                          <div style={styles.feedLabel}>Action Taken</div>
                          <div style={styles.feedBody}>
                            {item.action_taken || "No action found."}
                          </div>
                        </div>

                        {item.reasoning ? (
                          <div style={styles.feedSection}>
                            <div style={styles.feedLabel}>Reasoning</div>
                            <div style={styles.feedBody}>{item.reasoning}</div>
                          </div>
                        ) : null}

                        {item.policy_referenced ? (
                          <div style={styles.policyTag}>
                            Policy Referenced: {item.policy_referenced}
                          </div>
                        ) : null}

                        <div style={styles.actionRow}>
                          <button
                            style={styles.secondaryButton}
                            onClick={() => markDecisionAsRead(item.id, item.user_id)}
                          >
                            Mark as Read
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === TABS.teamCoaching && canViewLeadershipTabs && !isAreaManager && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Team Coaching Requests</h1>
                <p style={styles.subtitle}>
                  Review coaching requests routed to your clearance level.
                </p>
              </div>

              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Coaching Queue</div>
                  <button
                    style={styles.secondaryButton}
                    onClick={fetchTeamCoachingRequests}
                  >
                    Refresh
                  </button>
                </div>

                {teamCoachingMessage ? (
                  <p style={styles.message}>{teamCoachingMessage}</p>
                ) : null}

                {teamCoachingLoading ? (
                  <p style={styles.message}>Loading coaching requests...</p>
                ) : teamCoachingRequests.length === 0 ? (
                  <p style={styles.message}>No coaching requests found yet.</p>
                ) : (
                  <div style={styles.cardList}>
                    {teamCoachingRequests.map((item) => (
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div>
                            <div style={styles.feedName}>
                              {item.requester_name || "Unknown User"}
                            </div>
                            <div style={styles.feedMeta}>
                              {item.requester_role || "Manager"} • {item.company || "No company"}
                            </div>
                          </div>
                          <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                          <span style={styles.statusBadge}>
                            {item.status || "open"}
                          </span>
                        </div>

                        <div style={styles.feedBody}>
                          {item.request_text || "No request text found."}
                        </div>

                        {item.leadership_notes ? (
                          <div style={styles.feedSection}>
                            <div style={styles.feedLabel}>Leadership Notes</div>
                            <div style={styles.feedBody}>{item.leadership_notes}</div>
                          </div>
                        ) : null}

                        <div style={styles.actionRow}>
                          {guidanceActiveId === item.id ? (
                            <div style={{ width: "100%" }}>
                              <textarea
                                value={guidanceText}
                                onChange={(e) => setGuidanceText(e.target.value)}
                                placeholder="What should this manager do? Be specific..."
                                style={styles.textareaSmall}
                              />
                              <div style={styles.actionRow}>
                                <button
                                  style={styles.primaryButton}
                                  onClick={() => handleGiveGuidance(item.id, item.user_id)}
                                  disabled={
                                    guidanceSubmittingId === item.id ||
                                    !guidanceText.trim()
                                  }
                                >
                                  {guidanceSubmittingId === item.id
                                    ? "Sending..."
                                    : "Send to Manager File"}
                                </button>
                                <button
                                  style={styles.secondaryButton}
                                  onClick={() => {
                                    setGuidanceActiveId(null);
                                    setGuidanceText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              style={styles.secondaryButton}
                              onClick={() => {
                                setGuidanceActiveId(item.id);
                                setGuidanceText("");
                              }}
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

          {activeTab === TABS.managers && canViewLeadershipTabs && !isAreaManager && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Managers</h1>
                <p style={styles.subtitle}>
                  Review managers and open their documentation history.
                </p>
              </div>

              <div
                style={{
                  ...styles.splitLayout,
                  gridTemplateColumns: isMobile ? "1fr" : "340px minmax(0, 1fr)",
                }}
              >
                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Manager Directory</div>
                    <button style={styles.secondaryButton} onClick={fetchManagers}>
                      Refresh
                    </button>
                  </div>

                  {managersMessage ? (
                    <p style={styles.message}>{managersMessage}</p>
                  ) : null}

                  {managersLoading ? (
                    <p style={styles.message}>Loading managers...</p>
                  ) : managers.length === 0 ? (
                    <p style={styles.message}>No managers found yet.</p>
                  ) : (
                    <div style={styles.cardList}>
                      {managers.map((manager) => (
                        <button
                          key={manager.id}
                          style={{
                            ...styles.rowButton,
                            ...(selectedManager?.id === manager.id
                              ? styles.rowButtonActive
                              : {}),
                          }}
                          onClick={() => openManagerFile(manager)}
                        >
                          <div style={styles.rowName}>
                            {getManagerDisplayName(manager)}
                          </div>
                          <div style={styles.rowMeta}>
                            {manager.role} • {manager.company}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>
                      {selectedManager
                        ? `${getManagerDisplayName(selectedManager)} — ${
                            managerFileTab === "decisions"
                              ? "Decision Logs"
                              : managerFileTab === "coaching"
                              ? "Coaching Logs"
                              : "Select Log Type"
                          }`
                        : "Manager File"}
                    </div>

                    {managerFileTab ? (
                      <button
                        style={styles.secondaryButton}
                        onClick={() => setManagerFileTab(null)}
                      >
                        ← Back
                      </button>
                    ) : null}
                  </div>

                  {!selectedManager ? (
                    <div style={styles.emptyCard}>
                      Select a manager to view their documentation.
                    </div>
                  ) : selectedManagerLoading ? (
                    <p style={styles.message}>Loading manager file...</p>
                  ) : !managerFileTab ? (
                    <div style={styles.chooserGrid}>
                      <button
                        style={styles.chooserCard}
                        onClick={() => setManagerFileTab("decisions")}
                      >
                        <div style={styles.chooserTitle}>Decision Logs</div>
                        <div style={styles.chooserMeta}>
                          {selectedManagerDecisions.length} record
                          {selectedManagerDecisions.length !== 1 ? "s" : ""}
                        </div>
                      </button>

                      <button
                        style={styles.chooserCard}
                        onClick={() => setManagerFileTab("coaching")}
                      >
                        <div style={styles.chooserTitle}>Coaching Logs</div>
                        <div style={styles.chooserMeta}>
                          {selectedManagerCoaching.length} record
                          {selectedManagerCoaching.length !== 1 ? "s" : ""}
                        </div>
                      </button>
                    </div>
                  ) : managerFileTab === "decisions" ? (
                    <div style={styles.cardList}>
                      {selectedManagerDecisions.length === 0 ? (
                        <p style={styles.message}>No decision logs found.</p>
                      ) : (
                        selectedManagerDecisions.map((item) => (
                          <div key={item.id} style={styles.feedCard}>
                            <div style={styles.feedTop}>
                              <div>
                                <div style={styles.feedName}>
                                  {formatDate(item.created_at)}
                                </div>
                                <div style={styles.feedMeta}>
                                  {item.is_read ? "Read" : "Unread"}
                                </div>
                              </div>
                            </div>

                            <div style={styles.feedSection}>
                              <div style={styles.feedLabel}>Situation</div>
                              <div style={styles.feedBody}>
                                {item.situation || "No situation found."}
                              </div>
                            </div>

                            <div style={styles.feedSection}>
                              <div style={styles.feedLabel}>Action Taken</div>
                              <div style={styles.feedBody}>
                                {item.action_taken || "No action found."}
                              </div>
                            </div>

                            {item.reasoning ? (
                              <div style={styles.feedSection}>
                                <div style={styles.feedLabel}>Reasoning</div>
                                <div style={styles.feedBody}>{item.reasoning}</div>
                              </div>
                            ) : null}

                            {item.policy_referenced ? (
                              <div style={styles.policyTag}>
                                Policy Referenced: {item.policy_referenced}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div style={styles.cardList}>
                      {selectedManagerCoaching.length === 0 ? (
                        <p style={styles.message}>No coaching logs found.</p>
                      ) : (
                        selectedManagerCoaching.map((item) => (
                          <div key={item.id} style={styles.feedCard}>
                            <div style={styles.feedTop}>
                              <div>
                                <div style={styles.feedName}>
                                  {formatDate(item.created_at)}
                                </div>
                                <div style={styles.feedMeta}>
                                  {item.status || "open"}
                                </div>
                              </div>
                            </div>

                            <div style={styles.feedBody}>
                              {item.request_text || "No request text found."}
                            </div>

                            {item.leadership_notes ? (
                              <div style={styles.feedSection}>
                                <div style={styles.feedLabel}>
                                  Operational Guidance
                                </div>
                                <div style={styles.feedBody}>
                                  {item.leadership_notes}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === TABS.myLogs && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>My Logs</h1>
                <p style={styles.subtitle}>
                  Your personal decision and coaching history.
                </p>
              </div>

              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>
                    {myLogType === "decisions"
                      ? "My Decision Logs"
                      : myLogType === "coaching"
                      ? "My Coaching Logs"
                      : "Select Log Type"}
                  </div>

                  {myLogType ? (
                    <button
                      style={styles.secondaryButton}
                      onClick={() => setMyLogType(null)}
                    >
                      ← Back
                    </button>
                  ) : null}
                </div>

                {myLogsLoading ? (
                  <p style={styles.message}>Loading your logs...</p>
                ) : !myLogType ? (
                  <div style={styles.chooserGrid}>
                    <button
                      style={styles.chooserCard}
                      onClick={() => setMyLogType("decisions")}
                    >
                      <div style={styles.chooserTitle}>Decision Logs</div>
                      <div style={styles.chooserMeta}>
                        {myDecisions.length} record
                        {myDecisions.length !== 1 ? "s" : ""}
                      </div>
                    </button>

                    <button
                      style={styles.chooserCard}
                      onClick={() => setMyLogType("coaching")}
                    >
                      <div style={styles.chooserTitle}>Coaching Logs</div>
                      <div style={styles.chooserMeta}>
                        {myCoaching.length} record
                        {myCoaching.length !== 1 ? "s" : ""}
                      </div>
                    </button>
                  </div>
                ) : myLogType === "decisions" ? (
                  <div style={styles.cardList}>
                    {myDecisions.length === 0 ? (
                      <p style={styles.message}>No decision logs yet.</p>
                    ) : (
                      myDecisions.map((item) => (
                        <div key={item.id} style={styles.feedCard}>
                          <div style={styles.feedTop}>
                            <div style={styles.feedName}>
                              {formatDate(item.created_at)}
                            </div>
                            <div style={styles.feedMeta}>
                              {item.is_read ? "Reviewed by leadership" : "Pending review"}
                            </div>
                          </div>

                          <div style={styles.feedSection}>
                            <div style={styles.feedLabel}>Situation</div>
                            <div style={styles.feedBody}>{item.situation || "—"}</div>
                          </div>

                          <div style={styles.feedSection}>
                            <div style={styles.feedLabel}>Action Taken</div>
                            <div style={styles.feedBody}>{item.action_taken || "—"}</div>
                          </div>

                          {item.reasoning ? (
                            <div style={styles.feedSection}>
                              <div style={styles.feedLabel}>Reasoning</div>
                              <div style={styles.feedBody}>{item.reasoning}</div>
                            </div>
                          ) : null}

                          {item.policy_referenced ? (
                            <div style={styles.policyTag}>
                              Policy Referenced: {item.policy_referenced}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {myCoaching.length === 0 ? (
                      <p style={styles.message}>No coaching requests yet.</p>
                    ) : (
                      myCoaching.map((item) => (
                        <div key={item.id} style={styles.feedCard}>
                          <div style={styles.feedTop}>
                            <div style={styles.feedName}>
                              {formatDate(item.created_at)}
                            </div>
                            <div style={styles.feedMeta}>{item.status || "open"}</div>
                          </div>

                          <div style={styles.feedBody}>{item.request_text || "—"}</div>

                          {item.leadership_notes ? (
                            <div style={styles.feedSection}>
                              <div style={styles.feedLabel}>GM Guidance</div>
                              <div style={styles.feedBody}>
                                {item.leadership_notes}
                              </div>
                            </div>
                          ) : (
                            <div style={styles.feedSection}>
                              <div style={styles.feedLabel}>Awaiting guidance</div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === TABS.facilities && canViewFacilities && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Facilities</h1>
                <p style={styles.subtitle}>
                  Select a facility to review General Manager performance and
                  operational activity.
                </p>

                {(selectedFacility || selectedGM) ? (
                  <div style={styles.breadcrumb}>
                    <button
                      style={styles.breadcrumbLink}
                      onClick={() => {
                        setSelectedFacility(null);
                        setFacilityGMs([]);
                        setSelectedGM(null);
                        setGmOwnDecisionLogs([]);
                        setGmOwnCoachingRequests([]);
                        setFacilityManagerSummaries([]);
                        setGmManagerIds([]);
                        setFacilitiesMessage("");
                      }}
                    >
                      Facilities
                    </button>

                    {selectedFacility ? (
                      <>
                        <span style={styles.breadcrumbSep}>›</span>
                        <button
                          style={styles.breadcrumbLink}
                          onClick={() => {
                            setSelectedGM(null);
                            setGmOwnDecisionLogs([]);
                            setGmOwnCoachingRequests([]);
                            setFacilityManagerSummaries([]);
                            setGmManagerIds([]);
                            setFacilitiesMessage("");
                          }}
                        >
                          Facility {selectedFacility.facility_number}
                        </button>
                      </>
                    ) : null}

                    {selectedGM ? (
                      <>
                        <span style={styles.breadcrumbSep}>›</span>
                        <span style={styles.breadcrumbCurrent}>
                          {selectedGM.full_name}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {facilitiesMessage ? (
                <p style={styles.message}>{facilitiesMessage}</p>
              ) : null}

              <div
                style={{
                  ...styles.splitLayout,
                  gridTemplateColumns: isMobile ? "1fr" : "320px minmax(0, 1fr)",
                }}
              >
                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Your Facilities</div>
                    <button style={styles.secondaryButton} onClick={fetchFacilities}>
                      Refresh
                    </button>
                  </div>

                  {facilitiesLoading ? (
                    <p style={styles.message}>Loading facilities...</p>
                  ) : facilities.length === 0 ? (
                    <div style={styles.emptyCard}>No facilities assigned.</div>
                  ) : (
                    <div style={styles.cardList}>
                      {facilities.map((facility) => {
                        const isActive =
                          selectedFacility?.facility_number === facility.facility_number &&
                          selectedFacility?.company === facility.company;

                        return (
                          <button
                            key={`${facility.company}-${facility.facility_number}`}
                            style={{
                              ...styles.facilityCard,
                              ...(isActive ? styles.facilityCardActive : {}),
                            }}
                            onClick={() => fetchFacilityGMs(facility)}
                          >
                            <div style={styles.rowName}>
                              Facility {facility.facility_number}
                            </div>
                            <div style={styles.rowMeta}>{facility.company}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>
                      {selectedFacility
                        ? `Facility ${selectedFacility.facility_number} — General Managers`
                        : "General Managers"}
                    </div>
                  </div>

                  {!selectedFacility ? (
                    <div style={styles.emptyCard}>Select a facility first.</div>
                  ) : facilityGMsLoading ? (
                    <p style={styles.message}>Loading general managers...</p>
                  ) : facilityGMs.length === 0 ? (
                    <div style={styles.emptyCard}>No general managers in this facility.</div>
                  ) : (
                    <div style={styles.cardList}>
                      {facilityGMs.map((gm) => {
                        const isActive = selectedGM?.id === gm.id;

                        return (
                          <button
                            key={gm.id}
                            style={{
                              ...styles.rowButton,
                              ...(isActive ? styles.rowButtonActive : {}),
                            }}
                            onClick={() => fetchGMData(gm)}
                          >
                            <div style={styles.rowName}>{gm.full_name}</div>
                            <div style={styles.rowMeta}>
                              General Manager • Facility {gm.facility_number}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {selectedGM ? (
                <>
                  <div style={styles.panelCard}>
                    <div style={styles.sectionHeading}>{selectedGM.full_name}</div>
                    <div style={{ ...styles.rowMeta, marginTop: "6px" }}>
                      General Manager • {selectedFacility?.company} • Facility{" "}
                      {selectedFacility?.facility_number}
                    </div>
                    <div style={{ ...styles.rowMeta, marginTop: "4px" }}>
                      {gmManagerIds.length} manager{gmManagerIds.length !== 1 ? "s" : ""} assigned
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.statGrid,
                      gridTemplateColumns: isMobile
                        ? "repeat(2, minmax(0, 1fr))"
                        : "repeat(3, minmax(0, 1fr))",
                    }}
                  >
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statValue, color: complianceColor }}>
                        {complianceDisplay}%
                      </div>
                      <div style={styles.statLabel}>Policy Compliance</div>
                    </div>

                    <div style={styles.statCard}>
                      <div style={styles.statValue}>{gmOwnDecisionLogs.length}</div>
                      <div style={styles.statLabel}>GM Decision Logs</div>
                    </div>

                    <div style={styles.statCard}>
                      <div style={styles.statValue}>{gmOwnCoachingRequests.length}</div>
                      <div style={styles.statLabel}>GM Coaching Requests</div>
                    </div>
                  </div>

                  <div style={styles.panelCard}>
                    <div style={styles.sectionHeading}>Facility Activity</div>

                    <div
                      style={{
                        ...styles.splitLayout,
                        gridTemplateColumns: isMobile ? "1fr" : "320px minmax(0, 1fr)",
                        marginTop: "18px",
                      }}
                    >
                      <div style={styles.panelInset}>
                        <div style={styles.feedLabel}>GM Logs & Requests</div>

                        <div style={styles.cardList}>
                          <div style={styles.feedCard}>
                            <div style={styles.feedName}>Decision Logs</div>
                            <div style={styles.statValueSmall}>
                              {gmOwnDecisionLogs.length}
                            </div>
                            <div style={styles.rowMeta}>
                              Submitted directly by this GM
                            </div>
                          </div>

                          <div style={styles.feedCard}>
                            <div style={styles.feedName}>Coaching Requests</div>
                            <div style={styles.statValueSmall}>
                              {gmOwnCoachingRequests.length}
                            </div>
                            <div style={styles.rowMeta}>
                              Support requests submitted by this GM
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={styles.panelInset}>
                        <div style={styles.feedLabel}>Facility Managers</div>

                        {facilityManagerSummaries.length === 0 ? (
                          <div style={styles.emptyCard}>
                            No managers assigned to this GM yet.
                          </div>
                        ) : (
                          <div style={styles.cardList}>
                            {facilityManagerSummaries.map((manager) => (
                              <div key={manager.id} style={styles.managerSummaryCard}>
                                <div style={styles.sectionTopRow}>
                                  <div>
                                    <div style={styles.feedName}>
                                      {manager.full_name}
                                    </div>
                                    <div style={styles.feedMeta}>
                                      {manager.role || "Manager"}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    ...styles.statGrid,
                                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                    marginTop: "12px",
                                  }}
                                >
                                  <div style={styles.statCardCompact}>
                                    <div style={styles.statValueSmall}>
                                      {manager.decisionCount}
                                    </div>
                                    <div style={styles.statLabel}>Logs</div>
                                  </div>

                                  <div style={styles.statCardCompact}>
                                    <div style={styles.statValueSmall}>
                                      {manager.coachingCount}
                                    </div>
                                    <div style={styles.statLabel}>Requests</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedFacility && !selectedGM ? (
                <div style={styles.emptyCard}>
                  Select a general manager to view facility activity.
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#07111f",
    color: "#e5e7eb",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: "16px",
    boxSizing: "border-box",
  },
  shell: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  topHeader: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "22px",
    padding: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  headerIdentity: {
    minWidth: "240px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    marginLeft: "auto",
  },
  smallLabel: {
    fontSize: "11px",
    letterSpacing: "0.12em",
    color: "#94a3b8",
    marginBottom: "10px",
  },
  topName: {
    fontSize: "30px",
    fontWeight: 800,
    lineHeight: 1.05,
    color: "#f8fafc",
    marginBottom: "8px",
  },
  topMeta: {
    fontSize: "15px",
    color: "#cbd5e1",
    marginBottom: "8px",
  },
  topCompany: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "4px",
  },
  companyMotto: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  navWrap: {
    marginTop: "14px",
    display: "flex",
    gap: "10px",
    padding: "10px 2px 2px",
  },
  navButton: {
    padding: "12px 16px",
    borderRadius: "999px",
    border: "1px solid #22324a",
    background: "#0f172a",
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  navButtonActive: {
    background: "linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%)",
    color: "#ffffff",
    border: "1px solid #2563eb",
    boxShadow: "0 10px 20px rgba(37,99,235,0.2)",
  },
  logoutButton: {
    padding: "12px 16px",
    borderRadius: "14px",
    border: "1px solid #243041",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    marginTop: "18px",
  },
  loadingCard: {
    maxWidth: "520px",
    margin: "120px auto",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "20px",
    padding: "32px",
    textAlign: "center",
    fontSize: "18px",
    color: "#e5e7eb",
  },
  headerCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "22px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  title: {
    margin: 0,
    fontSize: "42px",
    lineHeight: 1.02,
    fontWeight: 800,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: "10px",
    marginBottom: 0,
    fontSize: "16px",
    color: "#94a3b8",
    lineHeight: 1.65,
    maxWidth: "760px",
  },
  panelCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  },
  panelInset: {
    background: "#0b1324",
    border: "1px solid #18283f",
    borderRadius: "18px",
    padding: "18px",
  },
  splitLayout: {
    display: "grid",
    gap: "18px",
  },
  sectionTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  sectionHeading: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#f8fafc",
  },
  label: {
    display: "block",
    marginBottom: "10px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#e5e7eb",
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    borderRadius: "16px",
    border: "1px solid #273449",
    background: "#08111f",
    color: "#f8fafc",
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  textareaSmall: {
    width: "100%",
    minHeight: "130px",
    borderRadius: "16px",
    border: "1px solid #273449",
    background: "#08111f",
    color: "#f8fafc",
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  textInput: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #273449",
    background: "#08111f",
    color: "#f8fafc",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  primaryButton: {
    padding: "13px 18px",
    borderRadius: "14px",
    border: "1px solid #2563eb",
    background: "#1d4ed8",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 14px",
    borderRadius: "14px",
    border: "1px solid #334155",
    background: "#08111f",
    color: "#e5e7eb",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "10px",
    fontSize: "14px",
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  emptyCard: {
    background: "#08111f",
    border: "1px dashed #243041",
    borderRadius: "18px",
    padding: "18px",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  feedCard: {
    background: "#08111f",
    border: "1px solid #18283f",
    borderRadius: "18px",
    padding: "16px",
  },
  feedTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  feedName: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: "4px",
  },
  feedMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  feedDate: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  feedSection: {
    marginTop: "12px",
  },
  feedLabel: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: "6px",
  },
  feedBody: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#e5e7eb",
    whiteSpace: "pre-wrap",
  },
  policyTag: {
    marginTop: "12px",
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.22)",
    color: "#93c5fd",
    fontSize: "12px",
    fontWeight: 700,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "#111827",
    color: "#cbd5e1",
    border: "1px solid #334155",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  rowButton: {
    width: "100%",
    textAlign: "left",
    borderRadius: "16px",
    border: "1px solid #18283f",
    background: "#08111f",
    padding: "16px",
    cursor: "pointer",
  },
  rowButtonActive: {
    border: "1px solid #2563eb",
    background: "rgba(37,99,235,0.12)",
  },
  rowName: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: "4px",
  },
  rowMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  chooserGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  chooserCard: {
    textAlign: "left",
    borderRadius: "18px",
    border: "1px solid #18283f",
    background: "#08111f",
    padding: "20px",
    cursor: "pointer",
  },
  chooserTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: "8px",
  },
  chooserMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  facilityCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: "16px",
    border: "1px solid #18283f",
    background: "#08111f",
    padding: "16px",
    cursor: "pointer",
  },
  facilityCardActive: {
    border: "1px solid #2563eb",
    background: "rgba(37,99,235,0.12)",
  },
  statGrid: {
    display: "grid",
    gap: "14px",
  },
  statCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "20px",
    padding: "22px",
    textAlign: "center",
  },
  statCardCompact: {
    background: "#08111f",
    border: "1px solid #18283f",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "center",
  },
  statValue: {
    fontSize: "42px",
    fontWeight: 800,
    lineHeight: 1,
    color: "#f8fafc",
    marginBottom: "8px",
  },
  statValueSmall: {
    fontSize: "32px",
    fontWeight: 800,
    lineHeight: 1,
    color: "#f8fafc",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#94a3b8",
    fontWeight: 800,
  },
  managerSummaryCard: {
    background: "#08111f",
    border: "1px solid #18283f",
    borderRadius: "18px",
    padding: "16px",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px",
  },
  breadcrumbLink: {
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "#60a5fa",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  breadcrumbCurrent: {
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: 700,
  },
  breadcrumbSep: {
    color: "#64748b",
    fontSize: "14px",
  },
};
