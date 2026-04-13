import { useState, useEffect } from "react";

const ROLES = {
  manager: { label: "Manager", color: "#4A9EFF", level: 1 },
  gm: { label: "General Manager", color: "#F59E0B", level: 2 },
  area_coach: { label: "Area Coach", color: "#10B981", level: 3 },
};

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
    situation: "Two employees had a heated argument on the floor in front of customers.",
    action: "I told them to stop and moved on. Didn’t write anything up.",
    timestamp: "Yesterday, 2:31 PM",
    ratings: { policy: 2, judgment: 2, documentation: 1, escalation: 2 },
    overall: "red",
    flag: "Failure to document incident. No escalation on customer-facing conflict.",
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

const MOCK_GM_LOGS = [
  {
    id: 10,
    user: "Alex P.",
    role: "gm",
    situation: "Manager repeatedly late to open shifts — 3rd time this month.",
    action: "I had an informal chat with them about punctuality.",
    timestamp: "Today, 8:00 AM",
    ratings: { policy: 2, judgment: 2, documentation: 1, escalation: 2 },
    overall: "red",
    flag: "Pattern issue requires formal documentation and progressive discipline, not informal chat.",
  },
  {
    id: 11,
    user: "Sam W.",
    role: "gm",
    situation: "Manager escalated a minor scheduling dispute directly to HR.",
    action: "I reviewed it and told HR it was resolved.",
    timestamp: "2 days ago, 3:15 PM",
    ratings: { policy: 4, judgment: 4, documentation: 4, escalation: 5 },
    overall: "green",
    flag: null,
  },
];

const MOCK_COACHING_REQUESTS = [
  {
    id: 1,
    from: "Jordan M.",
    category: "Policy",
    question:
      "I’m not sure when I’m allowed to send someone home early vs having to keep them for their full shift. I’ve been guessing.",
    timestamp: "Today, 8:42 AM",
    severity: null,
    guidance: null,
    severityReason: null,
  },
  {
    id: 2,
    from: "Casey R.",
    category: "Procedure",
    question:
      "I don’t know the correct steps when an employee gets injured on the floor. I’ve handled two but I’m not confident I did it right either time.",
    timestamp: "Today, 7:15 AM",
    severity: null,
    guidance: null,
    severityReason: null,
  },
  {
    id: 3,
    from: "Morgan T.",
    category: "People",
    question:
      "One of my employees shuts down when I give feedback. I don’t know how to coach someone who goes silent on me.",
    timestamp: "Yesterday, 4:30 PM",
    severity: null,
    guidance: null,
    severityReason: null,
  },
  {
    id: 4,
    from: "Luis F.",
    category: "Procedure",
    question:
      "I don’t fully understand the cash reconciliation steps at close. I’ve been doing it but I think I might be skipping something.",
    timestamp: "Yesterday, 2:10 PM",
    severity: null,
    guidance: null,
    severityReason: null,
  },
];

