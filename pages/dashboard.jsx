import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TABS = {
  policy: "policy",
  decision: "decision",
  coaching: "coaching",
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TABS.coaching);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [policyText, setPolicyText] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [coachingText, setCoachingText] = useState("");

  const [policyMessage, setPolicyMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [coachingMessage, setCoachingMessage] = useState("");

  const [coachingLoading, setCoachingLoading] = useState(false);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handlePullPolicy = async () => {
    if (!policyText.trim()) {
      setPolicyMessage("Please describe the situation first.");
      return;
    }

    setPolicyMessage("Policy AI connection comes next.");
  };

  const handleDecisionSubmit = async () => {
    if (!decisionText.trim()) {
      setDecisionMessage("Please document the decision first.");
      return;
    }

    setDecisionMessage("Decision logging section is ready for your next database step.");
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
          requester_role: profile?.role || "manager",
          request_text: coachingText.trim(),
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
            <div style={styles.userMeta}>
              {(profile?.role || "manager")} • {profile?.company || "INITIATIVE ENTERPRISES"}
            </div>
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
                  Describe the situation for policy reference and pull the correct standard.
                </p>
              </div>

              <div style={styles.panelCard}>
                <label style={styles.label}>Describe situation for policy reference</label>
                <textarea
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  placeholder="Example: An employee showed up 30 minutes late without calling. What does company policy say I should do?"
                  style={styles.textarea}
                />
                <button style={styles.primaryButton} onClick={handlePullPolicy}>
                  Pull Policy
                </button>
                {policyMessage ? <p style={styles.message}>{policyMessage}</p> : null}
              </div>
            </>
          )}

          {activeTab === TABS.decision && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Document Decision</h1>
                <p style={styles.subtitle}>
                  Log a situation and the action taken for leadership visibility and future review.
                </p>
              </div>

              <div style={styles.panelCard}>
                <label style={styles.label}>Document leadership decision</label>
                <textarea
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="Example: I adjusted deployment after two call-outs and reassigned break coverage to protect service times."
                  style={styles.textarea}
                />
                <button style={styles.primaryButton} onClick={handleDecisionSubmit}>
                  Submit Decision
                </button>
                {decisionMessage ? <p style={styles.message}>{decisionMessage}</p> : null}
              </div>
            </>
          )}

          {activeTab === TABS.coaching && (
            <>
              <div style={styles.headerCard}>
                <h1 style={styles.title}>Request Coaching</h1>
                <p style={styles.subtitle}>
                  Request leadership support when you need a second layer of guidance.
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
                {coachingMessage ? <p style={styles.message}>{coachingMessage}</p> : null}
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
    background:
      "radial-gradient(circle at top, #1e293b 0%, #0f172a 35%, #020617 100%)",
    color: "#e5e7eb",
    padding: "24px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "24px",
  },
  sidebar: {
    minHeight: "calc(100vh - 48px)",
    background: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "24px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(12px)",
  },
  brandCard: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "20px",
    padding: "18px",
    marginBottom: "22px",
  },
  smallLabel: {
    fontSize: "12px",
    letterSpacing: "0.12em",
    color: "#94a3b8",
    marginBottom: "10px",
  },
  userName: {
    fontSize: "32px",
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: "8px",
    color: "#f8fafc",
  },
  userMeta: {
    fontSize: "16px",
    color: "#cbd5e1",
    lineHeight: 1.5,
    textTransform: "lowercase",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  navButton: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "rgba(255, 255, 255, 0.03)",
    color: "#f8fafc",
    fontSize: "18px",
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
    transition: "0.2s ease",
  },
  navButtonActive: {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    border: "1px solid rgba(96, 165, 250, 0.45)",
    boxShadow: "0 10px 30px rgba(37, 99, 235, 0.35)",
  },
  logoutWrap: {
    marginTop: "auto",
    paddingTop: "20px",
  },
  logoutButton: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "transparent",
    color: "#e2e8f0",
    fontSize: "18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  headerCard: {
    background: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
    backdropFilter: "blur(12px)",
  },
  title: {
    margin: 0,
    fontSize: "46px",
    lineHeight: 1.05,
    fontWeight: 800,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: "12px",
    marginBottom: 0,
    fontSize: "18px",
    color: "#cbd5e1",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  panelCard: {
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
    backdropFilter: "blur(12px)",
  },
  label: {
    display: "block",
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    borderRadius: "18px",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.03)",
    color: "#f8fafc",
    padding: "18px",
    fontSize: "16px",
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    marginBottom: "18px",
    boxSizing: "border-box",
  },
  primaryButton: {
    padding: "16px 24px",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(37, 99, 235, 0.35)",
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "14px",
    fontSize: "15px",
    color: "#cbd5e1",
  },
  loadingCard: {
    maxWidth: "600px",
    margin: "120px auto",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "24px",
    padding: "32px",
    textAlign: "center",
    fontSize: "20px",
    color: "#e2e8f0",
  },
};
