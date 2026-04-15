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

const CATEGORIES = ["HR", "Operations", "Food Safety"];

const FALLBACK_CATEGORY_KEYWORDS = {
  HR: [
    { keyword: "employee", weight: 2 },
    { keyword: "attendance", weight: 3 },
    { keyword: "late", weight: 2 },
    { keyword: "tardy", weight: 2 },
    { keyword: "call out", weight: 2 },
    { keyword: "no call", weight: 3 },
    { keyword: "no show", weight: 3 },
    { keyword: "write up", weight: 4 },
    { keyword: "harassment", weight: 5 },
    { keyword: "termination", weight: 5 },
    { keyword: "discipline", weight: 4 },
    { keyword: "schedule", weight: 2 },
    { keyword: "shift", weight: 2 },
    { keyword: "payroll", weight: 3 },
    { keyword: "hiring", weight: 3 },
    { keyword: "interview", weight: 2 },
  ],
  Operations: [
    { keyword: "deployment", weight: 4 },
    { keyword: "positioning", weight: 3 },
    { keyword: "labor", weight: 3 },
    { keyword: "ticket times", weight: 4 },
    { keyword: "rush", weight: 2 },
    { keyword: "line", weight: 2 },
    { keyword: "bottleneck", weight: 4 },
    { keyword: "staffing", weight: 3 },
    { keyword: "service", weight: 2 },
    { keyword: "customer flow", weight: 3 },
    { keyword: "drawer", weight: 2 },
    { keyword: "cash", weight: 2 },
    { keyword: "register", weight: 2 },
    { keyword: "coverage", weight: 2 },
    { keyword: "floor", weight: 2 },
    { keyword: "inventory", weight: 3 },
  ],
  "Food Safety": [
    { keyword: "temperature", weight: 4 },
    { keyword: "temp", weight: 3 },
    { keyword: "sanitizer", weight: 4 },
    { keyword: "glove", weight: 2 },
    { keyword: "gloves", weight: 2 },
    { keyword: "expired", weight: 4 },
    { keyword: "expiration", weight: 4 },
    { keyword: "dated", weight: 2 },
    { keyword: "holding", weight: 3 },
    { keyword: "contamination", weight: 5 },
    { keyword: "cross contamination", weight: 5 },
    { keyword: "cook temp", weight: 4 },
    { keyword: "raw", weight: 3 },
    { keyword: "thaw", weight: 3 },
    { keyword: "label", weight: 2 },
    { keyword: "clean", weight: 1 },
    { keyword: "hand wash", weight: 3 },
    { keyword: "food safety", weight: 5 },
  ],
};

const METRIC_DEFS = [
  {
    key: "pr",
    label: "PR%",
    desc: "Policy Reference Rate",
    target: 78,
    unit: "%",
  },
  {
    key: "pas",
    label: "PAS%",
    desc: "Policy Adherence Score",
    target: 85,
    unit: "%",
  },
  {
    key: "tpr",
    label: "TPR%",
    desc: "Team Performance Rating",
    target: 91,
    unit: "%",
  },
  {
    key: "ppd",
    label: "PP/D",
    desc: "Policy Pull / Documented Decision",
    target: 38,
    unit: "%",
  },
];

const PALETTE = {
  bg: "#071018",
  panel: "#0d1724",
  panelAlt: "#0a1320",
  border: "#1c2a3a",
  borderStrong: "#28384a",
  text: "#e6edf5",
  textSoft: "#98a7b8",
  textMuted: "#6f8194",
  blue: "#4d79b3",
  blueSoft: "rgba(77, 121, 179, 0.14)",
  green: "#5b8f73",
  greenSoft: "rgba(91, 143, 115, 0.14)",
  amber: "#b28a55",
  amberSoft: "rgba(178, 138, 85, 0.14)",
  red: "#9d5a5a",
  redSoft: "rgba(157, 90, 90, 0.14)",
  indigo: "#7b8fb8",
  indigoSoft: "rgba(123, 143, 184, 0.14)",
};

const CATEGORY_STYLES = {
  HR: {
    color: "#8ea0c7",
    bg: "rgba(142, 160, 199, 0.14)",
    border: "rgba(142, 160, 199, 0.28)",
  },
  Operations: {
    color: "#6d9c93",
    bg: "rgba(109, 156, 147, 0.14)",
    border: "rgba(109, 156, 147, 0.28)",
  },
  "Food Safety": {
    color: "#b49163",
    bg: "rgba(180, 145, 99, 0.14)",
    border: "rgba(180, 145, 99, 0.28)",
  },
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

function applyCompanyScope(query, scope) {
  if (scope?.company_id) return query.eq("company_id", scope.company_id);
  if (scope?.company) return query.eq("company", scope.company);
  return query;
}

function getCategoryStyle(category) {
  return (
    CATEGORY_STYLES[category] || {
      color: PALETTE.textSoft,
      bg: "rgba(148, 163, 184, 0.10)",
      border: "rgba(148, 163, 184, 0.20)",
    }
  );
}

function scoreMetricColor(metricKey, value) {
  if (metricKey === "ppd") {
    if (value >= 30 && value <= 45) return PALETTE.green;
    if ((value >= 20 && value < 30) || (value > 45 && value <= 60)) {
      return PALETTE.amber;
    }
    return PALETTE.red;
  }

  if (value >= 85) return PALETTE.green;
  if (value >= 70) return PALETTE.amber;
  return PALETTE.red;
}

function resolveCategory(item) {
  return item?.category || null;
}

function buildKeywordMapFromRows(rows) {
  const map = {
    HR: [],
    Operations: [],
    "Food Safety": [],
  };

  rows.forEach((row) => {
    if (map[row.category]) {
      map[row.category].push({
        keyword: row.keyword,
        weight: row.weight || 1,
      });
    }
  });

  return map;
}

function detectCategory(situation = "", action = "", keywordMap = FALLBACK_CATEGORY_KEYWORDS) {
  const text = `${situation} ${action}`.toLowerCase().trim();
  if (!text) {
    return { category: "", confidence: "review", score: 0 };
  }

  const categoryScores = Object.entries(keywordMap).map(([category, keywords]) => {
    const score = keywords.reduce((total, entry) => {
      return text.includes(String(entry.keyword).toLowerCase())
        ? total + Number(entry.weight || 1)
        : total;
    }, 0);

    return { category, score };
  });

  categoryScores.sort((a, b) => b.score - a.score);

  const top = categoryScores[0];
  const second = categoryScores[1];

  if (!top || top.score <= 0) {
    return { category: "", confidence: "review", score: 0 };
  }

  if (second && top.score === second.score) {
    return { category: "", confidence: "review", score: top.score };
  }

  if (top.score >= 8) {
    return { category: top.category, confidence: "high", score: top.score };
  }

  if (top.score >= 4) {
    return { category: top.category, confidence: "medium", score: top.score };
  }

  return { category: top.category, confidence: "low", score: top.score };
}

function seedFromFacility(facilityNumber = "") {
  const cleaned = String(facilityNumber).replace(/\D/g, "");
  const base = cleaned ? Number(cleaned) : 7;
  return Number.isNaN(base) ? 7 : base;
}

function buildMockMetrics(facilityNumber) {
  const seed = seedFromFacility(facilityNumber);
  return {
    pr: 72 + (seed % 9),
    pas: 80 + (seed % 8),
    tpr: 84 + (seed % 10),
    ppd: 34 + (seed % 9),
  };
}

function buildMockBreakdown(facilityNumber) {
  const seed = seedFromFacility(facilityNumber);
  const hr = 32 + (seed % 18);
  const ops = 28 + ((seed * 2) % 20);
  let food = 100 - hr - ops;

  if (food < 15) {
    food = 15;
  }

  const total = hr + ops + food;

  return [
    { category: "HR", category_percent: Number(((hr / total) * 100).toFixed(2)) },
    {
      category: "Operations",
      category_percent: Number(((ops / total) * 100).toFixed(2)),
    },
    {
      category: "Food Safety",
      category_percent: Number(((food / total) * 100).toFixed(2)),
    },
  ];
}

function normalizeBreakdownRows(rows, facilityNumber) {
  if (!rows || rows.length === 0) {
    return buildMockBreakdown(facilityNumber);
  }

  const map = {
    HR: 0,
    Operations: 0,
    "Food Safety": 0,
  };

  rows.forEach((row) => {
    if (map[row.category] !== undefined) {
      map[row.category] = Number(row.category_percent || 0);
    }
  });

  return CATEGORIES.map((category) => ({
    category,
    category_percent: map[category],
  }));
}

function MetricCard({ metric, value }) {
  const color = scoreMetricColor(metric.key, value);
  const width = Math.max(0, Math.min(100, value));
  const display = `${Math.round(value)}${metric.unit}`;

  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{metric.label}</div>
      <div style={{ ...styles.metricValue, color }}>{display}</div>
      <div style={styles.metricBarTrack}>
        <div
          style={{
            ...styles.metricBarFill,
            width: `${width}%`,
            background: color,
          }}
        />
      </div>
      <div style={styles.metricDesc}>{metric.desc}</div>
      {metric.key === "ppd" ? (
        <div style={styles.metricTarget}>Target: 38%</div>
      ) : null}
    </div>
  );
}

