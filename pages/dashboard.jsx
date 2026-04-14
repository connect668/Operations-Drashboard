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

  const [decisionLoading, setDecisionLoading] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [teamDecisionsLoading, setTeamDecisionsLoading] = useState(false);
  const [teamCoachingLoading, setTeamCoachingLoading] = useState(false);
  const [managersLoading, setManagersLoading] = useState(false);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Area Manager – Facilities
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesMessage, setFacilitiesMessage] = useState("");
  const [gmActivityTab, setGmActivityTab] = useState("decisions");
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityGMs, setFacilityGMs] = useState([]);
  const [facilityGMsLoading, setFacilityGMsLoading] = useState(false);
  const [selectedGM, setSelectedGM] = useState(null);
  const [gmManagers, setGmManagers] = useState([]);
  const [gmDecisionLogs, setGmDecisionLogs] = useState([]);
  const [gmCoachingRequests, setGmCoachingRequests] = useState([]);
  const [gmDataLoading, setGmDataLoading] = useState(false);

  const currentRoleLevel = useMemo(() => {
    return ROLE_LEVELS[profile?.role] || 1;
  }, [profile]);

  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const isAreaManager = profile?.role === "Area Manager";
  const nextRole = getNextRole(profile?.role);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          window.location.href = "/";
          return;
        }

        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, company")
          .eq("id", user.id)
          .maybeSingle();

        console.log("AUTH USER:", user);
        console.log("PROFILE DATA:", profileData);
        console.log("PROFILE ERROR:", profileError);

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
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!profile?.company || !profile?.role || !canViewLeadershipTabs) return;

    fetchTeamDecisions();
    fetchTeamCoachingRequests();
    fetchManagers();
  }, [profile?.company, profile?.role, canViewLeadershipTabs]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
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
      console.error("Fetch team decisions error:", error);
      setTeamDecisionsMessage(
        error.message || "Failed to load team decisions."
      );
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
      const { data: decisionData, error: decisionError } = await supabase
        .from("decision_logs")
        .select("*")
        .eq("user_id", manager.id)
        .order("created_at", { ascending: false });

      if (decisionError) throw decisionError;

      const { data: coachingData, error: coachingError } = await supabase
        .from("coaching_requests")
        .select("*")
        .eq("user_id", manager.id)
        .order("created_at", { ascending: false });

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

      // Find or fetch the manager then open their file
      let manager = managers.find((m) => m.id === userId);

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

  const updateCoachingStatus = async (id, status) => {
    try {
      const { error } = await supabase
        .from("coaching_requests")
        .update({
          status,
          // updated_at is set automatically by DB trigger
        })
        .eq("id", id);

      if (error) throw error;

      await fetchTeamCoachingRequests();

      if (selectedManager) {
        await openManagerFile(selectedManager);
      }
    } catch (error) {
      console.error("Update coaching status error:", error);
      setTeamCoachingMessage(
        error.message || "Failed to update coaching request status."
      );
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
          // updated_at is set automatically by DB trigger
        })
        .eq("id", requestId);

      if (error) throw error;

      setGuidanceActiveId(null);
      setGuidanceText("");
      await fetchTeamCoachingRequests();

      // Navigate to that manager's file
      let manager = managers.find((m) => m.id === userId);
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
      console.error("Fetch facilities error:", err);
      setFacilitiesMessage(err.message || "Failed to load facilities.");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const fetchFacilityGMs = async (facility) => {
    setSelectedFacility(facility);
    setSelectedGM(null);
    setFacilityGMs([]);
    setGmDecisionLogs([]);
    setGmCoachingRequests([]);
    setFacilityGMsLoading(true);
    setFacilitiesMessage("");
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
      console.error("Fetch facility GMs error:", err);
      setFacilitiesMessage(err.message || "Failed to load GMs.");
    } finally {
      setFacilityGMsLoading(false);
    }
  };

  const fetchGMData = async (gm) => {
    setSelectedGM(gm);
    setGmDataLoading(true);
    setGmActivityTab("decisions");
    setGmManagers([]);
    setGmDecisionLogs([]);
    setGmCoachingRequests([]);
    setFacilitiesMessage("");
    try {
      const { data: assignments, error: aErr } = await supabase
        .from("gm_manager_assignments")
        .select("manager_id")
        .eq("gm_id", gm.id);
      if (aErr) throw aErr;

      const managerIds = (assignments || []).map((a) => a.manager_id);
      setGmManagers(managerIds);

      if (managerIds.length === 0) {
        setFacilitiesMessage("No managers assigned to this GM yet.");
        return;
      }

      const [{ data: decisions, error: dErr }, { data: coaching, error: cErr }] =
        await Promise.all([
          supabase.from("decision_logs").select("*").in("user_id", managerIds).order("created_at", { ascending: false }),
          supabase.from("coaching_requests").select("*").in("user_id", managerIds).order("created_at", { ascending: false }),
        ]);
      if (dErr) throw dErr;
      if (cErr) throw cErr;
      setGmDecisionLogs(decisions || []);
      setGmCoachingRequests(coaching || []);
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

  const formatDate = (value) => {
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const getManagerDisplayName = (manager) =>
    manager?.full_name || "Unnamed Manager";

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading dashboard...</div>
      </div>
    );
  }

  const navClick = (fn) => {
    fn();
    if (isMobile) setMobileMenuOpen(false);
  };

  return (
    <div style={{ ...styles.page, padding: isMobile ? "16px" : "24px" }}>
      {/* Mobile top bar */}
      {isMobile && (
        <div style={styles.mobileTopBar}>
          <div>
            <div style={styles.mobileTopName}>{profile?.full_name || "Dashboard"}</div>
            <div style={styles.mobileTopRole}>{profile?.role} · {profile?.company}</div>
          </div>
          <button style={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      )}

      {/* Mobile nav overlay */}
      {isMobile && mobileMenuOpen && (
        <div style={styles.mobileOverlay}>
          <div style={styles.navGroup}>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.policy ? styles.navButtonActive : {}) }} onClick={() => navClick(() => setActiveTab(TABS.policy))}>Request Policy</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.decision ? styles.navButtonActive : {}) }} onClick={() => navClick(() => setActiveTab(TABS.decision))}>Document Decision</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.coaching ? styles.navButtonActive : {}) }} onClick={() => navClick(() => setActiveTab(TABS.coaching))}>Request Coaching</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.myLogs ? styles.navButtonActive : {}) }} onClick={() => navClick(() => { setActiveTab(TABS.myLogs); fetchMyLogs(); })}>My Logs</button>
            {canViewLeadershipTabs && !isAreaManager && (
              <>
                <div style={styles.navDivider} />
                <button style={{ ...styles.navButton, ...(activeTab === TABS.teamDecisions ? styles.navButtonActive : {}) }} onClick={() => navClick(() => { setActiveTab(TABS.teamDecisions); fetchTeamDecisions(); })}>Team Decisions</button>
                <button style={{ ...styles.navButton, ...(activeTab === TABS.teamCoaching ? styles.navButtonActive : {}) }} onClick={() => navClick(() => { setActiveTab(TABS.teamCoaching); fetchTeamCoachingRequests(); })}>Team Coaching</button>
                <button style={{ ...styles.navButton, ...(activeTab === TABS.managers ? styles.navButtonActive : {}) }} onClick={() => navClick(() => { setActiveTab(TABS.managers); fetchManagers(); })}>Managers</button>
              </>
            )}
            {isAreaManager && (
              <>
                <div style={styles.navDivider} />
                <button style={{ ...styles.navButton, ...(activeTab === TABS.facilities ? styles.navButtonActive : {}) }} onClick={() => navClick(() => { setActiveTab(TABS.facilities); fetchFacilities(); })}>Facilities</button>
              </>
            )}
            <div style={styles.navDivider} />
            <button style={styles.logoutButton} onClick={handleLogout}>Log Out</button>
          </div>
        </div>
      )}

      <div style={isMobile ? styles.containerMobile : styles.container}>
        {/* Desktop sidebar only */}
        {!isMobile && (
        <aside style={styles.sidebar}>
          <div style={styles.brandCard}>
            <div style={styles.smallLabel}>SIGNED IN AS</div>
            <div style={styles.userName}>
              {profile?.full_name || "No name found"}
            </div>
            <div style={styles.userMeta}>
              {profile?.role || "No role assigned"}
            </div>
            <div style={styles.companyName}>
              {profile?.company || "No company assigned"}
            </div>
            <div style={styles.companyMotto}>company motto here</div>
          </div>

          <div style={styles.navGroup}>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.policy ? styles.navButtonActive : {}) }} onClick={() => setActiveTab(TABS.policy)}>Request Policy</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.decision ? styles.navButtonActive : {}) }} onClick={() => setActiveTab(TABS.decision)}>Document Decision</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.coaching ? styles.navButtonActive : {}) }} onClick={() => setActiveTab(TABS.coaching)}>Request Coaching</button>
            <button style={{ ...styles.navButton, ...(activeTab === TABS.myLogs ? styles.navButtonActive : {}) }} onClick={() => { setActiveTab(TABS.myLogs); fetchMyLogs(); }}>My Logs</button>

            {canViewLeadershipTabs && !isAreaManager && (
              <>
                <div style={styles.navDivider} />
                <button style={{ ...styles.navButton, ...(activeTab === TABS.teamDecisions ? styles.navButtonActive : {}) }} onClick={() => { setActiveTab(TABS.teamDecisions); fetchTeamDecisions(); }}>Team Decisions</button>
                <button style={{ ...styles.navButton, ...(activeTab === TABS.teamCoaching ? styles.navButtonActive : {}) }} onClick={() => { setActiveTab(TABS.teamCoaching); fetchTeamCoachingRequests(); }}>Team Coaching Requests</button>
                <button style={{ ...styles.navButton, ...(activeTab === TABS.managers ? styles.navButtonActive : {}) }} onClick={() => { setActiveTab(TABS.managers); fetchManagers(); }}>Managers</button>
              </>
            )}
            {isAreaManager && (
              <>
                <div style={styles.navDivider} />
                <button style={{ ...styles.navButton, ...(activeTab === TABS.facilities ? styles.navButtonActive : {}) }} onClick={() => { setActiveTab(TABS.facilities); fetchFacilities(); }}>Facilities</button>
              </>
            )}
          </div>

          <div style={styles.logoutWrap}>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </aside>
        )}

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
                  style={styles.policyInput}
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

          {activeTab === TABS.teamDecisions && canViewLeadershipTabs && (
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
                  <button
                    style={styles.secondaryButton}
                    onClick={fetchTeamDecisions}
                  >
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
                              {item.user_role || "Manager"} •{" "}
                              {item.company || "No company"}
                            </div>
                          </div>
                          <div style={styles.feedDate}>
                            {formatDate(item.created_at)}
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

          {activeTab === TABS.teamCoaching && canViewLeadershipTabs && (
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
                              {item.requester_role || "Manager"} •{" "}
                              {item.company || "No company"}
                            </div>
                          </div>
                          <div style={styles.feedDate}>
                            {formatDate(item.created_at)}
                          </div>
                        </div>

                        <div style={styles.statusRow}>
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
                            <div style={styles.feedBody}>
                              {item.leadership_notes}
                            </div>
                          </div>
                        ) : null}

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

          {activeTab === TABS.managers && canViewLeadershipTabs && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Managers</h1>
                <p style={styles.subtitle}>
                  Review managers and open their documentation history.
                </p>
              </div>

              <div style={{ ...styles.managersLayout, gridTemplateColumns: isMobile ? "1fr" : "360px 1fr" }}>
                <div style={styles.panelCard}>
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Manager Directory</div>
                    <button
                      style={styles.secondaryButton}
                      onClick={fetchManagers}
                    >
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
                            ...styles.managerRowButton,
                            ...(selectedManager?.id === manager.id
                              ? styles.managerRowButtonActive
                              : {}),
                          }}
                          onClick={() => openManagerFile(manager)}
                        >
                          <div style={styles.managerRowName}>
                            {getManagerDisplayName(manager)}
                          </div>
                          <div style={styles.managerRowMeta}>
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
                    {managerFileTab && (
                      <button
                        style={styles.secondaryButton}
                        onClick={() => setManagerFileTab(null)}
                      >
                        ← Back
                      </button>
                    )}
                  </div>

                  {!selectedManager ? (
                    <p style={styles.message}>
                      Select a manager to view their documentation.
                    </p>
                  ) : selectedManagerLoading ? (
                    <p style={styles.message}>Loading manager file...</p>
                  ) : !managerFileTab ? (
                    <div style={styles.logTypeSelector}>
                      <button
                        style={styles.logTypeButton}
                        onClick={() => setManagerFileTab("decisions")}
                      >
                        <div style={styles.logTypeTitle}>Decision Logs</div>
                        <div style={styles.logTypeMeta}>
                          {selectedManagerDecisions.length} record{selectedManagerDecisions.length !== 1 ? "s" : ""}
                        </div>
                      </button>
                      <button
                        style={styles.logTypeButton}
                        onClick={() => setManagerFileTab("coaching")}
                      >
                        <div style={styles.logTypeTitle}>Coaching Logs</div>
                        <div style={styles.logTypeMeta}>
                          {selectedManagerCoaching.length} record{selectedManagerCoaching.length !== 1 ? "s" : ""}
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
                                <div style={styles.feedLabel}>Operational Guidance</div>
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
                  <div style={styles.logTypeSelector}>
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
                      <div key={item.id} style={styles.feedCard}>
                        <div style={styles.feedTop}>
                          <div style={styles.feedName}>{formatDate(item.created_at)}</div>
                          <div style={styles.feedMeta}>{item.is_read ? "Reviewed by leadership" : "Pending review"}</div>
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
                          <div style={styles.policyTag}>Policy Referenced: {item.policy_referenced}</div>
                        ) : null}
                      </div>
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
                          <div style={styles.feedSection}>
                            <div style={{ ...styles.feedLabel, color: "#6b7280" }}>Awaiting guidance</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {activeTab === TABS.facilities && isAreaManager && (() => {
            // Mock metrics from GM name hash
            const getMockMetrics = (gm) => {
              const h = (gm.full_name || "GM").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
              return { policyRef: 40 + (h % 55), activity: 8 + (h % 38), compliance: 50 + ((h * 7) % 44) };
            };

            // Mock overall metric for facility card display
            const getFacilityMetric = (f) => {
              const h = (f.facility_number || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
              return 55 + (h % 40); // 55–94%
            };

            // Real metrics for selected GM
            const policyRefPct = gmDecisionLogs.length > 0
              ? Math.round(gmDecisionLogs.filter((l) => l.policy_referenced?.trim()).length / gmDecisionLogs.length * 100)
              : null;
            const totalActivity = gmDecisionLogs.length + gmCoachingRequests.length;
            const compliancePct = 87;

            const metricColor = (val) => {
              if (val >= 80) return { text: "#4ade80", bg: "rgba(74,222,128,0.07)", border: "rgba(74,222,128,0.2)" };
              if (val >= 60) return { text: "#fbbf24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.2)" };
              return { text: "#f87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.2)" };
            };

            return (
              <>
                {/* Animation keyframes injected once */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes amFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                  .am-fade { animation: amFadeUp 0.22s ease both; }
                  .am-facility-btn { transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease !important; }
                  .am-facility-btn:hover { transform: translateY(-1px) !important; }
                  .am-gm-card { transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease !important; cursor: pointer; }
                  .am-gm-card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; border-color: #334155 !important; }
                  .am-metric-mini { transition: transform 0.15s ease !important; }
                  .am-metric-mini:hover { transform: translateY(-1px) !important; }
                  .am-feed-card { transition: border-color 0.15s ease !important; }
                  .am-feed-card:hover { border-color: #334155 !important; }
                `}} />

                <div style={styles.headerCard}>
                  <h1 style={styles.title}>Facilities</h1>
                  <p style={styles.subtitle}>
                    Select a facility to review General Manager performance and operational activity.
                  </p>
                  {isMobile && (selectedFacility || selectedGM) && (
                    <div style={styles.breadcrumb}>
                      <button style={styles.breadcrumbLink} onClick={() => { setSelectedFacility(null); setSelectedGM(null); }}>Facilities</button>
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
                </div>

                {facilitiesMessage && <p style={styles.message}>{facilitiesMessage}</p>}

                <div style={isMobile ? { display: "flex", flexDirection: "column", gap: "16px" } : styles.facilitiesLayout}>

                  {/* ── PANEL 1: Facilities ── */}
                  {(!isMobile || (!selectedFacility && !selectedGM)) && (
                    <div style={styles.panelCard} className="am-fade">
                      <div style={styles.sectionHeading}>Your Facilities</div>
                      {facilitiesLoading ? (
                        <p style={styles.message}>Loading...</p>
                      ) : facilities.length === 0 ? (
                        <p style={styles.message}>No facilities assigned.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
                          {facilities.map((f, i) => {
                            const isSelected = selectedFacility?.facility_number === f.facility_number && selectedFacility?.company === f.company;
                            const facilityPct = getFacilityMetric(f);
                            const fc = metricColor(facilityPct);
                            return (
                              <button
                                key={`${f.company}-${f.facility_number}`}
                                className="am-facility-btn"
                                style={{
                                  ...styles.managerRowButton,
                                  ...(isSelected ? { ...styles.managerRowButtonActive, borderColor: "#3b82f6" } : {}),
                                  animationDelay: `${i * 0.04}s`,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                                onClick={() => fetchFacilityGMs(f)}
                              >
                                <div>
                                  <div style={styles.managerRowName}>Facility {f.facility_number}</div>
                                  <div style={styles.managerRowMeta}>{f.company}</div>
                                </div>
                                <span style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, background: fc.bg, color: fc.text, border: `1px solid ${fc.border}`, flexShrink: 0 }}>
                                  {facilityPct}%
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── PANEL 2: GM list with metric badges ── */}
                  {(!isMobile || (selectedFacility && !selectedGM)) && (
                    <div style={styles.panelCard} className="am-fade">
                      <div style={styles.sectionHeading}>
                        {selectedFacility ? `Facility ${selectedFacility.facility_number} — GMs` : "General Managers"}
                      </div>
                      {!selectedFacility ? (
                        <p style={styles.message}>Select a facility.</p>
                      ) : facilityGMsLoading ? (
                        <p style={styles.message}>Loading GMs...</p>
                      ) : facilityGMs.length === 0 ? (
                        <p style={styles.message}>No GMs in this facility.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                          {facilityGMs.map((gm, i) => {
                            const mock = getMockMetrics(gm);
                            const isSelected = selectedGM?.id === gm.id;
                            const pr = metricColor(mock.policyRef);
                            const cp = metricColor(mock.compliance);
                            return (
                              <div
                                key={gm.id}
                                className="am-gm-card"
                                style={{
                                  background: isSelected ? "#1a2740" : "#0f172a",
                                  border: `1px solid ${isSelected ? "#3b82f6" : "#1f2937"}`,
                                  borderRadius: "14px",
                                  padding: "16px",
                                  animationDelay: `${i * 0.05}s`,
                                }}
                                onClick={() => fetchGMData(gm)}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                  <div>
                                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>{gm.full_name}</div>
                                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>General Manager</div>
                                  </div>
                                  {isSelected && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />}
                                </div>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  <span className="am-metric-mini" style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 600, background: pr.bg, color: pr.text, border: `1px solid ${pr.border}` }}>
                                    {mock.policyRef}% policy
                                  </span>
                                  <span className="am-metric-mini" style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 600, background: "rgba(148,163,184,0.06)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.14)" }}>
                                    {mock.activity} actions
                                  </span>
                                  <span className="am-metric-mini" style={{ padding: "3px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 600, background: cp.bg, color: cp.text, border: `1px solid ${cp.border}` }}>
                                    {mock.compliance}% compliance
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── PANEL 3: GM detail view ── */}
                  {(!isMobile || selectedGM) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {!selectedGM ? (
                        <div style={styles.panelCard}>
                          <p style={styles.message}>Select a GM to view their operational overview.</p>
                        </div>
                      ) : gmDataLoading ? (
                        <div style={styles.panelCard}>
                          <p style={styles.message}>Loading GM data...</p>
                        </div>
                      ) : (
                        <>
                          {/* GM header + inline metrics */}
                          <div style={{ ...styles.panelCard, borderColor: "#1e3a5f" }} className="am-fade">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc" }}>{selectedGM.full_name}</div>
                                <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                                  General Manager · {selectedFacility?.company} · Facility {selectedFacility?.facility_number}
                                </div>
                                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                                  {gmManagers.length} manager{gmManagers.length !== 1 ? "s" : ""} assigned
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {[
                                  { label: "Policy Rate", val: policyRefPct !== null ? `${policyRefPct}%` : "—", color: policyRefPct !== null ? metricColor(policyRefPct) : null, mock: false },
                                  { label: "Activity",    val: totalActivity, color: null, mock: false },
                                  { label: "Compliance",  val: `${compliancePct}%`, color: metricColor(compliancePct), mock: true },
                                ].map(({ label, val, color, mock }) => (
                                  <div key={label} className="am-metric-mini" style={{
                                    ...styles.metricCard,
                                    minWidth: "88px",
                                    padding: "14px 16px",
                                    ...(color ? { borderColor: color.border, background: color.bg } : {}),
                                  }}>
                                    <div style={{ ...styles.metricValue, fontSize: "24px", color: color ? color.text : "#f8fafc" }}>{val}</div>
                                    <div style={{ ...styles.metricLabel, fontSize: "11px" }}>{label}</div>
                                    {mock && <div style={styles.mockBadge}>MOCK</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Facility Activity — tabbed */}
                          <div style={styles.panelCard} className="am-fade">
                            <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: "14px" }}>
                              Facility Activity
                            </div>
                            {/* Tab row */}
                            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                              {[
                                { key: "decisions", label: "Decision Logs", count: gmDecisionLogs.length },
                                { key: "coaching",  label: "Coaching Requests", count: gmCoachingRequests.length },
                              ].map(({ key, label, count }) => (
                                <button
                                  key={key}
                                  onClick={() => setGmActivityTab(key)}
                                  style={{
                                    flex: 1,
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: `1px solid ${gmActivityTab === key ? "#3b82f6" : "#1f2937"}`,
                                    background: gmActivityTab === key ? "rgba(59,130,246,0.1)" : "transparent",
                                    color: gmActivityTab === key ? "#60a5fa" : "#6b7280",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  {label}
                                  <span style={{ marginLeft: "6px", fontSize: "11px", opacity: 0.7 }}>({count})</span>
                                </button>
                              ))}
                            </div>

                            {/* Decision Logs content */}
                            {gmActivityTab === "decisions" && (
                              gmDecisionLogs.length === 0 ? (
                                <p style={styles.message}>No decision logs from this GM's managers.</p>
                              ) : (
                                <div style={styles.cardList}>
                                  {gmDecisionLogs.map((item) => (
                                    <div key={item.id} className="am-feed-card" style={styles.feedCard}>
                                      <div style={styles.feedTop}>
                                        <div style={styles.feedName}>{item.user_name || "Unknown"}</div>
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
                                      {item.reasoning && (
                                        <div style={styles.feedSection}>
                                          <div style={styles.feedLabel}>Reasoning</div>
                                          <div style={styles.feedBody}>{item.reasoning}</div>
                                        </div>
                                      )}
                                      {item.policy_referenced && (
                                        <div style={styles.policyTag}>Policy Referenced: {item.policy_referenced}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )
                            )}

                            {/* Coaching Requests content */}
                            {gmActivityTab === "coaching" && (
                              gmCoachingRequests.length === 0 ? (
                                <p style={styles.message}>No coaching requests from this GM's managers.</p>
                              ) : (
                                <div style={styles.cardList}>
                                  {gmCoachingRequests.map((item) => (
                                    <div key={item.id} className="am-feed-card" style={styles.feedCard}>
                                      <div style={styles.feedTop}>
                                        <div style={styles.feedName}>{item.requester_name || "Unknown"}</div>
                                        <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                                      </div>
                                      <div style={styles.feedBody}>{item.request_text || "—"}</div>
                                      {item.leadership_notes && (
                                        <div style={{ ...styles.feedSection, borderLeft: "3px solid #2563eb", paddingLeft: "12px", marginTop: "12px" }}>
                                          <div style={{ ...styles.feedLabel, color: "#60a5fa" }}>GM Guidance</div>
                                          <div style={styles.feedBody}>{item.leadership_notes}</div>
                                        </div>
                                      )}
                                      <div style={{ marginTop: "10px" }}>
                                        <span style={{
                                          ...styles.statusBadge,
                                          background: item.guidance_given ? "rgba(74,222,128,0.07)" : "#1c1917",
                                          color: item.guidance_given ? "#4ade80" : "#a8a29e",
                                          border: `1px solid ${item.guidance_given ? "rgba(74,222,128,0.2)" : "#292524"}`,
                                        }}>
                                          {item.guidance_given ? "Guidance Given" : item.status || "open"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e5e7eb",
    padding: "24px",
    boxSizing: "border-box",
    overflowX: "hidden",
    maxWidth: "100vw",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: "1440px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "24px",
  },
  sidebar: {
    minHeight: "calc(100vh - 48px)",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
  },
  brandCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "22px",
  },
  smallLabel: {
    fontSize: "11px",
    letterSpacing: "0.12em",
    color: "#94a3b8",
    marginBottom: "10px",
  },
  userName: {
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1.15,
    marginBottom: "8px",
    color: "#f8fafc",
  },
  userMeta: {
    fontSize: "14px",
    color: "#cbd5e1",
    marginBottom: "10px",
  },
  companyName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#e5e7eb",
    marginBottom: "4px",
  },
  companyMotto: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  navDivider: {
    height: "1px",
    background: "#1f2937",
    margin: "8px 0 4px",
  },
  navButton: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #1f2937",
    background: "#111827",
    color: "#e5e7eb",
    fontSize: "15px",
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
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #243041",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  headerCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "24px",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.05,
    fontWeight: 700,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: "10px",
    marginBottom: 0,
    fontSize: "16px",
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
    gridTemplateColumns: "360px 1fr",
    gap: "18px",
  },
  label: {
    display: "block",
    marginBottom: "10px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#e5e7eb",
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    borderRadius: "14px",
    border: "1px solid #273449",
    background: "#0f172a",
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
    borderRadius: "14px",
    border: "1px solid #273449",
    background: "#0f172a",
    color: "#f8fafc",
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  primaryButton: {
    padding: "13px 20px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e5e7eb",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "12px",
    fontSize: "14px",
    color: "#94a3b8",
  },
  loadingCard: {
    maxWidth: "600px",
    margin: "120px auto",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "32px",
    textAlign: "center",
    fontSize: "18px",
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
    fontSize: "20px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
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
    marginBottom: "12px",
  },
  feedName: {
    fontSize: "16px",
    fontWeight: 700,
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
    whiteSpace: "nowrap",
  },
  feedSection: {
    marginTop: "12px",
  },
  feedLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
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
  statusRow: {
    marginBottom: "10px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
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
    marginTop: "14px",
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
    marginBottom: "4px",
  },
  managerRowMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  managerFileWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  managerFileSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  managerFileTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  policyInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #1f2937",
    backgroundColor: "#0f172a",
    color: "#cbd5e1",
    fontSize: "13px",
    width: "100%",
    outline: "none",
  },
  policyTag: {
    marginTop: "10px",
    padding: "5px 10px",
    borderRadius: "6px",
    border: "1px solid #1e3a5f",
    backgroundColor: "#0c1e35",
    color: "#60a5fa",
    fontSize: "12px",
    display: "inline-block",
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
  },
  guidanceButtons: {
    display: "flex",
    gap: "10px",
  },
  containerMobile: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "0",
  },
  mobileTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "14px 18px",
    marginBottom: "16px",
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
    fontSize: "18px",
    lineHeight: 1,
  },
  mobileOverlay: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "16px",
  },
  facilitiesLayout: {
    display: "grid",
    gridTemplateColumns: "240px 260px 1fr",
    gap: "18px",
    alignItems: "start",
  },
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "14px",
  },
  metricsStackMobile: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  metricCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "22px 18px",
    textAlign: "center",
    position: "relative",
  },
  metricValue: {
    fontSize: "42px",
    fontWeight: 800,
    color: "#f8fafc",
    lineHeight: 1,
    marginBottom: "8px",
  },
  metricLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: "4px",
  },
  metricSub: {
    fontSize: "12px",
    color: "#6b7280",
  },
  mockBadge: {
    position: "absolute",
    top: "10px",
    right: "10px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#78716c",
    background: "#1c1917",
    border: "1px solid #292524",
    borderRadius: "4px",
    padding: "2px 6px",
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
  logTypeSelector: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "8px",
  },
  logTypeButton: {
    padding: "24px 20px",
    borderRadius: "16px",
    border: "1px solid #1f2937",
    background: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  logTypeTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "6px",
  },
  logTypeMeta: {
    fontSize: "13px",
    color: "#94a3b8",
  },
};
