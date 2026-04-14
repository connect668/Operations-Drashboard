import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_LOGS = [
  {
    id: 1,
    user: "Jordan M.",
    role: "manager",
    situation: "Employee showed up 45 minutes late without calling in.",
    action: "I gave them a verbal warning and documented it in their file.",
    timestamp: "Today, 9:14 AM",
    ratings: { policy: 5, judgment: 4, documentation: 5, escalation: 5 },
    overall: "green",
    flag: null,
  },
  {
    id: 2,
    user: "Casey R.",
    role: "manager",
    situation:
      "Two employees had a heated argument on the floor in front of customers.",
    action: "I told them to stop and moved on. Didn’t write anything up.",
    timestamp: "Yesterday, 2:31 PM",
    ratings: { policy: 2, judgment: 2, documentation: 1, escalation: 2 },
    overall: "red",
    flag:
      "Failure to document incident. No escalation on customer-facing conflict.",
  },
  {
    id: 3,
    user: "Morgan T.",
    role: "manager",
    situation: "Employee requested time off during a blackout period.",
    action: "I denied it and explained the blackout policy verbally.",
    timestamp: "Yesterday, 11:05 AM",
    ratings: { policy: 4, judgment: 4, documentation: 3, escalation: 5 },
    overall: "yellow",
    flag: "Verbal only — should have provided written denial for record.",
  },
];

async function callClaude(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("\n") || "No response.";
}

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "20px 0",
        color: "#9aa6b2",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          border: "2px solid #34414d",
          borderTop: "2px solid #6f8ea8",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: 13 }}>Analyzing...</span>
    </div>
  );
}