const TEAM_COMPLIANCE = {
  manager: [
    {
      name: "Darius K.",
      decisions: 14,
      policyScore: 91,
      trend: "up",
      recent: ["green", "green", "green", "yellow"],
      topNeed: "Policy",
      history: [
        {
          date: "Apr 11",
          situation: "Employee no-call no-show.",
          action: "Issued written warning and documented per policy.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 9",
          situation: "Employee asked to leave early mid-shift.",
          action: "Approved with manager coverage confirmed first.",
          ratings: { policy: 5, judgment: 4, documentation: 4, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 7",
          situation: "Minor cash drawer discrepancy.",
          action: "Documented and reported to GM per protocol.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 4",
          situation: "Employee uniform violation.",
          action: "Verbal warning given but not documented.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 4 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Priya N.",
      decisions: 9,
      policyScore: 78,
      trend: "up",
      recent: ["yellow", "green", "green", "yellow"],
      topNeed: "People",
      history: [
        {
          date: "Apr 10",
          situation: "Two employees swapped shifts without approval.",
          action: "Allowed the swap and noted it informally.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 4 },
          overall: "yellow",
        },
        {
          date: "Apr 8",
          situation: "Employee late 3rd time this month.",
          action: "Issued verbal warning and filed documentation.",
          ratings: { policy: 5, judgment: 4, documentation: 5, escalation: 4 },
          overall: "green",
        },
        {
          date: "Apr 5",
          situation: "Customer complaint about staff attitude.",
          action: "Coached employee and logged the incident.",
          ratings: { policy: 4, judgment: 5, documentation: 4, escalation: 4 },
          overall: "green",
        },
        {
          date: "Apr 2",
          situation: "Employee asked about FMLA leave.",
          action: "Told them to figure it out with HR — no follow-up.",
          ratings: { policy: 2, judgment: 2, documentation: 1, escalation: 2 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Tomas V.",
      decisions: 11,
      policyScore: 63,
      trend: "down",
      recent: ["red", "yellow", "red", "yellow"],
      topNeed: "Procedure",
      history: [
        {
          date: "Apr 11",
          situation: "Employee conflict escalated to shouting.",
          action: "Separated them and told them to calm down. Nothing filed.",
          ratings: { policy: 1, judgment: 2, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 9",
          situation: "Employee missed safety training.",
          action: "Reminded them verbally to complete it.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
        {
          date: "Apr 6",
          situation: "Register shortage of $40.",
          action: "Deducted from employee pay without authorization.",
          ratings: { policy: 1, judgment: 1, documentation: 2, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 3",
          situation: "Employee requested religious accommodation.",
          action: "Told them it wasn’t possible without checking policy.",
          ratings: { policy: 2, judgment: 2, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Keisha B.",
      decisions: 7,
      policyScore: 55,
      trend: "down",
      recent: ["red", "red", "yellow", "red"],
      topNeed: "Procedure",
      history: [
        {
          date: "Apr 10",
          situation: "Employee walked off mid-shift.",
          action: "Let them leave and didn’t document or escalate.",
          ratings: { policy: 1, judgment: 1, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 8",
          situation: "Employee harassment complaint.",
          action: "Told both parties to work it out themselves.",
          ratings: { policy: 1, judgment: 1, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 5",
          situation: "Overtime approval needed.",
          action: "Approved overtime verbally without logging it.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
        {
          date: "Apr 2",
          situation: "Employee asked to be taken off schedule.",
          action: "Removed them without consulting GM or HR.",
          ratings: { policy: 1, judgment: 2, documentation: 2, escalation: 1 },
          overall: "red",
        },
      ],
    },
    {
      name: "Luis F.",
      decisions: 12,
      policyScore: 84,
      trend: "stable",
      recent: ["green", "yellow", "green", "green"],
      topNeed: "Policy",
      history: [
        {
          date: "Apr 11",
          situation: "Employee requested early release for family emergency.",
          action: "Approved and documented with coverage confirmed.",
          ratings: { policy: 5, judgment: 5, documentation: 4, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 9",
          situation: "New hire struggling with onboarding tasks.",
          action: "Extended training period but didn’t notify GM.",
          ratings: { policy: 3, judgment: 4, documentation: 3, escalation: 2 },
          overall: "yellow",
        },
        {
          date: "Apr 6",
          situation: "Employee cited wrong dress code to customer.",
          action: "Corrected publicly — then coached privately afterward.",
          ratings: { policy: 4, judgment: 4, documentation: 4, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 3",
          situation: "Equipment misuse observed.",
          action: "Issued warning per policy and filed incident report.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
      ],
    },
  ],
  gm: [
    {
      name: "Sandra T.",
      decisions: 18,
      policyScore: 88,
      trend: "up",
      recent: ["green", "green", "green", "yellow"],
      topNeed: "Policy",
      history: [
        {
          date: "Apr 11",
          situation: "Manager ignored escalation from employee.",
          action: "Met with manager, documented corrective conversation.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 8",
          situation: "Store missed compliance audit deadline.",
          action: "Filed extension request and notified Area Coach.",
          ratings: { policy: 4, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 5",
          situation: "Manager approved unapproved overtime x2.",
          action: "Addressed verbally but didn’t document the pattern.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Marcus D.",
      decisions: 10,
      policyScore: 70,
      trend: "stable",
      recent: ["yellow", "green", "yellow", "yellow"],
      topNeed: "People",
      history: [
        {
          date: "Apr 10",
          situation: "Manager wrote up employee for protected activity.",
          action: "Reversed write-up after consulting HR.",
          ratings: { policy: 4, judgment: 4, documentation: 4, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 7",
          situation: "Store scheduling gap on holiday weekend.",
          action: "Fixed coverage but didn’t document root cause.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
        {
          date: "Apr 3",
          situation: "Manager conflict with employee made public.",
          action: "Separated them temporarily — no formal steps taken.",
          ratings: { policy: 2, judgment: 2, documentation: 2, escalation: 2 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Yvonne R.",
      decisions: 8,
      policyScore: 47,
      trend: "down",
      recent: ["red", "red", "yellow", "red"],
      topNeed: "Procedure",
      history: [
        {
          date: "Apr 11",
          situation: "Manager terminated employee without GM sign-off.",
          action: "Allowed it to stand and didn’t escalate.",
          ratings: { policy: 1, judgment: 1, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 9",
          situation: "Repeated documentation failures from same manager.",
          action: "Had casual conversation, no corrective action filed.",
          ratings: { policy: 1, judgment: 2, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 5",
          situation: "Employee filed formal HR complaint.",
          action: "Acknowledged it and passed to HR with notes.",
          ratings: { policy: 3, judgment: 4, documentation: 4, escalation: 5 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Jin W.",
      decisions: 15,
      policyScore: 93,
      trend: "up",
      recent: ["green", "green", "green", "green"],
      topNeed: "Policy",
      history: [
        {
          date: "Apr 11",
          situation: "Manager requested policy exception for top performer.",
          action: "Denied exception, explained policy, documented request.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 8",
          situation: "Two managers had scheduling conflict.",
          action: "Mediated and documented outcome with both parties.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 4",
          situation: "New policy rollout confusion on floor.",
          action: "Ran refresher with full team and logged completion.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
      ],
    },
  ],
  area_coach: [
    {
      name: "Brenda L.",
      decisions: 22,
      policyScore: 85,
      trend: "up",
      recent: ["green", "green", "yellow", "green"],
      topNeed: "Policy",
      history: [
        {
          date: "Apr 10",
          situation: "GM failed to escalate manager conduct issue.",
          action: "Intervened directly, documented GM accountability gap.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 6",
          situation: "Regional compliance scores dipped 2 stores.",
          action: "Scheduled review but didn’t set formal improvement plan.",
          ratings: { policy: 3, judgment: 3, documentation: 3, escalation: 3 },
          overall: "yellow",
        },
        {
          date: "Apr 2",
          situation: "Two GMs gave conflicting policy guidance.",
          action: "Issued written clarification to all GMs in region.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
      ],
    },
    {
      name: "Omar S.",
      decisions: 17,
      policyScore: 61,
      trend: "down",
      recent: ["yellow", "red", "yellow", "red"],
      topNeed: "Procedure",
      history: [
        {
          date: "Apr 11",
          situation: "GM terminated employee without documentation trail.",
          action: "Let decision stand — no corrective steps taken.",
          ratings: { policy: 1, judgment: 1, documentation: 1, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 8",
          situation: "Store flagged for 3rd HR complaint in 60 days.",
          action: "Told GM to handle it — no escalation to leadership.",
          ratings: { policy: 2, judgment: 2, documentation: 2, escalation: 1 },
          overall: "red",
        },
        {
          date: "Apr 4",
          situation: "GM missed mandatory compliance training.",
          action: "Rescheduled without documenting the miss.",
          ratings: { policy: 3, judgment: 3, documentation: 2, escalation: 3 },
          overall: "yellow",
        },
      ],
    },
    {
      name: "Chloe M.",
      decisions: 19,
      policyScore: 79,
      trend: "stable",
      recent: ["yellow", "green", "green", "yellow"],
      topNeed: "People",
      history: [
        {
          date: "Apr 10",
          situation: "GM requested budget exception outside authority.",
          action: "Denied and explained approval chain clearly.",
          ratings: { policy: 5, judgment: 5, documentation: 4, escalation: 5 },
          overall: "green",
        },
        {
          date: "Apr 7",
          situation: "Pattern of late openings across 2 stores.",
          action: "Flagged to GM but didn’t escalate to regional ops.",
          ratings: { policy: 3, judgment: 3, documentation: 3, escalation: 2 },
          overall: "yellow",
        },
        {
          date: "Apr 3",
          situation: "GM handled employee termination correctly.",
          action: "Reviewed, confirmed compliance, documented approval.",
          ratings: { policy: 5, judgment: 5, documentation: 5, escalation: 5 },
          overall: "green",
        },
      ],
    },
  ],
};

const teamLabel = {
  manager: "Your Team (Employees)",
  gm: "Your Managers",
  area_coach: "Your GMs",
};

const belowRole = { gm: "manager", area_coach: "gm" };

const needColor = {
  People: "#4A9EFF",
  Policy: "#F59E0B",
  Procedure: "#10B981",
};

const needDesc = {
  People: "Needs support with team dynamics and coaching conversations",
  Policy: "Frequently unclear on rules, compliance, and documentation",
  Procedure: "Needs help with operational steps and protocols",
};

const ratingColor = (r) =>
  ({ green: "#10B981", yellow: "#F59E0B", red: "#EF4444" }[r]);

const ratingLabel = (r) =>
  ({ green: "Strong", yellow: "Questionable", red: "Needs Review" }[r]);

const scoreBar = (val) => {
  const pct = (val / 5) * 100;
  const col = val >= 4 ? "#10B981" : val >= 3 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: col,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: col, fontWeight: 700, width: 14 }}>
        {val}
      </span>
    </div>
  );
};

async function callClaude(messages, systemPrompt) {
  const text = messages?.[0]?.content || "";

  if (systemPrompt?.includes("Respond ONLY with a JSON object")) {
    let severity = "medium";
    let severityReason = "Moderate support need based on the request.";
    const lower = text.toLowerCase();

    if (lower.includes("procedure")) {
      severity = "high";
      severityReason = "Procedure issues can create operational and compliance risk quickly.";
    } else if (lower.includes("people")) {
      severity = "low";
      severityReason = "This is mainly a coaching and communication issue.";
    }

    return JSON.stringify({
      severity,
      severityReason,
      guidance:
        "**How to respond**\nMeet with the manager quickly and walk through the issue step by step. Do not assume they understand the process just because they have handled it before.\n\n**What to reinforce**\nClarify the correct standard, explain why it matters, and give them a repeatable rule they can use next time. End by confirming what they will do differently on the next similar situation.",
    });
  }

  if (systemPrompt?.includes("hidden leadership evaluation AI")) {
    return JSON.stringify({
      policy: 4,
      judgment: 4,
      documentation: 3,
      escalation: 4,
      overall: "yellow",
      flag: "Mock evaluation only. Backend scoring is not connected yet.",
    });
  }

  if (systemPrompt?.includes("advising an Area Coach")) {
    return `**Assessment**
This GM needs direct follow-up. Their decision quality should not be left unaddressed.

**What You Should Do**
Review the decision with them, point out the exact failure, and require a corrected process for next time.

**Accountability**
Document the coaching conversation and watch for repeated misses across the next few decisions.`;
  }

  if (systemPrompt?.includes("advising a GM")) {
    return `**Assessment**
This manager needs coaching on judgment and consistency.

**What You Should Do**
Walk through the situation with them step by step, compare their action to standard policy, and clarify the better response.

**Follow-Up**
Document the coaching and watch the next few decisions for improvement.`;
  }

  return `**Mock Response**

This is a frontend test response.

Your UI is working.
Your buttons are working.
Your AI backend is not connected yet.`;
}

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "20px 0",
        color: "#94a3b8",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          border: "2px solid #334155",
          borderTop: "2px solid #4A9EFF",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: 13 }}>Analyzing...</span>
    </div>
  );
}

function ComplianceScreen({ role }) {
  const [expanded, setExpanded] = useState(null);
  const dataKey = belowRole[role] || role;
  const members = TEAM_COMPLIANCE[dataKey] || [];

  const complianceColor = (pct) =>
    pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 16,
        }}
      >
        {teamLabel[role]}
      </div>

      {members.map((m, i) => {
        const isOpen = expanded === m.name;
        const col = complianceColor(m.policyScore);
        const nCol = needColor[m.topNeed] || "#64748b";

        return (
          <div
            key={m.name}
            style={{
              marginBottom: 8,
              borderRadius: 10,
              overflow: "hidden",
              background: "#0f172a",
              border: `1px solid ${isOpen ? `${nCol}44` : "#1e293b"}`,
              transition: "border 0.2s",
              animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
            }}
          >
            <div
              onClick={() => setExpanded(isOpen ? null : m.name)}
              style={{
                padding: "14px 18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: `${col}18`,
                    border: `1px solid ${col}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: col,
                  }}
                >
                  {m.name.charAt(0)}
                </div>
                <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>
                  {m.name}
                </span>
              </div>
              <span style={{ fontSize: 11, color: isOpen ? "#4A9EFF" : "#334155" }}>
                {isOpen ? "▲" : "▼"}
              </span>
            </div>

            {isOpen && (
              <div
                style={{
                  borderTop: "1px solid #1e293b",
                  padding: "16px 18px",
                  animation: "fadeIn 0.2s ease",
                }}
              >
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      Policy Compliance
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: col }}>
                      {m.policyScore}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#1e293b", borderRadius: 3 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${m.policyScore}%`,
                        background: col,
                        borderRadius: 3,
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: `${nCol}0c`,
                    border: `1px solid ${nCol}30`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    Avg Coaching Request
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: nCol }}>
                      {m.topNeed}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    {needDesc[m.topNeed]}
                  </div>
                </div>

                {m.history && m.history.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#4A9EFF",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontWeight: 700,
                        marginBottom: 10,
                      }}
                    >
                      Decision History
                    </div>

                    {m.history.map((h, hi) => {
                      const hcol = {
                        green: "#10B981",
                        yellow: "#F59E0B",
                        red: "#EF4444",
                      }[h.overall];

                      return (
                        <div
                          key={hi}
                          style={{
                            marginBottom: 8,
                            padding: "12px 14px",
                            borderRadius: 8,
                            background: "#070d1a",
                            border: `1px solid ${hcol}22`,
                            animation: `fadeIn 0.2s ease ${hi * 0.05}s both`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontSize: 11, color: "#475569" }}>
                              {h.date}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: hcol,
                                background: `${hcol}18`,
                                padding: "2px 8px",
                                borderRadius: 20,
                              }}
                            >
                              {ratingLabel(h.overall)}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              marginBottom: 3,
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: "#64748b" }}>Situation: </span>
                            {h.situation}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              marginBottom: 10,
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: "#64748b" }}>Action: </span>
                            {h.action}
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "4px 16px",
                            }}
                          >
                            {[
                              ["Policy", h.ratings.policy],
                              ["Judgment", h.ratings.judgment],
                              ["Documentation", h.ratings.documentation],
                              ["Escalation", h.ratings.escalation],
                            ].map(([label, val]) => (
                              <div key={label}>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: "#334155",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 3,
                                  }}
                                >
                                  {label}
                                </div>
                                {scoreBar(val)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PromptScreen({ role }) {
  const [situation, setSituation] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const systemPrompts = {
    manager: `You are a policy guidance AI for frontline managers.`,
    gm: `You are a management guidance AI for General Managers overseeing frontline managers.`,
    area_coach: `You are a strategic guidance AI for Area Coaches overseeing multiple GMs and stores.`,
  };

  const handleSubmit = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setResponse(null);

    try {
      const text = await callClaude(
        [{ role: "user", content: `Situation: ${situation}` }],
        systemPrompts[role]
      );
      setResponse(text);
    } catch {
      setResponse("Error reaching AI. Please try again.");
    }

    setLoading(false);
  };

  const formatResponse = (text) => {
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 4 }} />;

      if (/^\*\*.*\*\*$/.test(line.trim())) {
        return (
          <div
            key={i}
            style={{
              color: "#4A9EFF",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 18,
              marginBottom: 6,
            }}
          >
            {line.replace(/\*\*/g, "")}
          </div>
        );
      }

      const parts = line.split(/\*\*(.*?)\*\*/g);

      return (
        <div
          key={i}
          style={{
            marginBottom: 4,
            lineHeight: 1.6,
            fontSize: 14,
            color: "#cbd5e1",
          }}
        >
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} style={{ color: "#e2e8f0" }}>
                {p}
              </strong>
            ) : (
              p
            )
          )}
        </div>
      );
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Describe the Situation</label>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder={
            role === "manager"
              ? "e.g. An employee called out for the 4th time this month without documentation..."
              : role === "gm"
              ? "e.g. One of my managers is writing people up inconsistently and I’m getting complaints..."
              : "e.g. Two of my GMs in the same district are both showing escalation failures this quarter..."
          }
          style={textareaStyle}
          rows={5}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !situation.trim()}
        style={{ ...primaryBtn, opacity: loading || !situation.trim() ? 0.5 : 1 }}
      >
        {loading ? "Analyzing..." : "Get Guidance →"}
      </button>

      {loading && <Spinner />}

      {response && (
        <div
          style={{
            marginTop: 28,
            padding: 24,
            background: "#0f172a",
            borderRadius: 12,
            border: "1px solid #1e293b",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#4A9EFF",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            AI Guidance
          </div>
          {formatResponse(response)}
        </div>
      )}
    </div>
  );
}

function LogScreen() {
  const [situation, setSituation] = useState("");
  const [action, setAction] = useState("");
  const [policy, setPolicy] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const handleSubmit = async () => {
    if (!situation.trim() || !action.trim()) return;

    setLoading(true);

    try {
      await callClaude(
        [
          {
            role: "user",
            content: `Situation: ${situation}\nAction taken: ${action}\nPolicy cited: ${
              policy || "none"
            }\nNotes: ${notes || "none"}`,
          },
        ],
        `You are a hidden leadership evaluation AI.`
      );

      setSubmitted(true);
      setConfirmation("Your action has been logged. Keep leading well.");
    } catch {
      setConfirmation("Logged successfully.");
      setSubmitted(true);
    }

    setLoading(false);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: 8,
          }}
        >
          Action Logged
        </div>
        <div style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>
          {confirmation}
        </div>
        <button
          onClick={() => {
            setSituation("");
            setAction("");
            setPolicy("");
            setNotes("");
            setSubmitted(false);
          }}
          style={secondaryBtn}
        >
          Log Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(74,158,255,0.06)",
          border: "1px solid rgba(74,158,255,0.15)",
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 13,
          color: "#64748b",
          lineHeight: 1.5,
        }}
      >
        Log what you actually did. Be specific and honest — this creates your decision record.
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
          Policy Referenced <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span>
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
          Additional Notes <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any context, follow-ups, or observations..."
          style={textareaStyle}
          rows={2}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !situation.trim() || !action.trim()}
        style={{
          ...primaryBtn,
          opacity: loading || !situation.trim() || !action.trim() ? 0.5 : 1,
        }}
      >
        {loading ? "Saving..." : "Submit Log →"}
      </button>

      {loading && <Spinner />}
    </div>
  );
}

function OversightScreen({ role }) {
  const [selected, setSelected] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const logs = role === "area_coach" ? MOCK_GM_LOGS : MOCK_LOGS;
  const title = role === "area_coach" ? "GM Performance" : "Manager Performance";

  const handleAskAbout = async (log) => {
    setSelected(log);
    setAiLoading(true);
    setAiResponse(null);

    try {
      const scoreText = `Policy: ${log.ratings.policy}/5, Judgment: ${log.ratings.judgment}/5, Documentation: ${log.ratings.documentation}/5, Escalation: ${log.ratings.escalation}/5`;

      const text = await callClaude(
        [
          {
            role: "user",
            content: `${
              role === "area_coach" ? "GM" : "Manager"
            } ${log.user} logged this decision:
Situation: ${log.situation}
Action taken: ${log.action}
Hidden scores — ${scoreText}
Overall: ${log.overall}${log.flag ? `\nFlag: ${log.flag}` : ""}

As their ${role === "area_coach" ? "Area Coach" : "GM"}, what should I do about this?`,
          },
        ],
        role === "area_coach"
          ? `You are advising an Area Coach on how to handle a GM's decision quality.`
          : `You are advising a GM on how to handle a manager's decision quality.`
      );

      setAiResponse(text);
    } catch {
      setAiResponse("Error reaching AI.");
    }

    setAiLoading(false);
  };

  const overallStats = {
    green: logs.filter((l) => l.overall === "green").length,
    yellow: logs.filter((l) => l.overall === "yellow").length,
    red: logs.filter((l) => l.overall === "red").length,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {Object.entries(overallStats).map(([color, count]) => (
          <div
            key={color}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: "#0f172a",
              borderRadius: 10,
              border: `1px solid ${ratingColor(color)}22`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: ratingColor(color) }}>
              {count}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 2,
              }}
            >
              {ratingLabel(color)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 14,
        }}
      >
        {title} — Recent Decisions
      </div>

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            marginBottom: 14,
            padding: 18,
            background: "#0f172a",
            borderRadius: 12,
            border: `1px solid ${
              selected?.id === log.id ? `${ratingColor(log.overall)}55` : "#1e293b"
            }`,
            cursor: "pointer",
            transition: "border 0.2s",
          }}
          onClick={() => (selected?.id === log.id ? setSelected(null) : handleAskAbout(log))}
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
              <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 15 }}>
                {log.user}
              </span>
              <span style={{ color: "#475569", fontSize: 12, marginLeft: 10 }}>
                {log.timestamp}
              </span>
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: ratingColor(log.overall),
                background: `${ratingColor(log.overall)}18`,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {ratingLabel(log.overall)}
            </span>
          </div>

          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
            <strong style={{ color: "#94a3b8" }}>Situation:</strong> {log.situation}
          </div>

          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
            <strong style={{ color: "#94a3b8" }}>Action:</strong> {log.action}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
            {[
              ["Policy Alignment", log.ratings.policy],
              ["Judgment Quality", log.ratings.judgment],
              ["Documentation", log.ratings.documentation],
              ["Escalation", log.ratings.escalation],
            ].map(([label, val]) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                {scoreBar(val)}
              </div>
            ))}
          </div>

          {log.flag && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8,
                fontSize: 12,
                color: "#fca5a5",
                lineHeight: 1.5,
              }}
            >
              ⚑ {log.flag}
            </div>
          )}

          {selected?.id === log.id && (
            <div
              style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1e293b" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#4A9EFF",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                AI Coaching Guidance
              </div>

              {aiLoading ? (
                <Spinner />
              ) : (
                aiResponse && (
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                    {aiResponse.split("\n").map((line, i) => {
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      if (!line.trim()) return <div key={i} style={{ height: 6 }} />;

                      return (
                        <div key={i} style={{ marginBottom: 4 }}>
                          {parts.map((p, j) =>
                            j % 2 === 1 ? (
                              <strong key={j} style={{ color: "#e2e8f0" }}>
                                {p}
                              </strong>
                            ) : (
                              p
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RequestCoachingScreen() {
  const [category, setCategory] = useState(null);
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    {
      id: "People",
      desc: "Team dynamics, communication, coaching conversations",
      color: "#4A9EFF",
    },
    {
      id: "Policy",
      desc: "Rules, compliance, documentation, approvals",
      color: "#F59E0B",
    },
    {
      id: "Procedure",
      desc: "Step-by-step processes, operations, protocols",
      color: "#10B981",
    },
  ];

  const handleSubmit = () => {
    if (!category || !question.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✓</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: 8,
          }}
        >
          Request Sent
        </div>
        <div
          style={{
            color: "#64748b",
            fontSize: 13,
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Your GM has been notified and will follow up with guidance.
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
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(74,158,255,0.06)",
          border: "1px solid rgba(74,158,255,0.12)",
          borderRadius: 8,
          marginBottom: 28,
          fontSize: 13,
          color: "#64748b",
          lineHeight: 1.6,
        }}
      >
        Not sure about something? Request coaching from your GM. Be specific — the more detail you give, the better the guidance.
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
                border: `1px solid ${category === c.id ? `${c.color}88` : "#1e293b"}`,
                background: category === c.id ? `${c.color}0e` : "#0f172a",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: category === c.id ? c.color : "#2d3748",
                    border: `2px solid ${c.color}`,
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: category === c.id ? c.color : "#94a3b8",
                    }}
                  >
                    {c.id}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
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
          placeholder="Describe what you're unclear on. Be as specific as possible so your GM can give you useful guidance..."
          style={textareaStyle}
          rows={5}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!category || !question.trim()}
        style={{
          ...primaryBtn,
          opacity: !category || !question.trim() ? 0.4 : 1,
        }}
      >
        Submit Request →
      </button>
    </div>
  );
}

function CoachInboxScreen() {
  const [requests, setRequests] = useState(MOCK_COACHING_REQUESTS);
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const severityConfig = {
    high: { label: "High Priority", color: "#10B981", bg: "#10B98118" },
    medium: { label: "Moderate", color: "#F59E0B", bg: "#F59E0B18" },
    low: { label: "Low Priority", color: "#4A9EFF", bg: "#4A9EFF18" },
  };

  const categoryColor = {
    People: "#4A9EFF",
    Policy: "#F59E0B",
    Procedure: "#10B981",
  };

  const handleGetGuidance = async (req) => {
    setLoadingId(req.id);

    try {
      const raw = await callClaude(
        [
          {
            role: "user",
            content: `A manager named ${req.from} submitted a coaching request.
Category: ${req.category}
Question: "${req.question}"

Respond ONLY with a JSON object (no markdown, no extra text):
{"severity":"high|medium|low","severityReason":"one sentence why","guidance":"2-3 paragraphs of direct GM coaching guidance on how to respond to and support this manager"}`,
          },
        ],
        `You are advising a GM on how to handle a coaching request from one of their managers.
Respond ONLY with a JSON object.`
      );

      let parsed;

      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = {
          severity: "medium",
          severityReason: "Could not parse rating.",
          guidance: raw,
        };
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? {
                ...r,
                severity: parsed.severity,
                severityReason: parsed.severityReason,
                guidance: parsed.guidance,
              }
            : r
        )
      );

      setSelected(req.id);
    } catch {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? {
                ...r,
                severity: "medium",
                severityReason: "Fallback response used.",
                guidance: "Error fetching guidance.",
              }
            : r
        )
      );
    }

    setLoadingId(null);
  };

  const pending = requests.filter((r) => !r.severity);
  const reviewed = requests.filter((r) => r.severity);

  const renderRequest = (req) => {
    const isOpen = selected === req.id;
    const sev = severityConfig[req.severity];
    const catColor = categoryColor[req.category];

    return (
      <div
        key={req.id}
        style={{
          marginBottom: 12,
          borderRadius: 12,
          overflow: "hidden",
          background: "#0f172a",
          border: `1px solid ${
            isOpen && sev ? `${sev.color}55` : req.severity ? `${sev.color}22` : "#1e293b"
          }`,
          transition: "border 0.2s",
        }}
      >
        <div
          style={{ padding: "16px 18px", cursor: "pointer" }}
          onClick={() => setSelected(isOpen ? null : req.id)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: `${catColor}22`,
                  border: `1px solid ${catColor}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: catColor,
                  flexShrink: 0,
                }}
              >
                {req.from.charAt(0)}
              </div>
              <div>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 14 }}>
                  {req.from}
                </span>
                <span style={{ fontSize: 11, color: "#475569", marginLeft: 8 }}>
                  {req.timestamp}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: catColor,
                  background: `${catColor}18`,
                  padding: "2px 8px",
                  borderRadius: 20,
                }}
              >
                {req.category}
              </span>

              {req.severity && sev && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: sev.color,
                    background: sev.bg,
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  {sev.label}
                </span>
              )}

              <span style={{ fontSize: 11, color: "#334155" }}>{isOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              lineHeight: 1.5,
              paddingLeft: 36,
            }}
          >
            "{req.question.length > 100 && !isOpen ? `${req.question.slice(0, 100)}...` : req.question}"
          </div>
        </div>

        {isOpen && (
          <div style={{ borderTop: "1px solid #1e293b", padding: "16px 18px" }}>
            {!req.severity && (
              <button
                onClick={() => handleGetGuidance(req)}
                disabled={loadingId === req.id}
                style={{
                  ...primaryBtn,
                  fontSize: 13,
                  padding: "10px 22px",
                  marginBottom: req.guidance ? 16 : 0,
                  opacity: loadingId === req.id ? 0.6 : 1,
                }}
              >
                {loadingId === req.id ? "Analyzing..." : "Get AI Guidance →"}
              </button>
            )}

            {loadingId === req.id && <Spinner />}

            {req.severity && sev && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                    padding: "10px 14px",
                    background: sev.bg,
                    border: `1px solid ${sev.color}33`,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: sev.color,
                      boxShadow: `0 0 6px ${sev.color}`,
                    }}
                  />
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sev.color }}>
                      {sev.label}
                    </span>
                    {req.severityReason && (
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>
                        {req.severityReason}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#4A9EFF",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  GM Guidance
                </div>

                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                  {req.guidance.split("\n").map((line, i) => {
                    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <div key={i} style={{ marginBottom: 4 }}>
                        {parts.map((p, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} style={{ color: "#e2e8f0" }}>
                              {p}
                            </strong>
                          ) : (
                            p
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {pending.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Needs Review
            </div>
            <div
              style={{
                background: "#EF4444",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 20,
                padding: "1px 7px",
              }}
            >
              {pending.length}
            </div>
          </div>
          {pending.map(renderRequest)}
        </>
      )}

      {reviewed.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              color: "#334155",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 14,
              marginTop: pending.length > 0 ? 24 : 0,
            }}
          >
            Reviewed
          </div>
          {reviewed.map(renderRequest)}
        </>
      )}

      {requests.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#334155", fontSize: 13 }}>
          No coaching requests yet.
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("manager");
  const [tab, setTab] = useState("prompt");

  const tabs =
    role === "manager"
      ? [
          { id: "prompt", label: "Ask AI" },
          { id: "log", label: "Log Action" },
          { id: "coaching", label: "Request Coaching" },
        ]
      : [
          { id: "prompt", label: "Ask AI" },
          { id: "log", label: "Log Action" },
          { id: "coachinbox", label: "Coach Requests" },
          { id: "compliance", label: "Team Compliance" },
          { id: "oversight", label: "Oversight" },
        ];

  useEffect(() => {
    if (!tabs.find((t) => t.id === tab)) setTab("prompt");
  }, [role, tab, tabs]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070d1a",
        fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
        color: "#e2e8f0",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        textarea, input { outline: none; resize: vertical; }
        textarea:focus, input:focus { border-color: #4A9EFF !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      <div style={{ borderBottom: "1px solid #0f1929", padding: "0 24px" }}>
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: 60,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 16,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              LEAD
            </span>
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 16,
                color: "#4A9EFF",
                letterSpacing: "-0.02em",
              }}
            >
              IQ
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#334155",
                marginLeft: 10,
                letterSpacing: "0.1em",
              }}
            >
              MANAGEMENT AI
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              background: "#0f172a",
              padding: 4,
              borderRadius: 8,
              border: "1px solid #1e293b",
            }}
          >
            {Object.entries(ROLES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 5,
                  border: "none",
                  background: role === key ? `${val.color}22` : "transparent",
                  color: role === key ? val.color : "#475569",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "inherit",
                  fontWeight: role === key ? 700 : 400,
                  transition: "all 0.2s",
                  borderLeft: role === key
                    ? `2px solid ${val.color}`
                    : "2px solid transparent",
                }}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: ROLES[role].color,
              boxShadow: `0 0 8px ${ROLES[role].color}`,
            }}
          />
          <span style={{ fontSize: 12, color: ROLES[role].color, fontWeight: 500 }}>
            Logged in as {ROLES[role].label}
          </span>
          {role !== "manager" && (
            <span style={{ fontSize: 11, color: "#334155", marginLeft: 4 }}>
              — Oversight enabled
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #1e293b" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 20px",
                border: "none",
                background: "transparent",
                color: tab === t.id ? "#fff" : "#475569",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                borderBottom:
                  tab === t.id ? "2px solid #4A9EFF" : "2px solid transparent",
                marginBottom: -1,
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ animation: "fadeIn 0.3s ease" }} key={`${tab}-${role}`}>
          {tab === "prompt" && <PromptScreen role={role} />}
          {tab === "log" && <LogScreen />}
          {tab === "oversight" && <OversightScreen role={role} />}
          {tab === "compliance" && <ComplianceScreen role={role} />}
          {tab === "coaching" && <RequestCoachingScreen />}
          {tab === "coachinbox" && <CoachInboxScreen />}
        </div>

        {role === "manager" && (
          <div
            style={{
              marginTop: 48,
              padding: "14px 18px",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 12,
              color: "#334155",
              lineHeight: 1.6,
            }}
          >
            Your actions are logged and reviewed. Lead with consistency and document thoroughly.
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  fontWeight: 500,
};

const textareaStyle = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "inherit",
  lineHeight: 1.6,
  transition: "border 0.2s",
};

const inputStyle = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "11px 14px",
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "inherit",
  transition: "border 0.2s",
};

const primaryBtn = {
  padding: "12px 28px",
  background: "#4A9EFF",
  border: "none",
  borderRadius: 8,
  color: "#000",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: "0.02em",
  transition: "opacity 0.2s",
};

const secondaryBtn = {
  padding: "10px 24px",
  background: "transparent",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#94a3b8",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
