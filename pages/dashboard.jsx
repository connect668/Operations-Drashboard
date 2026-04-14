import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TABS = {
  policy: "policy",
  decision: "decision",
  coaching: "coaching",
  teamDecisions: "team_decisions",
  teamCoaching: "team_coaching",
  managers: "managers",
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
  const [guidanceLoadingId, setGuidanceLoadingId] = useState(null);

  const [teamDecisions, setTeamDecisions] = useState([]);
  const [teamCoachingRequests, setTeamCoachingRequests] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedManagerDecisions, setSelectedManagerDecisions] = useState([]);
  const [selectedManagerCoaching, setSelectedManagerCoaching] = useState([]);
  const [selectedManagerLoading, setSelectedManagerLoading] = useState(false);

  const currentRoleLevel = useMemo(() => {
    return ROLE_LEVELS[profile?.role] || 1;
  }, [profile]);

  const canViewLeadershipTabs = currentRoleLevel >= 2;
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
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Profile load error:", profileError);
        } else {
          setProfile(profileData);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
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
          user_name:
            profile?.full_name ||
            profile?.name ||
            user?.email ||
            "Unknown User",
          user_role: profile?.role || "Manager",
          submitted_by_role: profile?.role || "Manager",
          visible_to_role: nextRole,
          situation: decisionSituation.trim(),
          action_taken: decisionAction.trim(),
          reasoning: decisionReasoning.trim() || null,
          is_read: false,
        },
      ]);

      if (error) throw error;

      setDecisionSituation("");
      setDecisionAction("");
      setDecisionReasoning("");
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
          requester_name:
            profile?.full_name ||
            profile?.name ||
            user?.email ||
            "Unknown User",
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
        .neq("user_id", user?.id || "")
        .order("is_read", { ascending: true })
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
        .select("id, full_name, name, role, company")
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

  const markDecisionAsRead = async (id) => {
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

      fetchTeamDecisions();
      if (selectedManager) {
        openManagerFile(selectedManager);
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      fetchTeamCoachingRequests();
      if (selectedManager) {
        openManagerFile(selectedManager);
      }
    } catch (error) {
      console.error("Update coaching status error:", error);
      setTeamCoachingMessage(
        error.message || "Failed to update coaching request status."
      );
    }
  };

  const handleRequestCoachingGuidance = async (requestId) => {
    setGuidanceLoadingId(requestId);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTeamCoachingMessage(
        "AI coaching guidance will connect here next. Button is in place."
      );
    } catch (error) {
      console.error("Guidance placeholder error:", error);
    } finally {
      setGuidanceLoadingId(null);
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
    manager?.full_name || manager?.name || "Unnamed Manager";

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <aside style={styles.sidebar}>
          <div style={styles.brandCard}>
            <div style={styles.smallLabel}>SIGNED IN AS</div>
            <div style={styles.userName}>
              {profile?.full_name || profile?.name || "User"}
            </div>
            <div style={styles.userMeta}>{profile?.role || "Manager"}</div>
            <div style={styles.companyName}>
              {profile?.company || "INITIATIVE ENTERPRISES"}
            </div>
            <div style={styles.companyMotto}>company motto here</div>
          </div>

          <div style={styles.navGroup}>
            <button
              style={{
                ...styles.navButton,
                ...(activeTab === TABS.policy ? styles.navButtonActive : {}),
              }}
              onClick={() => setActiveTab(TABS.policy)}
            >
              Request Policy
            </button>

            <button
              style={{
                ...styles.navButton,
                ...(activeTab === TABS.decision ? styles.navButtonActive : {}),
              }}
              onClick={() => setActiveTab(TABS.decision)}
            >
              Document Decision
            </button>

            <button
              style={{
                ...styles.navButton,
                ...(activeTab === TABS.coaching ? styles.navButtonActive : {}),
              }}
              onClick={() => setActiveTab(TABS.coaching)}
            >
              Request Coaching
            </button>

            {canViewLeadershipTabs && (
              <>
                <div style={styles.navDivider} />

                <button
                  style={{
                    ...styles.navButton,
                    ...(activeTab === TABS.teamDecisions
                      ? styles.navButtonActive
                      : {}),
                  }}
                  onClick={() => {
                    setActiveTab(TABS.teamDecisions);
                    fetchTeamDecisions();
                  }}
                >
                  Team Decisions
                </button>

                <button
                  style={{
                    ...styles.navButton,
                    ...(activeTab === TABS.teamCoaching
                      ? styles.navButtonActive
                      : {}),
                  }}
                  onClick={() => {
                    setActiveTab(TABS.teamCoaching);
                    fetchTeamCoachingRequests();
                  }}
                >
                  Team Coaching Requests
                </button>

                <button
                  style={{
                    ...styles.navButton,
                    ...(activeTab === TABS.managers
                      ? styles.navButtonActive
                      : {}),
                  }}
                  onClick={() => {
                    setActiveTab(TABS.managers);
                    fetchManagers();
                  }}
                >
                  Managers
                </button>
              </>
            )}
          </div>

          <div style={styles.logoutWrap}>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </aside>

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
                      <div
                        key={item.id}
                        style={{
                          ...styles.feedCard,
                          ...(item.is_read ? styles.feedCardRead : {}),
                        }}
                      >
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

                        <div style={styles.statusRow}>
                          <span style={styles.statusBadge}>
                            {item.is_read ? "read" : "unread"}
                          </span>
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

                        <div style={styles.actionRow}>
                          <button
                            style={styles.secondaryButton}
                            onClick={() => markDecisionAsRead(item.id)}
                            disabled={item.is_read}
                          >
                            {item.is_read ? "Already Read" : "Mark as Read"}
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
                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              updateCoachingStatus(item.id, "in_progress")
                            }
                          >
                            Start Review
                          </button>
                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              updateCoachingStatus(item.id, "resolved")
                            }
                          >
                            Mark Resolved
                          </button>
                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              updateCoachingStatus(item.id, "open")
                            }
                          >
                            Reopen
                          </button>
                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              handleRequestCoachingGuidance(item.id)
                            }
                            disabled={guidanceLoadingId === item.id}
                          >
                            {guidanceLoadingId === item.id
                              ? "Loading..."
                              : "Request Coaching Guidance"}
                          </button>
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

              <div style={styles.managersLayout}>
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
                        ? `${getManagerDisplayName(selectedManager)} File`
                        : "Manager File"}
                    </div>
                  </div>

                  {!selectedManager ? (
                    <p style={styles.message}>
                      Select a manager to view their documentation.
                    </p>
                  ) : selectedManagerLoading ? (
                    <p style={styles.message}>Loading manager file...</p>
                  ) : (
                    <div style={styles.managerFileWrap}>
                      <div style={styles.managerFileSection}>
                        <div style={styles.managerFileTitle}>Decisions</div>
                        {selectedManagerDecisions.length === 0 ? (
                          <p style={styles.message}>No decisions found.</p>
                        ) : (
                          <div style={styles.cardList}>
                            {selectedManagerDecisions.map((item) => (
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
                                  <div style={styles.feedLabel}>
                                    Action Taken
                                  </div>
                                  <div style={styles.feedBody}>
                                    {item.action_taken || "No action found."}
                                  </div>
                                </div>

                                {item.reasoning ? (
                                  <div style={styles.feedSection}>
                                    <div style={styles.feedLabel}>
                                      Reasoning
                                    </div>
                                    <div style={styles.feedBody}>
                                      {item.reasoning}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={styles.managerFileSection}>
                        <div style={styles.managerFileTitle}>
                          Coaching Requests
                        </div>
                        {selectedManagerCoaching.length === 0 ? (
                          <p style={styles.message}>
                            No coaching requests found.
                          </p>
                        ) : (
                          <div style={styles.cardList}>
                            {selectedManagerCoaching.map((item) => (
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
                                      Leadership Notes
                                    </div>
                                    <div style={styles.feedBody}>
                                      {item.leadership_notes}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
    background: "#0b1120",
    color: "#e5e7eb",
    padding: "24px",
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
  feedCardRead: {
    opacity: 0.82,
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
};