// ─── REQUEST POLICY ───────────────────────────────────────────────────────────
function PromptScreen() {
  const [situation, setSituation] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const systemPrompt = `You are a policy guidance AI for frontline managers. When given a workplace situation, respond with:

1. Relevant Policy — what the rules say
2. Recommended Actions — concrete steps to take
3. Risks — what could go wrong if handled poorly
4. Next Steps — immediate actions
5. Escalation — when or if to escalate and to whom

Be direct, practical, and specific. Format with clear section headers.`;

  const handleSubmit = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setResponse(null);

    try {
      const text = await callClaude(
        [{ role: "user", content: `Situation: ${situation}` }],
        systemPrompt
      );
      setResponse(text);
    } catch {
      setResponse("Error reaching AI. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Describe the Situation</label>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="e.g. An employee called out for the 4th time this month without documentation..."
          style={textareaStyle}
          rows={5}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !situation.trim()}
        style={{
          ...primaryBtn,
          opacity: loading || !situation.trim() ? 0.5 : 1,
        }}
      >
        {loading ? "Analyzing..." : "Get Guidance"}
      </button>

      {loading && <Spinner />}

      {response && (
        <div style={responseCardStyle}>
          <div style={sectionEyebrow}>Policy Guidance</div>
          <div
            style={{
              fontSize: 14,
              color: "#c6d0d8",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
            }}
          >
            {response}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENT DECISION ────────────────────────────────────────────────────────
function LogScreen() {
  const [situation, setSituation] = useState("");
  const [action, setAction] = useState("");
  const [policy, setPolicy] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    if (!situation.trim() || !action.trim()) return;

    setLoading(true);
    setErrorMessage("");
    setConfirmation(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No logged in user found.");
      }

      const { error: insertError } = await supabase.from("decision_logs").insert([
        {
          user_id: user.id,
          situation: situation.trim(),
          action_taken: action.trim(),
          policy_referenced: policy.trim() || null,
          notes: notes.trim() || null,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      setSubmitted(true);
      setConfirmation("Your decision has been documented.");
    } catch (error) {
      setErrorMessage(error.message || "Could not save decision log.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 42, marginBottom: 16, color: "#8ca2b5" }}>✓</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#edf2f7",
            marginBottom: 8,
          }}
        >
          Decision Documented
        </div>
        <div style={{ color: "#98a5b3", fontSize: 14, marginBottom: 32 }}>
          {confirmation}
        </div>
        <button
          onClick={() => {
            setSituation("");
            setAction("");
            setPolicy("");
            setNotes("");
            setSubmitted(false);
            setConfirmation(null);
            setErrorMessage("");
          }}
          style={secondaryBtn}
        >
          Document Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={infoNoticeStyle}>
        Log what you actually did. Be specific and accurate — this creates your
        decision record.
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>What Happened</label>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="Describe the situation..."
          style={textareaStyle}
          rows={3}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>What You Did</label>
        <textarea
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Describe your action in detail..."
          style={textareaStyle}
          rows={3}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>
          Policy Referenced{" "}
          <span style={{ color: "#6f7d8b", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          placeholder="e.g. Attendance Policy Section 3.2"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>
          Additional Notes{" "}
          <span style={{ color: "#6f7d8b", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any context, follow-ups, or observations..."
          style={textareaStyle}
          rows={2}
        />
      </div>

      {errorMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            background: "#161317",
            border: "1px solid #4b2d2d",
            borderRadius: 8,
            fontSize: 13,
            color: "#d9a3a3",
            lineHeight: 1.5,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        onClick={handleSubmit}
        disabled={loading || !situation.trim() || !action.trim()}
        style={{
          ...primaryBtn,
          opacity: loading || !situation.trim() || !action.trim() ? 0.5 : 1,
        }}
      >
        {loading ? "Saving..." : "Submit Decision"}
      </button>

      {loading && <Spinner />}
    </div>
  );
}

// ─── REQUEST COACHING ────────────────────────────────────────────────────────
function RequestCoachingScreen() {
  const [category, setCategory] = useState(null);
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    {
      id: "People",
      desc: "Team dynamics, communication, and coaching conversations",
      color: "#6f8ea8",
    },
    {
      id: "Policy",
      desc: "Rules, compliance, documentation, and approvals",
      color: "#8a7a58",
    },
    {
      id: "Procedure",
      desc: "Step-by-step processes, operations, and protocols",
      color: "#5c7b72",
    },
  ];

  const handleSubmit = () => {
    if (!category || !question.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 42, marginBottom: 16, color: "#8ca2b5" }}>✓</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#edf2f7",
            marginBottom: 8,
          }}
        >
          Coaching Request Submitted
        </div>
        <div
          style={{
            color: "#98a5b3",
            fontSize: 13,
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Your request has been recorded for leadership follow-up.
        </div>
        <button
          onClick={() => {
            setCategory(null);
            setQuestion("");
            setSubmitted(false);
          }}
          style={secondaryBtn}
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={infoNoticeStyle}>
        Not sure about something? Request coaching. Be specific — clearer input
        leads to better guidance.
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>What area do you need help with?</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                cursor: "pointer",
                border: `1px solid ${category === c.id ? c.color : "#2d3742"}`,
                background: category === c.id ? "#121922" : "#0f141b",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: category === c.id ? c.color : "transparent",
                    border: `2px solid ${c.color}`,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: category === c.id ? "#edf2f7" : "#b8c2cc",
                    }}
                  >
                    {c.id}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#72808d",
                      marginTop: 2,
                    }}
                  >
                    {c.desc}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>What specifically do you need help with?</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Describe what you're unclear on..."
          style={textareaStyle}
          rows={5}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!category || !question.trim()}
        style={{
          ...primaryBtn,
          opacity: !category || !question.trim() ? 0.5 : 1,
        }}
      >
        Submit Request
      </button>
    </div>
  );
}

// ─── RECENT DECISIONS ─────────────────────────────────────────────────────────
function RecentDecisionsScreen() {
  const ratingColor = (r) =>
    ({ green: "#3f8cff", yellow: "#b68a3a", red: "#b54a4a" }[r]);

  const ratingLabel = (r) =>
    ({ green: "Strong", yellow: "Questionable", red: "Needs Review" }[r]);

  return (
    <div>
      <div style={sectionEyebrow}>Recent Documented Decisions</div>

      {MOCK_LOGS.map((log) => (
        <div
          key={log.id}
          style={{
            marginBottom: 14,
            padding: 18,
            background: "#10161d",
            borderRadius: 12,
            border: "1px solid #26313b",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 10,
            }}
          >
            <div>
              <span
                style={{
                  fontWeight: 700,
                  color: "#edf2f7",
                  fontSize: 15,
                }}
              >
                {log.user}
              </span>
              <span style={{ color: "#748190", fontSize: 12, marginLeft: 10 }}>
                {log.timestamp}
              </span>
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: ratingColor(log.overall),
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${ratingColor(log.overall)}`,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {ratingLabel(log.overall)}
            </span>
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#9eabb8",
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#d8e0e7" }}>Situation:</strong>{" "}
            {log.situation}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#9eabb8",
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#d8e0e7" }}>Action:</strong> {log.action}
          </div>

          {log.flag && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#161317",
                border: "1px solid #4b2d2d",
                borderRadius: 8,
                fontSize: 12,
                color: "#c98e8e",
                lineHeight: 1.5,
              }}
            >
              {log.flag}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState("policy");

  const tabs = [
    { id: "policy", label: "Request Policy" },
    { id: "decision", label: "Document Decision" },
    { id: "coaching", label: "Request Coaching" },
    { id: "recent", label: "Recent Decisions" },
  ];

  const currentTab = tabs.find((t) => t.id === tab)?.label || "Dashboard";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1015",
        fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif",
        color: "#edf2f7",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        * { box-sizing: border-box; }
        textarea, input { outline: none; resize: vertical; }

        textarea:focus, input:focus {
          border-color: #6f8ea8 !important;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f141b; }
        ::-webkit-scrollbar-thumb { background: #2f3a46; border-radius: 6px; }
      `}</style>

      <div
        style={{
          borderBottom: "1px solid #1a232c",
          background: "#0d1319",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "28px 24px 24px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#7a8794",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              marginBottom: 10,
              fontWeight: 700,
            }}
          >
            Operator Support System
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#d6dde5",
              marginBottom: 4,
            }}
          >
            Ethan Odom
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#8d99a5",
              marginBottom: 12,
            }}
          >
            Manager • Initiative Enterprises
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#9eabb8",
              fontStyle: "italic",
            }}
          >
            “Consistency. Retention. Results.”
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "30px 24px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              color: "#758290",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Workspace
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#f4f7fa",
              letterSpacing: "-0.02em",
            }}
          >
            {currentTab}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border:
                  tab === t.id ? "1px solid #6f8ea8" : "1px solid #2c3640",
                background: tab === t.id ? "#141c24" : "#10161d",
                color: tab === t.id ? "#edf2f7" : "#9aa6b2",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "#0f141b",
            border: "1px solid #222d37",
            borderRadius: 16,
            padding: 26,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          }}
        >
          {tab === "policy" && <PromptScreen />}
          {tab === "decision" && <LogScreen />}
          {tab === "coaching" && <RequestCoachingScreen />}
          {tab === "recent" && <RecentDecisionsScreen />}
        </div>

        <div
          style={{
            marginTop: 22,
            padding: "14px 18px",
            border: "1px solid #222d37",
            borderRadius: 10,
            fontSize: 12,
            color: "#73808d",
            lineHeight: 1.6,
            background: "#0d1319",
          }}
        >
          Your actions are documented and reviewed. Lead with consistency and
          record decisions clearly.
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const labelStyle = {
  display: "block",
  fontSize: 11,
  color: "#7e8b98",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  fontWeight: 700,
};