function CategoryBadge({ category }) {
  if (!category) return null;

  const tone = getCategoryStyle(category);

  return (
    <span
      style={{
        ...styles.categoryBadge,
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {category}
    </span>
  );
}

function DecisionCard({
  item,
  title,
  meta,
  formatDateFn,
  actions,
}) {
  const category = resolveCategory(item);

  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{title}</div>
          {meta ? <div style={styles.feedMeta}>{meta}</div> : null}
        </div>
        <div style={styles.feedDate}>{formatDateFn(item.created_at)}</div>
      </div>

      <div style={styles.feedInlineRow}>
        <CategoryBadge category={category} />
        {item.policy_referenced ? (
          <span style={styles.policyTag}>Policy: {item.policy_referenced}</span>
        ) : null}
        {item.is_read === false ? (
          <span style={styles.unreadBadge}>Unread</span>
        ) : null}
      </div>

      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Situation</div>
        <div style={styles.feedBody}>{item.situation || "—"}</div>
      </div>

      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Action Taken</div>
        <div style={styles.feedBody}>{item.action_taken || "—"}</div>
      </div>

      {actions ? <div style={styles.actionRow}>{actions}</div> : null}
    </div>
  );
}

function CoachingCard({ item, formatDateFn }) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{formatDateFn(item.created_at)}</div>
          <div style={styles.feedMeta}>{item.status || "open"}</div>
        </div>
      </div>

      <div style={styles.feedBody}>{item.request_text || "—"}</div>

      {item.leadership_notes ? (
        <div style={styles.guidanceBlock}>
          <div style={styles.guidanceLabel}>Guidance</div>
          <div style={styles.feedBody}>{item.leadership_notes}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TABS.policy);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [policyText, setPolicyText] = useState("");
  const [decisionSituation, setDecisionSituation] = useState("");
  const [decisionAction, setDecisionAction] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [decisionPolicy, setDecisionPolicy] = useState("");
  const [coachingText, setCoachingText] = useState("");
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);

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
  const [myLogsLoading, setMyLogsLoading] = useState(false);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilityPeopleLoading, setFacilityPeopleLoading] = useState(false);
  const [personFileLoading, setPersonFileLoading] = useState(false);

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

  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityPeople, setFacilityPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDecisions, setPersonDecisions] = useState([]);
  const [personCoaching, setPersonCoaching] = useState([]);
  const [personFileTab, setPersonFileTab] = useState("decisions");

  const [facilityMetrics, setFacilityMetrics] = useState({
    pr: 0,
    pas: 0,
    tpr: 0,
    ppd: 0,
  });
  const [animatedFacilityMetrics, setAnimatedFacilityMetrics] = useState({
    pr: 0,
    pas: 0,
    tpr: 0,
    ppd: 0,
  });
  const [facilityBreakdown, setFacilityBreakdown] = useState(
    buildMockBreakdown("")
  );

  const [keywordMap, setKeywordMap] = useState(FALLBACK_CATEGORY_KEYWORDS);

  const currentRoleLevel = useMemo(
    () => ROLE_LEVELS[profile?.role] || 1,
    [profile]
  );

  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const canViewFacilities =
    profile?.role === "Area Manager" || profile?.role === "Area Coach";
  const canRequestCoaching = profile?.role === "Manager";
  const isAreaManager = profile?.role === "Area Manager";
  const nextRole = getNextRole(profile?.role);

  const autoDetectedCategory = useMemo(() => {
    return detectCategory(decisionSituation, decisionAction, keywordMap);
  }, [decisionSituation, decisionAction, keywordMap]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!authUser) {
          window.location.href = "/";
          return;
        }

        setUser(authUser);

        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", authUser.id)
          .maybeSingle();

        setProfile(prof || null);
      } catch (err) {
        console.error("Dashboard load error:", err);
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
    const loadKeywords = async () => {
      try {
        const { data, error } = await supabase
          .from("decision_category_keywords")
          .select("category, keyword, weight, is_active")
          .eq("is_active", true);

        if (!error && data?.length) {
          setKeywordMap(buildKeywordMapFromRows(data));
        }
      } catch (err) {
        console.warn("Keyword fallback active:", err);
      }
    };

    loadKeywords();
  }, []);

  useEffect(() => {
    if (!categoryManuallySet) {
      setDecisionCategory(autoDetectedCategory.category || "");
    }
  }, [autoDetectedCategory, categoryManuallySet]);

  useEffect(() => {
    if (!selectedFacility) {
      setAnimatedFacilityMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
      return;
    }

    const target = facilityMetrics;
    const startTime = performance.now();
    const duration = 1200;
    let rafId;

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedFacilityMetrics({
        pr: Number((target.pr * eased).toFixed(0)),
        pas: Number((target.pas * eased).toFixed(0)),
        tpr: Number((target.tpr * eased).toFixed(0)),
        ppd: Number((target.ppd * eased).toFixed(0)),
      });

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [facilityMetrics, selectedFacility]);

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

    const detected = detectCategory(policyText, "", keywordMap);

    try {
      const payload = {
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        user_role: profile?.role || null,
        situation_text: policyText.trim(),
        category: detected.category || null,
        policy_query: policyText.trim(),
        policy_result_used: false,
      };

      const { error } = await supabase.from("policy_pull_logs").insert([payload]);

      if (error) throw error;

      setPolicyMessage("Policy pull logged. AI response layer comes next.");
    } catch (err) {
      console.error("Policy pull log error:", err);
      setPolicyMessage("Policy pull logging failed. Check policy_pull_logs setup.");
    }
  };

  const handleDecisionSubmit = async () => {
    setDecisionMessage("");

    if (!decisionSituation.trim() || !decisionAction.trim()) {
      setDecisionMessage("Please enter both the situation and action taken.");
      return;
    }

    const detected = detectCategory(decisionSituation, decisionAction, keywordMap);
    const finalCategory = categoryManuallySet
      ? decisionCategory
      : decisionCategory || detected.category;

    if (!finalCategory) {
      setDecisionMessage("Please select a category.");
      return;
    }

    if (!user) {
      setDecisionMessage("You must be logged in.");
      return;
    }

    setDecisionLoading(true);

    try {
      const payload = {
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        user_name: profile?.full_name || "Unknown",
        user_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        situation: decisionSituation.trim(),
        action_taken: decisionAction.trim(),
        category: finalCategory,
        category_source: categoryManuallySet ? "manual" : "auto",
        category_confidence: categoryManuallySet ? "high" : detected.confidence,
        category_score: categoryManuallySet ? null : detected.score,
        policy_referenced: decisionPolicy.trim() || null,
        is_read: false,
      };

      const { error } = await supabase.from("decision_logs").insert([payload]);

      if (error) throw error;

      setDecisionSituation("");
      setDecisionAction("");
      setDecisionCategory("");
      setDecisionPolicy("");
      setCategoryManuallySet(false);
      setDecisionMessage("Decision submitted successfully.");
    } catch (err) {
      console.error("Decision submit error:", err);
      setDecisionMessage(err.message || "Failed to submit decision.");
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
      const payload = {
        user_id: user.id,
        company: profile?.company || null,
        company_id: profile?.company_id || null,
        facility_number: profile?.facility_number || null,
        requester_name: profile?.full_name || "Unknown",
        requester_role: profile?.role || "Manager",
        submitted_by_role: profile?.role || "Manager",
        visible_to_role: nextRole,
        request_text: coachingText.trim(),
        status: "open",
      };

      const { error } = await supabase.from("coaching_requests").insert([payload]);

      if (error) throw error;

      setCoachingText("");
      setCoachingMessage("Coaching request submitted.");
    } catch (err) {
      console.error("Coaching submit error:", err);
      setCoachingMessage(err.message || "Failed to submit coaching request.");
    } finally {
      setCoachingLoading(false);
    }
  };

  const fetchTeamDecisions = async () => {
    if (!profile?.role) return;

    setTeamDecisionsLoading(true);
    setTeamDecisionsMessage("");

    try {
      let query = supabase
        .from("decision_logs")
        .select("*")
        .eq("visible_to_role", profile.role)
        .eq("is_read", false)
        .neq("user_id", user?.id || "")
        .order("created_at", { ascending: false });

      query = applyCompanyScope(query, profile);

      const { data, error } = await query;

      if (error) throw error;

      setTeamDecisions(data || []);
    } catch (err) {
      console.error("Fetch team decisions error:", err);
      setTeamDecisionsMessage(err.message || "Failed to load team decisions.");
    } finally {
      setTeamDecisionsLoading(false);
    }
  };

  const fetchTeamCoachingRequests = async () => {
    if (!profile?.role) return;

    setTeamCoachingLoading(true);
    setTeamCoachingMessage("");

    try {
      let query = supabase
        .from("coaching_requests")
        .select("*")
        .eq("visible_to_role", profile.role)
        .neq("user_id", user?.id || "")
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });

      query = applyCompanyScope(query, profile);

      const { data, error } = await query;

      if (error) throw error;

      setTeamCoachingRequests(data || []);
    } catch (err) {
      console.error("Fetch team coaching error:", err);
      setTeamCoachingMessage(err.message || "Failed to load team coaching.");
    } finally {
      setTeamCoachingLoading(false);
    }
  };

  const fetchManagers = async () => {
    if (!profile?.company && !profile?.company_id) return;

    setManagersLoading(true);
    setManagersMessage("");

    try {
      let query = supabase
        .from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("role", "Manager")
        .order("full_name", { ascending: true });

      query = applyCompanyScope(query, profile);

      const { data, error } = await query;

      if (error) throw error;

      setManagers(data || []);
    } catch (err) {
      console.error("Fetch managers error:", err);
      setManagersMessage(err.message || "Failed to load managers.");
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
      const [{ data: decisions, error: decisionsError }, { data: coaching, error: coachingError }] =
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

      if (decisionsError) throw decisionsError;
      if (coachingError) throw coachingError;

      setSelectedManagerDecisions(decisions || []);
      setSelectedManagerCoaching(coaching || []);
    } catch (err) {
      console.error("Open manager file error:", err);
      setManagersMessage(err.message || "Failed to open manager file.");
    } finally {
      setSelectedManagerLoading(false);
    }
  };

  const markDecisionAsRead = async (decisionId, userId) => {
    try {
      const { error } = await supabase
        .from("decision_logs")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: user.id,
        })
        .eq("id", decisionId);

      if (error) throw error;

      await fetchTeamDecisions();

      let manager = managers.find((item) => item.id === userId);

      if (!manager) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId)
          .maybeSingle();

        manager = data;
      }

      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (err) {
      console.error("Mark as read error:", err);
      setTeamDecisionsMessage(err.message || "Failed to mark as read.");
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
          resolution_type: "guidance_given",
          resolution_summary: guidanceText.trim(),
          resolved_at: now,
          resolved_by: user.id,
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
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId)
          .maybeSingle();

        manager = data;
      }

      if (manager) {
        setActiveTab(TABS.managers);
        await openManagerFile(manager);
      }
    } catch (err) {
      console.error("Give guidance error:", err);
      setTeamCoachingMessage(err.message || "Failed to save guidance.");
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
    } catch (err) {
      console.error("My logs error:", err);
    } finally {
      setMyLogsLoading(false);
    }
  };

  const fetchFacilities = async () => {
    if (!user?.id) return;

    setFacilitiesLoading(true);
    setFacilitiesMessage("");
    setSelectedFacility(null);
    setFacilityPeople([]);
    setSelectedPerson(null);
    setPersonDecisions([]);
    setPersonCoaching([]);

    try {
      const { data: assignedFacilities, error } = await supabase
        .from("area_manager_facilities")
        .select("*")
        .eq("area_manager_id", user.id);

      if (error) throw error;

      if (assignedFacilities?.length) {
        setFacilities(assignedFacilities);
        return;
      }

      if (profile?.role === "Area Coach") {
        let fallbackQuery = supabase
          .from("facilities")
          .select("*")
          .order("facility_number", { ascending: true });

        fallbackQuery = applyCompanyScope(fallbackQuery, profile);

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) throw fallbackError;

        setFacilities(fallbackData || []);

        if (!fallbackData?.length) {
          setFacilitiesMessage("No facilities found for your account.");
        }
        return;
      }

      setFacilities([]);
      setFacilitiesMessage("No facilities assigned to your account.");
    } catch (err) {
      console.error("Fetch facilities error:", err);
      setFacilitiesMessage(err.message || "Failed to load facilities.");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const fetchFacilityPeople = async (facility) => {
    setSelectedFacility(facility);
    setSelectedPerson(null);
    setPersonDecisions([]);
    setPersonCoaching([]);
    setFacilityPeople([]);
    setFacilityPeopleLoading(true);
    setFacilitiesMessage("");

    try {
      let peopleQuery = supabase
        .from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("facility_number", facility.facility_number)
        .in("role", ["General Manager", "Manager"]);

      peopleQuery = applyCompanyScope(
        peopleQuery,
        facility?.company_id
          ? { company_id: facility.company_id }
          : { company: facility.company }
      );

      let metricsQuery = supabase
        .from("facility_metrics")
        .select("*")
        .eq("facility_number", facility.facility_number)
        .maybeSingle();

      metricsQuery = applyCompanyScope(
        metricsQuery,
        facility?.company_id
          ? { company_id: facility.company_id }
          : { company: facility.company }
      );

      let breakdownQuery = supabase
        .from("facility_category_breakdown")
        .select("*")
        .eq("facility_number", facility.facility_number);

      breakdownQuery = applyCompanyScope(
        breakdownQuery,
        facility?.company_id
          ? { company_id: facility.company_id }
          : { company: facility.company }
      );

      const [
        { data: peopleData, error: peopleError },
        { data: metricsData, error: metricsError },
        { data: breakdownData, error: breakdownError },
      ] = await Promise.all([peopleQuery, metricsQuery, breakdownQuery]);

      if (peopleError) throw peopleError;

      const sortedPeople = (peopleData || []).sort((a, b) => {
        const rank = {
          "General Manager": 0,
          Manager: 1,
        };

        const roleDiff = (rank[a.role] ?? 9) - (rank[b.role] ?? 9);
        if (roleDiff !== 0) return roleDiff;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });

      setFacilityPeople(sortedPeople);

      if (metricsError || !metricsData) {
        setFacilityMetrics(buildMockMetrics(facility.facility_number));
      } else {
        setFacilityMetrics({
          pr: Number(metricsData.pr_percent || 0),
          pas: Number(metricsData.pas_percent || 0),
          tpr: Number(metricsData.tpr_percent || 0),
          ppd: Number(metricsData.ppd_percent || 0),
        });
      }

      if (breakdownError || !breakdownData?.length) {
        setFacilityBreakdown(buildMockBreakdown(facility.facility_number));
      } else {
        setFacilityBreakdown(
          normalizeBreakdownRows(breakdownData, facility.facility_number)
        );
      }

      if (!sortedPeople.length) {
        setFacilitiesMessage("No staff found in this facility.");
      }
    } catch (err) {
      console.error("Fetch facility people error:", err);
      setFacilityMetrics(buildMockMetrics(facility.facility_number));
      setFacilityBreakdown(buildMockBreakdown(facility.facility_number));
      setFacilitiesMessage(err.message || "Failed to load facility data.");
    } finally {
      setFacilityPeopleLoading(false);
    }
  };

  const openPersonFile = async (person) => {
    setSelectedPerson(person);
    setPersonFileLoading(true);
    setPersonDecisions([]);
    setPersonCoaching([]);
    setPersonFileTab("decisions");

    try {
      const [{ data: decisions, error: decisionsError }, { data: coaching, error: coachingError }] =
        await Promise.all([
          supabase
            .from("decision_logs")
            .select("*")
            .eq("user_id", person.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("coaching_requests")
            .select("*")
            .eq("user_id", person.id)
            .order("created_at", { ascending: false }),
        ]);

      if (decisionsError) throw decisionsError;
      if (coachingError) throw coachingError;

      setPersonDecisions(decisions || []);
      setPersonCoaching(coaching || []);
    } catch (err) {
      console.error("Open person file error:", err);
    } finally {
      setPersonFileLoading(false);
    }
  };

  const navItems = [
    {
      tab: TABS.policy,
      label: "Request Policy",
      show: true,
    },
    {
      tab: TABS.decision,
      label: "Document Decision",
      show: !isAreaManager,
    },
    {
      tab: TABS.coaching,
      label: "Request Coaching",
      show: canRequestCoaching,
    },
    {
      divider: true,
      show: canViewLeadershipTabs && !isAreaManager,
    },
    {
      tab: TABS.teamDecisions,
      label: "Team Decisions",
      show: canViewLeadershipTabs && !isAreaManager,
      onEnter: fetchTeamDecisions,
    },
    {
      tab: TABS.teamCoaching,
      label: "Team Coaching",
      show: canViewLeadershipTabs && !isAreaManager,
      onEnter: fetchTeamCoachingRequests,
    },
    {
      tab: TABS.managers,
      label: "Managers",
      show: canViewLeadershipTabs && !isAreaManager,
      onEnter: fetchManagers,
    },
    {
      divider: true,
      show: canViewFacilities,
    },
    {
      tab: TABS.facilities,
      label: "Facilities",
      show: canViewFacilities,
      onEnter: fetchFacilities,
    },
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .fade-up { animation: fadeUp 0.2s ease both; }
            .nav-tab:hover { background: #132030 !important; color: #f4f7fb !important; }
            .person-row:hover { border-color: #314256 !important; background: #101b29 !important; }
          `,
        }}
      />

      <header style={{ ...styles.topNav, padding: isMobile ? "14px 16px" : "12px 20px" }}>
        <div style={styles.topNavBrand}>
          <div style={{ ...styles.topNavName, fontSize: isMobile ? "17px" : "14px" }}>
            {profile?.full_name || "Dashboard"}
          </div>
          <div style={{ ...styles.topNavMeta, fontSize: isMobile ? "13px" : "11px" }}>
            {profile?.role} · {profile?.company}
          </div>
        </div>

        {!isMobile ? (
          <nav style={styles.topNavItems}>
            <button
              className="nav-tab"
              style={{
                ...styles.topNavBtn,
                ...(activeTab === TABS.myLogs ? styles.topNavBtnActive : {}),
              }}
              onClick={() => {
                setActiveTab(TABS.myLogs);
                fetchMyLogs();
              }}
            >
              My Logs
            </button>

            <div style={styles.topNavDivider} />

            {navItems.map((item, index) => {
              if (!item.show) return null;
              if (item.divider) return <div key={index} style={styles.topNavDivider} />;

              return (
                <button
                  key={item.tab}
                  className="nav-tab"
                  style={{
                    ...styles.topNavBtn,
                    ...(activeTab === item.tab ? styles.topNavBtnActive : {}),
                  }}
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
        ) : null}

        <div style={styles.topNavRight}>
          {!isMobile ? (
            <button style={styles.topNavLogout} onClick={handleLogout}>
              Log Out
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={styles.mobileMenuBtn}
                onClick={() => {
                  setActiveTab(TABS.myLogs);
                  fetchMyLogs();
                  setMobileMenuOpen(false);
                }}
              >
                My Logs
              </button>

              <button
                style={styles.mobileMenuBtn}
                onClick={() => setMobileMenuOpen((value) => !value)}
              >
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>
      </header>

      {isMobile && mobileMenuOpen ? (
        <div style={styles.mobileDropdown}>
          {navItems.map((item, index) => {
            if (!item.show) return null;
            if (item.divider) return <div key={index} style={styles.navDivider} />;

            return (
              <button
                key={item.tab}
                style={{
                  ...styles.navButton,
                  ...(activeTab === item.tab ? styles.navButtonActive : {}),
                }}
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

          <button style={styles.logoutButton} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      ) : null}

      <main style={styles.main}>
        {activeTab === TABS.policy ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Policy</h1>
              <p style={styles.subtitle}>
                Describe the situation and log a policy pull before the response layer is added.
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
        ) : null}

        {activeTab === TABS.decision ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Document Decision</h1>
              <p style={styles.subtitle}>
                Record the situation, the action taken, and the category.
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

              <div style={styles.sectionDivider} />

              <div style={styles.sectionTitle}>Category</div>
              <select
                value={decisionCategory}
                onChange={(e) => {
                  setDecisionCategory(e.target.value);
                  setCategoryManuallySet(true);
                }}
                style={styles.categorySelect}
              >
                <option value="">— Select a category —</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {autoDetectedCategory.category && !categoryManuallySet ? (
                <div style={styles.autoDetectedText}>
                  Auto-detected: {autoDetectedCategory.category}
                </div>
              ) : null}

              <div style={styles.sectionDivider} />

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
                  marginTop: "14px",
                }}
                onClick={handleDecisionSubmit}
                disabled={decisionLoading}
              >
                {decisionLoading ? "Submitting..." : "Submit Decision"}
              </button>

              {decisionMessage ? <p style={styles.message}>{decisionMessage}</p> : null}
            </div>
          </>
        ) : null}

        {activeTab === TABS.coaching && canRequestCoaching ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Coaching</h1>
              <p style={styles.subtitle}>
                Ask your General Manager for guidance and support.
              </p>
            </div>

            <div style={styles.panelCard}>
              <label style={styles.label}>Describe what you need support with</label>
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
        ) : null}

        {activeTab === TABS.myLogs ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>My Logs</h1>
              <p style={styles.subtitle}>Your personal decision and coaching history.</p>
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
                  <button style={styles.secondaryButton} onClick={() => setMyLogType(null)}>
                    ← Back
                  </button>
                ) : null}
              </div>

              {myLogsLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : !myLogType ? (
                <div style={styles.logTypeSelector}>
                  <button
                    style={styles.logTypeButton}
                    onClick={() => setMyLogType("decisions")}
                  >
                    <div style={styles.logTypeTitle}>Decision Logs</div>
                    <div style={styles.logTypeMeta}>
                      {myDecisions.length} record{myDecisions.length !== 1 ? "s" : ""}
                    </div>
                  </button>

                  <button
                    style={styles.logTypeButton}
                    onClick={() => setMyLogType("coaching")}
                  >
                    <div style={styles.logTypeTitle}>Coaching Logs</div>
                    <div style={styles.logTypeMeta}>
                      {myCoaching.length} record{myCoaching.length !== 1 ? "s" : ""}
                    </div>
                  </button>
                </div>
              ) : myLogType === "decisions" ? (
                <div style={styles.cardList}>
                  {myDecisions.length === 0 ? (
                    <p style={styles.message}>No decision logs yet.</p>
                  ) : (
                    myDecisions.map((item) => (
                      <DecisionCard
                        key={item.id}
                        item={item}
                        title={formatDate(item.created_at)}
                        meta={item.is_read ? "Reviewed by leadership" : "Pending review"}
                        formatDateFn={formatDate}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div style={styles.cardList}>
                  {myCoaching.length === 0 ? (
                    <p style={styles.message}>No coaching requests yet.</p>
                  ) : (
                    myCoaching.map((item) => (
                      <CoachingCard
                        key={item.id}
                        item={item}
                        formatDateFn={formatDate}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}

        {activeTab === TABS.teamDecisions && canViewLeadershipTabs && !isAreaManager ? (
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

              {teamDecisionsMessage ? <p style={styles.message}>{teamDecisionsMessage}</p> : null}

              {teamDecisionsLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : teamDecisions.length === 0 ? (
                <p style={styles.message}>No unread team decisions.</p>
              ) : (
                <div style={styles.cardList}>
                  {teamDecisions.map((item) => (
                    <DecisionCard
                      key={item.id}
                      item={item}
                      title={item.user_name || "Unknown User"}
                      meta={`${item.user_role || "Manager"}${item.company ? ` · ${item.company}` : ""}`}
                      formatDateFn={formatDate}
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
        ) : null}

        {activeTab === TABS.teamCoaching && canViewLeadershipTabs && !isAreaManager ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Team Coaching Requests</h1>
              <p style={styles.subtitle}>
                Review and respond to coaching requests from your team.
              </p>
            </div>

            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Coaching Queue</div>
                <button style={styles.secondaryButton} onClick={fetchTeamCoachingRequests}>
                  Refresh
                </button>
              </div>

              {teamCoachingMessage ? <p style={styles.message}>{teamCoachingMessage}</p> : null}

              {teamCoachingLoading ? (
                <p style={styles.message}>Loading...</p>
              ) : teamCoachingRequests.length === 0 ? (
                <p style={styles.message}>No open coaching requests.</p>
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
                            {item.requester_role || "Manager"}
                            {item.company ? ` · ${item.company}` : ""}
                          </div>
                        </div>
                        <div style={styles.feedDate}>{formatDate(item.created_at)}</div>
                      </div>

                      <div style={styles.feedInlineRow}>
                        <span style={styles.statusBadge}>{item.status || "open"}</span>
                      </div>

                      <div style={styles.feedBody}>{item.request_text || "—"}</div>

                      {item.leadership_notes ? (
                        <div style={styles.guidanceBlock}>
                          <div style={styles.guidanceLabel}>Leadership Notes</div>
                          <div style={styles.feedBody}>{item.leadership_notes}</div>
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
        ) : null}

        {activeTab === TABS.managers && canViewLeadershipTabs && !isAreaManager ? (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Managers</h1>
              <p style={styles.subtitle}>
                Review managers and open their documentation history.
              </p>
            </div>

            <div
              style={{
                ...styles.managersLayout,
                gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
              }}
            >
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Manager Directory</div>
                  <button style={styles.secondaryButton} onClick={fetchManagers}>
                    Refresh
                  </button>
                </div>

                {managersMessage ? <p style={styles.message}>{managersMessage}</p> : null}

                {managersLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : managers.length === 0 ? (
                  <p style={styles.message}>No managers found.</p>
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
                          {manager.full_name || "Unnamed"}
                        </div>
                        <div style={styles.managerRowMeta}>
                          {manager.role}
                          {manager.company ? ` · ${manager.company}` : ""}
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
                      ? `${selectedManager.full_name} — ${
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
                  <p style={styles.message}>
                    Select a manager to view their documentation.
                  </p>
                ) : selectedManagerLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : !managerFileTab ? (
                  <div style={styles.logTypeSelector}>
                    <button
                      style={styles.logTypeButton}
                      onClick={() => setManagerFileTab("decisions")}
                    >
                      <div style={styles.logTypeTitle}>Decision Logs</div>
                      <div style={styles.logTypeMeta}>
                        {selectedManagerDecisions.length} record
                        {selectedManagerDecisions.length !== 1 ? "s" : ""}
                      </div>
                    </button>

                    <button
                      style={styles.logTypeButton}
                      onClick={() => setManagerFileTab("coaching")}
                    >
                      <div style={styles.logTypeTitle}>Coaching Logs</div>
                      <div style={styles.logTypeMeta}>
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
                        <DecisionCard
                          key={item.id}
                          item={item}
                          title={formatDate(item.created_at)}
                          meta={item.is_read ? "Read" : "Unread"}
                          formatDateFn={formatDate}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {selectedManagerCoaching.length === 0 ? (
                      <p style={styles.message}>No coaching logs found.</p>
                    ) : (
                      selectedManagerCoaching.map((item) => (
                        <CoachingCard
                          key={item.id}
                          item={item}
                          formatDateFn={formatDate}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

        {activeTab === TABS.facilities && canViewFacilities ? (
          <>
            <div style={styles.headerCard}>
              <div style={styles.facilitiesHeaderTop}>
                <div>
                  <h1 style={styles.title}>Facilities</h1>
                  <p style={styles.subtitle}>
                    {selectedPerson
                      ? `${selectedPerson.full_name} — ${selectedPerson.role}`
                      : selectedFacility
                      ? `Facility ${selectedFacility.facility_number} · ${
                          selectedFacility.company || profile?.company || ""
                        }`
                      : "Select a facility to inspect performance and staff."}
                  </p>
                </div>

                {selectedPerson ? (
                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      setSelectedPerson(null);
                      setPersonDecisions([]);
                      setPersonCoaching([]);
                    }}
                  >
                    ← Back to People
                  </button>
                ) : selectedFacility ? (
                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      setSelectedFacility(null);
                      setFacilityPeople([]);
                      setSelectedPerson(null);
                      setFacilityMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
                      setFacilityBreakdown(buildMockBreakdown(""));
                    }}
                  >
                    ← All Facilities
                  </button>
                ) : null}
              </div>

              {selectedFacility || selectedPerson ? (
                <div style={styles.breadcrumb}>
                  <button
                    style={styles.breadcrumbLink}
                    onClick={() => {
                      setSelectedFacility(null);
                      setFacilityPeople([]);
                      setSelectedPerson(null);
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
                          setSelectedPerson(null);
                          setPersonDecisions([]);
                          setPersonCoaching([]);
                        }}
                      >
                        Facility {selectedFacility.facility_number}
                      </button>
                    </>
                  ) : null}

                  {selectedPerson ? (
                    <>
                      <span style={styles.breadcrumbSep}>›</span>
                      <span style={styles.breadcrumbCurrent}>
                        {selectedPerson.full_name}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {!selectedFacility ? (
                <div style={styles.facilitySelectorWrap}>
                  {facilitiesLoading ? (
                    <p style={styles.message}>Loading facilities...</p>
                  ) : facilities.length === 0 ? (
                    <p style={styles.message}>
                      {facilitiesMessage || "No facilities found."}
                    </p>
                  ) : (
                    <div style={styles.facilityPillWrap}>
                      {facilities.map((facility) => (
                        <button
                          key={`${facility.company || "company"}-${facility.facility_number}`}
                          onClick={() => fetchFacilityPeople(facility)}
                          style={styles.facilityPill}
                        >
                          Facility {facility.facility_number}
                          <span style={styles.facilityPillMeta}>
                            {facility.company || profile?.company || ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {selectedFacility && !selectedPerson ? (
              <>
                <div style={styles.metricsGrid} className="fade-up">
                  {METRIC_DEFS.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      value={animatedFacilityMetrics[metric.key] || 0}
                    />
                  ))}
                </div>

                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Category Mix</div>
                    <div style={styles.sectionHint}>Facility-level category distribution</div>
                  </div>

                  <div style={styles.breakdownList}>
                    {facilityBreakdown.map((item) => {
                      const style = getCategoryStyle(item.category);
                      return (
                        <div key={item.category} style={styles.breakdownItem}>
                          <div style={styles.breakdownTop}>
                            <div style={styles.breakdownLeft}>
                              <span
                                style={{
                                  ...styles.breakdownBadge,
                                  color: style.color,
                                  background: style.bg,
                                  border: `1px solid ${style.border}`,
                                }}
                              >
                                {item.category === "Operations" ? "Ops" : item.category}
                              </span>
                            </div>
                            <div style={{ ...styles.breakdownPercent, color: style.color }}>
                              {Math.round(item.category_percent)}%
                            </div>
                          </div>

                          <div style={styles.breakdownTrack}>
                            <div
                              style={{
                                ...styles.breakdownFill,
                                width: `${Math.max(
                                  0,
                                  Math.min(100, item.category_percent)
                                )}%`,
                                background: style.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Staff</div>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => fetchFacilityPeople(selectedFacility)}
                    >
                      Refresh
                    </button>
                  </div>

                  {facilitiesMessage ? (
                    <p style={styles.message}>{facilitiesMessage}</p>
                  ) : null}

                  {facilityPeopleLoading ? (
                    <p style={styles.message}>Loading staff...</p>
                  ) : facilityPeople.length === 0 ? (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyStateIcon}>👥</div>
                      <div style={styles.emptyStateTitle}>No staff found</div>
                      <div style={styles.emptyStateText}>
                        Make sure profiles have the correct facility_number set.
                      </div>
                    </div>
                  ) : (
                    <div style={styles.peopleList}>
                      {facilityPeople.map((person) => (
                        <button
                          key={person.id}
                          className="person-row"
                          style={styles.personRow}
                          onClick={() => openPersonFile(person)}
                        >
                          <div>
                            <div style={styles.personName}>
                              {person.full_name || "Unnamed"}
                            </div>
                            <div style={styles.personMeta}>
                              {person.role} · Facility {person.facility_number}
                            </div>
                          </div>

                          <div style={styles.personRight}>
                            <span
                              style={{
                                ...styles.personRoleBadge,
                                ...(person.role === "General Manager"
                                  ? styles.personRoleBadgeGm
                                  : styles.personRoleBadgeMgr),
                              }}
                            >
                              {person.role === "General Manager" ? "GM" : "MGR"}
                            </span>
                            <span style={styles.personChevron}>›</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {selectedPerson ? (
              <div style={styles.personFileStack} className="fade-up">
                <div style={styles.panelCard}>
                  <div style={styles.personFileTitle}>{selectedPerson.full_name}</div>
                  <div style={styles.personFileMeta}>
                    {selectedPerson.role} · {selectedPerson.company || profile?.company || ""}
                    {" · "}
                    Facility {selectedPerson.facility_number}
                  </div>

                  <div style={styles.personStatsRow}>
                    <div style={styles.personStatBlock}>
                      <div style={{ ...styles.personStatValue, color: PALETTE.blue }}>
                        {personDecisions.length}
                      </div>
                      <div style={styles.personStatLabel}>Decisions</div>
                    </div>

                    <div style={styles.personStatDivider} />

                    <div style={styles.personStatBlock}>
                      <div style={{ ...styles.personStatValue, color: PALETTE.indigo }}>
                        {personCoaching.length}
                      </div>
                      <div style={styles.personStatLabel}>Coaching</div>
                    </div>
                  </div>
                </div>

                {personFileLoading ? (
                  <div style={styles.panelCard}>
                    <p style={styles.message}>Loading logs...</p>
                  </div>
                ) : (
                  <div style={styles.panelCard}>
                    <div style={styles.personTabRow}>
                      <button
                        style={{
                          ...styles.personTabButton,
                          ...(personFileTab === "decisions"
                            ? styles.personTabButtonActive
                            : {}),
                        }}
                        onClick={() => setPersonFileTab("decisions")}
                      >
                        Decision Logs ({personDecisions.length})
                      </button>

                      <button
                        style={{
                          ...styles.personTabButton,
                          ...(personFileTab === "coaching"
                            ? styles.personTabButtonActive
                            : {}),
                        }}
                        onClick={() => setPersonFileTab("coaching")}
                      >
                        Coaching Logs ({personCoaching.length})
                      </button>
                    </div>

                    {personFileTab === "decisions" ? (
                      personDecisions.length === 0 ? (
                        <div style={styles.emptyStateTight}>
                          No decision logs on record.
                        </div>
                      ) : (
                        <div style={styles.cardList}>
                          {personDecisions.map((item) => (
                            <DecisionCard
                              key={item.id}
                              item={item}
                              title={formatDate(item.created_at)}
                              meta={item.user_role || selectedPerson.role}
                              formatDateFn={formatDate}
                            />
                          ))}
                        </div>
                      )
                    ) : personCoaching.length === 0 ? (
                      <div style={styles.emptyStateTight}>
                        No coaching logs on record.
                      </div>
                    ) : (
                      <div style={styles.cardList}>
                        {personCoaching.map((item) => (
                          <CoachingCard
                            key={item.id}
                            item={item}
                            formatDateFn={formatDate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: PALETTE.bg,
    color: PALETTE.text,
    padding: "16px",
    boxSizing: "border-box",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loadingCard: {
    maxWidth: "520px",
    margin: "120px auto",
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px",
    padding: "32px",
    textAlign: "center",
    color: PALETTE.text,
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
  },
  topNav: {
    maxWidth: "1420px",
    margin: "0 auto 18px",
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
  },
  topNavBrand: {
    minWidth: "220px",
  },
  topNavName: {
    fontWeight: 700,
    color: PALETTE.text,
    lineHeight: 1.1,
  },
  topNavMeta: {
    color: PALETTE.textSoft,
    marginTop: "2px",
  },
  topNavItems: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    overflowX: "auto",
  },
  topNavBtn: {
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.textSoft,
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  topNavBtnActive: {
    background: PALETTE.blueSoft,
    color: "#d8e6f7",
    border: `1px solid rgba(77, 121, 179, 0.36)`,
  },
  topNavDivider: {
    width: "1px",
    height: "18px",
    background: PALETTE.borderStrong,
    flexShrink: 0,
  },
  topNavRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  topNavLogout: {
    border: `1px solid ${PALETTE.borderStrong}`,
    background: "transparent",
    color: PALETTE.textSoft,
    borderRadius: "14px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  mobileMenuBtn: {
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  mobileDropdown: {
    maxWidth: "1420px",
    margin: "-4px auto 18px",
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "18px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  navDivider: {
    height: "1px",
    background: PALETTE.borderStrong,
    margin: "4px 0",
  },
  navButton: {
    width: "100%",
    textAlign: "left",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.textSoft,
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  navButtonActive: {
    background: PALETTE.blueSoft,
    color: "#d8e6f7",
    border: `1px solid rgba(77, 121, 179, 0.36)`,
  },
  logoutButton: {
    width: "100%",
    textAlign: "left",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: "transparent",
    color: PALETTE.textSoft,
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    maxWidth: "1420px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  headerCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.04,
    fontWeight: 800,
    color: PALETTE.text,
  },
  subtitle: {
    margin: "10px 0 0",
    fontSize: "15px",
    lineHeight: 1.65,
    color: PALETTE.textSoft,
    maxWidth: "820px",
  },
  panelCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  label: {
    display: "block",
    marginBottom: "10px",
    fontSize: "14px",
    fontWeight: 700,
    color: PALETTE.text,
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    borderRadius: "16px",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "16px",
  },
  textareaSmall: {
    width: "100%",
    minHeight: "130px",
    borderRadius: "16px",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "16px",
  },
  primaryButton: {
    border: `1px solid rgba(77, 121, 179, 0.36)`,
    background: PALETTE.blueSoft,
    color: "#d8e6f7",
    borderRadius: "14px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    borderRadius: "14px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "12px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: PALETTE.textSoft,
  },
  sectionDivider: {
    height: "1px",
    background: PALETTE.borderStrong,
    margin: "4px 0 16px",
  },
  sectionTitle: {
    marginBottom: "10px",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: PALETTE.textMuted,
    fontWeight: 800,
  },
  categorySelect: {
    width: "100%",
    borderRadius: "14px",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  autoDetectedText: {
    marginTop: "8px",
    marginBottom: "4px",
    fontSize: "12px",
    color: PALETTE.textMuted,
  },
  policyInput: {
    width: "100%",
    borderRadius: "14px",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  sectionTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  sectionHeading: {
    fontSize: "22px",
    fontWeight: 800,
    color: PALETTE.text,
  },
  sectionHint: {
    fontSize: "12px",
    color: PALETTE.textMuted,
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  feedCard: {
    background: PALETTE.panelAlt,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "18px",
    padding: "16px",
  },
  feedTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  feedName: {
    fontSize: "16px",
    fontWeight: 800,
    color: PALETTE.text,
    marginBottom: "4px",
  },
  feedMeta: {
    fontSize: "13px",
    color: PALETTE.textSoft,
  },
  feedDate: {
    fontSize: "12px",
    color: PALETTE.textMuted,
  },
  feedInlineRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  feedSection: {
    marginTop: "12px",
  },
  feedLabel: {
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: PALETTE.textMuted,
  },
  feedBody: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: PALETTE.text,
    whiteSpace: "pre-wrap",
  },
  policyTag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    background: PALETTE.blueSoft,
    border: `1px solid rgba(77, 121, 179, 0.28)`,
    color: "#a8c2e3",
  },
  unreadBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    background: PALETTE.amberSoft,
    border: `1px solid rgba(178, 138, 85, 0.28)`,
    color: "#d3b182",
  },
  categoryBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.20)",
    color: PALETTE.textSoft,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "14px",
  },
  guidanceBlock: {
    marginTop: "14px",
    borderLeft: `3px solid ${PALETTE.blue}`,
    paddingLeft: "12px",
  },
  guidanceLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#a8c2e3",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  guidancePrompt: {
    width: "100%",
  },
  guidanceTextarea: {
    width: "100%",
    minHeight: "120px",
    borderRadius: "14px",
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    padding: "14px 16px",
    fontSize: "14px",
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  guidanceButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "12px",
  },
  managersLayout: {
    display: "grid",
    gap: "18px",
  },
  managerRowButton: {
    width: "100%",
    textAlign: "left",
    borderRadius: "16px",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    padding: "15px",
    cursor: "pointer",
  },
  managerRowButtonActive: {
    border: `1px solid ${PALETTE.blue}`,
    background: "rgba(77, 121, 179, 0.12)",
  },
  managerRowName: {
    fontSize: "15px",
    fontWeight: 800,
    color: PALETTE.text,
    marginBottom: "4px",
  },
  managerRowMeta: {
    fontSize: "13px",
    color: PALETTE.textSoft,
  },
  logTypeSelector: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  logTypeButton: {
    textAlign: "left",
    borderRadius: "18px",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    padding: "18px",
    cursor: "pointer",
  },
  logTypeTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: PALETTE.text,
    marginBottom: "8px",
  },
  logTypeMeta: {
    fontSize: "13px",
    color: PALETTE.textSoft,
  },
  facilitiesHeaderTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  breadcrumbLink: {
    border: "none",
    padding: 0,
    background: "transparent",
    color: "#a8c2e3",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  breadcrumbSep: {
    color: PALETTE.textMuted,
    fontSize: "14px",
  },
  breadcrumbCurrent: {
    color: PALETTE.textSoft,
    fontSize: "14px",
    fontWeight: 700,
  },
  facilitySelectorWrap: {
    marginTop: "16px",
  },
  facilityPillWrap: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  facilityPill: {
    border: `1px solid ${PALETTE.borderStrong}`,
    background: PALETTE.panelAlt,
    color: PALETTE.text,
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  facilityPillMeta: {
    fontSize: "11px",
    color: PALETTE.textMuted,
    fontWeight: 600,
  },
  metricsGrid: {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  },
  metricCard: {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
  },
  metricLabel: {
    fontSize: "11px",
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: PALETTE.textMuted,
    marginBottom: "10px",
    fontWeight: 800,
  },
  metricValue: {
    fontSize: "38px",
    lineHeight: 1,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    marginBottom: "12px",
    transition: "color 0.25s ease",
  },
  metricBarTrack: {
    background: "#132030",
    borderRadius: "999px",
    height: "5px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  metricBarFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.14s ease, background 0.2s ease",
  },
  metricDesc: {
    fontSize: "12px",
    color: PALETTE.textSoft,
    lineHeight: 1.5,
  },
  metricTarget: {
    marginTop: "8px",
    fontSize: "11px",
    color: PALETTE.textMuted,
  },
  breakdownList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  breakdownItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  breakdownTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  breakdownLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  breakdownBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  breakdownPercent: {
    fontSize: "22px",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },
  breakdownTrack: {
    background: "#132030",
    borderRadius: "999px",
    height: "7px",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.14s ease",
  },
  peopleList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  personRow: {
    width: "100%",
    textAlign: "left",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    borderRadius: "16px",
    padding: "15px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
  },
  personName: {
    fontSize: "15px",
    fontWeight: 800,
    color: PALETTE.text,
    marginBottom: "4px",
  },
  personMeta: {
    fontSize: "13px",
    color: PALETTE.textSoft,
  },
  personRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  personRoleBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  personRoleBadgeGm: {
    background: PALETTE.blueSoft,
    color: "#a8c2e3",
    border: `1px solid rgba(77, 121, 179, 0.28)`,
  },
  personRoleBadgeMgr: {
    background: PALETTE.indigoSoft,
    color: "#b7c4dd",
    border: `1px solid rgba(123, 143, 184, 0.28)`,
  },
  personChevron: {
    color: PALETTE.textMuted,
    fontSize: "18px",
    lineHeight: 1,
  },
  emptyState: {
    textAlign: "center",
    padding: "32px 0",
  },
  emptyStateIcon: {
    fontSize: "28px",
    marginBottom: "10px",
  },
  emptyStateTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: PALETTE.textSoft,
    marginBottom: "4px",
  },
  emptyStateText: {
    fontSize: "13px",
    color: PALETTE.textMuted,
  },
  personFileStack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  personFileTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: PALETTE.text,
  },
  personFileMeta: {
    fontSize: "13px",
    color: PALETTE.textSoft,
    marginTop: "4px",
  },
  personStatsRow: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    marginTop: "14px",
    flexWrap: "wrap",
  },
  personStatBlock: {
    textAlign: "center",
  },
  personStatValue: {
    fontSize: "24px",
    fontWeight: 800,
    lineHeight: 1,
  },
  personStatLabel: {
    marginTop: "4px",
    fontSize: "11px",
    color: PALETTE.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 800,
  },
  personStatDivider: {
    width: "1px",
    height: "34px",
    background: PALETTE.borderStrong,
  },
  personTabRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  personTabButton: {
    flex: 1,
    minWidth: "180px",
    borderRadius: "12px",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.panelAlt,
    color: PALETTE.textSoft,
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  personTabButtonActive: {
    background: PALETTE.blueSoft,
    color: "#d8e6f7",
    border: `1px solid rgba(77, 121, 179, 0.36)`,
  },
  emptyStateTight: {
    textAlign: "center",
    padding: "26px 0",
    fontSize: "14px",
    color: PALETTE.textSoft,
  },
};
