import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TABS = [
  { id: "policy", label: "Request Policy" },
  { id: "document", label: "Document Decision" },
  { id: "coaching", label: "Request Coaching" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("document");
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [policyPrompt, setPolicyPrompt] = useState(
    "Frequent example: An employee arrived late without calling. What does company policy say I should do?"
  );

  const [coachingPrompt, setCoachingPrompt] = useState("");

  const [whatHappened, setWhatHappened] = useState("");
  const [whatYouDid, setWhatYouDid] = useState("");
  const [policyReferenced, setPolicyReferenced] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoadingProfile(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to view the dashboard.");
      setLoadingProfile(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, company")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError("Could not load your profile.");
      setLoadingProfile(false);
      return;
    }

    setProfile(data);
    setLoadingProfile(false);
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmittingDecision(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in.");
      setSubmittingDecision(false);
      return;
    }

    const { data: freshProfile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role, company")
      .eq("id", user.id)
      .single();

    if (profileError || !freshProfile) {
      setError("Could not load profile.");
      setSubmittingDecision(false);
      return;
    }

    if (!freshProfile.full_name) {
      setError("Your profile is missing a full name.");
      setSubmittingDecision(false);
      return;
    }

    const payload = {
      user_id: user.id,
      full_name: freshProfile.full_name,
      role: freshProfile.role || null,
      company: freshProfile.company || null,
      situation: whatHappened,
      action_taken: whatYouDid,
      policy_referenced: policyReferenced || null,
      notes: additionalNotes || null,
    };

    const { error: insertError } = await supabase
      .from("decision_logs")
      .insert([payload]);

    if (insertError) {
      setError(insertError.message);
      setSubmittingDecision(false);
      return;
    }

    setWhatHappened("");
    setWhatYouDid("");
    setPolicyReferenced("");
    setAdditionalNotes("");
    setSuccessMessage("Decision submitted successfully.");
    setSubmittingDecision(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loadingProfile) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <h2 style={styles.loadingText}>Loading dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <aside style={styles.sidebar}>
          <div>
            <div style={styles.brandBlock}>
              <div style={styles.brandBadge}>OSS</div>
              <div>
                <h1 style={styles.brandTitle}>Operator Support System</h1>
                <p style={styles.brandSubtitle}>
                  Clear decisions. Consistent standards.
                </p>
              </div>
            </div>

            <div style={styles.profileCard}>
              <p style={styles.sectionLabel}>Signed in as</p>
              <h2 style={styles.profileName}>
                {profile?.full_name || "Team Member"}
              </h2>
              <p style={styles.profileMeta}>
                {profile?.role || "Manager"}
                {profile?.company ? ` • ${profile.company}` : ""}
              </p>
            </div>

            <div style={styles.navBlock}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError("");
                    setSuccessMessage("");
                  }}
                  style={{
                    ...styles.tabButton,
                    ...(activeTab === tab.id ? styles.activeTabButton : {}),
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={handleLogout} style={styles.logoutButton}>
            Log Out
          </button>
        </aside>

        <main style={styles.main}>
          <div style={styles.header}>
            <div>
              <p style={styles.sectionLabel}>Dashboard</p>
              <h2 style={styles.headerTitle}>
                {activeTab === "policy" && "Request Policy Guidance"}
                {activeTab === "document" && "Document Decision"}
                {activeTab === "coaching" && "Request Coaching"}
              </h2>
              <p style={styles.headerText}>
                {activeTab === "policy" &&
                  "Describe the situation so the system can pull relevant policy guidance."}
                {activeTab === "document" &&
                  "Log what happened, what action you took, and any supporting notes."}
                {activeTab === "coaching" &&
                  "Request leadership support when you need a second layer of review."}
              </p>
            </div>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          {activeTab === "policy" && (
            <section style={styles.card}>
              <label style={styles.label}>Describe situation for policy reference</label>
              <textarea
                value={policyPrompt}
                onChange={(e) => setPolicyPrompt(e.target.value)}
                placeholder="Describe the situation here..."
                style={styles.textareaLarge}
              />
              <button type="button" style={styles.primaryButton}>
                Pull Policy
              </button>
            </section>
          )}

          {activeTab === "document" && (
            <section style={styles.card}>
              <form onSubmit={handleSubmitDecision} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>What happened?</label>
                  <textarea
                    value={whatHappened}
                    onChange={(e) => setWhatHappened(e.target.value)}
                    placeholder="Describe the situation clearly..."
                    style={styles.textarea}
                    required
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>What action did you take?</label>
                  <textarea
                    value={whatYouDid}
                    onChange={(e) => setWhatYouDid(e.target.value)}
                    placeholder="Explain the action you took..."
                    style={styles.textarea}
                    required
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Policy referenced</label>
                  <input
                    type="text"
                    value={policyReferenced}
                    onChange={(e) => setPolicyReferenced(e.target.value)}
                    placeholder="Optional policy name or section"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Additional notes</label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Optional supporting notes..."
                    style={styles.textarea}
                  />
                </div>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={submittingDecision}
                >
                  {submittingDecision ? "Submitting..." : "Submit Decision"}
                </button>
              </form>
            </section>
          )}

          {activeTab === "coaching" && (
            <section style={styles.card}>
              <label style={styles.label}>Request coaching support</label>
              <textarea
                value={coachingPrompt}
                onChange={(e) => setCoachingPrompt(e.target.value)}
                placeholder="Describe where you need support..."
                style={styles.textareaLarge}
              />
              <button type="button" style={styles.primaryButton}>
                Request Coaching
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    color: "#e5e7eb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: "24px",
  },
  shell: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "24px",
  },
  sidebar: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "calc(100vh - 48px)",
  },
  brandBlock: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    marginBottom: "24px",
  },
  brandBadge: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    letterSpacing: "0.04em",
  },
  brandTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#f9fafb",
  },
  brandSubtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "#9ca3af",
  },
  profileCard: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "20px",
  },
  sectionLabel: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#6b7280",
  },
  profileName: {
    margin: "8px 0 6px 0",
    fontSize: "20px",
    color: "#f9fafb",
  },
  profileMeta: {
    margin: 0,
    color: "#9ca3af",
    fontSize: "14px",
  },
  navBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tabButton: {
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #1f2937",
    background: "#0f172a",
    color: "#d1d5db",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 600,
  },
  activeTabButton: {
    background: "#1d4ed8",
    border: "1px solid #2563eb",
    color: "#ffffff",
  },
  logoutButton: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #374151",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 600,
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  header: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "24px",
  },
  headerTitle: {
    margin: "8px 0 8px 0",
    fontSize: "28px",
    color: "#f9fafb",
  },
  headerText: {
    margin: 0,
    color: "#9ca3af",
    fontSize: "15px",
    maxWidth: "700px",
    lineHeight: 1.6,
  },
  card: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#f3f4f6",
  },
  input: {
    width: "100%",
    background: "#0f172a",
    color: "#f9fafb",
    border: "1px solid #374151",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    background: "#0f172a",
    color: "#f9fafb",
    border: "1px solid #374151",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  textareaLarge: {
    width: "100%",
    minHeight: "180px",
    background: "#0f172a",
    color: "#f9fafb",
    border: "1px solid #374151",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    marginBottom: "16px",
  },
  primaryButton: {
    padding: "14px 18px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  errorBox: {
    background: "rgba(127, 29, 29, 0.35)",
    border: "1px solid #7f1d1d",
    color: "#fecaca",
    padding: "14px 16px",
    borderRadius: "14px",
  },
  successBox: {
    background: "rgba(20, 83, 45, 0.35)",
    border: "1px solid #166534",
    color: "#bbf7d0",
    padding: "14px 16px",
    borderRadius: "14px",
  },
  centerCard: {
    maxWidth: "500px",
    margin: "120px auto",
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "20px",
    padding: "32px",
    textAlign: "center",
  },
  loadingText: {
    margin: 0,
    color: "#f9fafb",
  },
};