const textareaStyle = {
  width: "100%",
  background: "#111821",
  border: "1px solid #2b3641",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#edf2f7",
  fontSize: 14,
  fontFamily: "inherit",
  lineHeight: 1.6,
  transition: "border 0.2s",
};

const inputStyle = {
  width: "100%",
  background: "#111821",
  border: "1px solid #2b3641",
  borderRadius: 10,
  padding: "11px 14px",
  color: "#edf2f7",
  fontSize: 14,
  fontFamily: "inherit",
  transition: "border 0.2s",
};

const primaryBtn = {
  padding: "12px 22px",
  background: "#6f8ea8",
  border: "1px solid #6f8ea8",
  borderRadius: 10,
  color: "#0b1015",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "opacity 0.2s",
};

const secondaryBtn = {
  padding: "10px 18px",
  background: "transparent",
  border: "1px solid #36424f",
  borderRadius: 10,
  color: "#c2cbd4",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const responseCardStyle = {
  marginTop: 28,
  padding: 24,
  background: "#111821",
  borderRadius: 12,
  border: "1px solid #27323d",
};

const sectionEyebrow = {
  fontSize: 11,
  color: "#7f91a1",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 16,
};

const infoNoticeStyle = {
  padding: "12px 16px",
  background: "#111821",
  border: "1px solid #26313b",
  borderRadius: 10,
  marginBottom: 24,
  fontSize: 13,
  color: "#95a2af",
  lineHeight: 1.6,
};
