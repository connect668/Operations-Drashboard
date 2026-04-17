import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import {
  TABS,
  ROLE_LEVELS,
  CATEGORIES,
  GM_METRIC_DEFS,
  AM_METRIC_DEFS,
  PALETTE,
  FALLBACK_CATEGORY_KEYWORDS,
} from "../utils/dashboardConstants";

import {
  getNextRole,
  formatDate,
  applyCompanyScope,
  getCategoryStyle,
  buildKeywordMapFromRows,
  detectCategory,
  animateMetrics,
  normalizeBreakdownRows,
} from "../utils/dashboardHelpers";

import {
  getMockBreakdown,
  getMockFacilityMetrics,
  loadGmDashboardMetrics,
  loadAmDashboardMetrics,
  loadAmTerritoryData,
} from "../utils/dashboardMockData";

import { styles } from "../utils/dashboardStyles";

import MetricCard from "../components/dashboard/MetricCard";
import CategoryBadge from "../components/dashboard/CategoryBadge";
import DecisionCard from "../components/dashboard/DecisionCard";
import CoachingCard from "../components/dashboard/CoachingCard";
import TerritoryTable from "../components/dashboard/TerritoryTable";

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
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [guidanceActiveId, setGuidanceActiveId] = useState(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [guidanceSubmittingId, setGuidanceSubmittingId] = useState(null);

  const [gmMetrics, setGmMetrics] = useState({ pr: 0, pas: 0, tpr: 0 });
  const [gmAnimatedMetrics, setGmAnimatedMetrics] = useState({ pr: 0, pas: 0, tpr: 0 });

  const [amMetrics, setAmMetrics] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [amAnimatedMetrics, setAmAnimatedMetrics] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [amTerritoryFacilities, setAmTerritoryFacilities] = useState([]);

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

  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityPeople, setFacilityPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDecisions, setPersonDecisions] = useState([]);
  const [personCoaching, setPersonCoaching] = useState([]);
  const [personFileTab, setPersonFileTab] = useState("decisions");

  const [facilityMetrics, setFacilityMetrics] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [animatedFacilityMetrics, setAnimatedFacilityMetrics] = useState({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
  const [facilityBreakdown, setFacilityBreakdown] = useState(getMockBreakdown(""));

  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [keywordMap, setKeywordMap] = useState(FALLBACK_CATEGORY_KEYWORDS);

  const currentRoleLevel = useMemo(() => ROLE_LEVELS[profile?.role] || 1, [profile]);
  const canViewLeadershipTabs = currentRoleLevel >= 2;
  const canViewFacilities = profile?.role === "Area Manager" || profile?.role === "Area Coach";
  const canRequestCoaching = profile?.role === "Manager";
  const isAreaManager = profile?.role === "Area Manager";
  const isGeneralManager = profile?.role === "General Manager";
  const hasDashboard = isGeneralManager || isAreaManager;
  const nextRole = getNextRole(profile?.role);

  const autoDetectedCategory = useMemo(
    () => detectCategory(decisionSituation, decisionAction, keywordMap),
    [decisionSituation, decisionAction, keywordMap]
  );

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

        if (prof?.role === "General Manager") {
          setActiveTab(TABS.dashboard);
          setDashboardLoading(true);
          try {
            const metrics = await loadGmDashboardMetrics(prof);
            setGmMetrics({ pr: metrics.pr, pas: metrics.pas, tpr: metrics.tpr });
          } catch (e) {
            console.error("GM metrics load error:", e);
          } finally {
            setDashboardLoading(false);
          }
        } else if (prof?.role === "Area Manager") {
          setActiveTab(TABS.dashboard);
          setDashboardLoading(true);
          try {
            const [metrics, territory] = await Promise.all([
              loadAmDashboardMetrics(prof),
              loadAmTerritoryData(prof),
            ]);
            setAmMetrics({
              pr: metrics.pr,
              pas: metrics.pas,
              tpr: metrics.tpr,
              ppd: metrics.ppd,
            });
            setAmTerritoryFacilities(territory);
          } catch (e) {
            console.error("AM metrics load error:", e);
          } finally {
            setDashboardLoading(false);
          }
        }
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
    return animateMetrics(facilityMetrics, setAnimatedFacilityMetrics);
  }, [facilityMetrics, selectedFacility]);

  useEffect(() => {
    if (!Object.values(gmMetrics).some((v) => v > 0)) {
      setGmAnimatedMetrics({ pr: 0, pas: 0, tpr: 0 });
      return;
    }
    return animateMetrics(gmMetrics, setGmAnimatedMetrics);
  }, [gmMetrics]);

  useEffect(() => {
    if (!Object.values(amMetrics).some((v) => v > 0)) {
      setAmAnimatedMetrics({ pr: 0, pas: 0, tpr: 0, ppd: 0 });
      return;
    }
    return animateMetrics(amMetrics, setAmAnimatedMetrics);
  }, [amMetrics]);

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
      const { error } = await supabase.from("policy_pull_logs").insert([
        {
          user_id: user.id,
          company: profile?.company || null,
          company_id: profile?.company_id || null,
          facility_number: profile?.facility_number || null,
          user_role: profile?.role || null,
          situation_text: policyText.trim(),
          category: detected.category || null,
          policy_query: policyText.trim(),
          policy_result_used: false,
        },
      ]);

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
    const finalCategory = categoryManuallySet ? decisionCategory : decisionCategory || detected.category;

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
      const { error } = await supabase.from("decision_logs").insert([
        {
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
        },
      ]);

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
      const { error } = await supabase.from("coaching_requests").insert([
        {
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
        },
      ]);

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
      let q = supabase
        .from("decision_logs")
        .select("*")
        .eq("visible_to_role", profile.role)
        .eq("is_read", false)
        .neq("user_id", user?.id || "")
        .order("created_at", { ascending: false });

      q = applyCompanyScope(q, profile);

      const { data, error } = await q;
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
      let q = supabase
        .from("coaching_requests")
        .select("*")
        .eq("visible_to_role", profile.role)
        .neq("user_id", user?.id || "")
        .or("guidance_given.is.null,guidance_given.eq.false")
        .order("created_at", { ascending: false });

      q = applyCompanyScope(q, profile);

      const { data, error } = await q;
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
      let q = supabase
        .from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("role", "Manager")
        .order("full_name", { ascending: true });

      q = applyCompanyScope(q, profile);

      const { data, error } = await q;
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
      const [{ data: decisions, error: de }, { data: coaching, error: ce }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", manager.id).order("created_at", { ascending: false }),
      ]);

      if (de) throw de;
      if (ce) throw ce;

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

      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId)
          .maybeSingle();
        mgr = data;
      }

      if (mgr) {
        setActiveTab(TABS.managers);
        await openManagerFile(mgr);
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
        resolution_type: "guidance_given",
        resolution_summary: guidanceText.trim(),
        resolved_at: now,
        resolved_by: user.id,
      }).eq("id", requestId);

      if (error) throw error;

      setGuidanceActiveId(null);
      setGuidanceText("");

      await fetchTeamCoachingRequests();

      let mgr = managers.find((m) => m.id === userId);
      if (!mgr) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, role, company, company_id, facility_number")
          .eq("id", userId)
          .maybeSingle();
        mgr = data;
      }

      if (mgr) {
        setActiveTab(TABS.managers);
        await openManagerFile(mgr);
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
        supabase.from("decision_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
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
      const { data: assigned, error } = await supabase
        .from("area_manager_facilities")
        .select("*")
        .eq("area_manager_id", user.id);

      if (error) throw error;

      if (assigned?.length) {
        setFacilities(assigned);
        return;
      }

      if (profile?.role === "Area Coach") {
        let q = supabase.from("facilities").select("*").order("facility_number", { ascending: true });
        q = applyCompanyScope(q, profile);
        const { data: fb, error: fe } = await q;
        if (fe) throw fe;
        setFacilities(fb || []);
        if (!fb?.length) setFacilitiesMessage("No facilities found for your account.");
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

    const scope = facility?.company_id ? { company_id: facility.company_id } : { company: facility.company };

    try {
      let pq = supabase
        .from("profiles")
        .select("id, full_name, role, company, company_id, facility_number")
        .eq("facility_number", facility.facility_number)
        .in("role", ["General Manager", "Manager"]);
      pq = applyCompanyScope(pq, scope);

      let mq = supabase
        .from("facility_metrics")
        .select("*")
        .eq("facility_number", facility.facility_number)
        .maybeSingle();
      mq = applyCompanyScope(mq, scope);

      let bq = supabase
        .from("facility_category_breakdown")
        .select("*")
        .eq("facility_number", facility.facility_number);
      bq = applyCompanyScope(bq, scope);

      const [{ data: people, error: pe }, { data: metrics, error: me }, { data: breakdown, error: be }] =
        await Promise.all([pq, mq, bq]);

      if (pe) throw pe;
      if (me) throw me;
      if (be) throw be;

      const sorted = (people || []).sort((a, b) => {
        const rank = { "General Manager": 0, Manager: 1 };
        const d = (rank[a.role] ?? 9) - (rank[b.role] ?? 9);
        return d !== 0 ? d : (a.full_name || "").localeCompare(b.full_name || "");
      });
      setFacilityPeople(sorted);

      setFacilityMetrics(
        metrics
          ? { pr: +metrics.pr_percent, pas: +metrics.pas_percent, tpr: +metrics.tpr_percent, ppd: +metrics.ppd_percent }
          : getMockFacilityMetrics(facility.facility_number)
      );

      setFacilityBreakdown(
        breakdown?.length
          ? normalizeBreakdownRows(breakdown, facility.facility_number)
          : getMockBreakdown(facility.facility_number)
      );

      if (!sorted.length) setFacilitiesMessage("No staff found in this facility.");
    } catch (err) {
      console.error("Fetch facility people error:", err);
      setFacilityMetrics(getMockFacilityMetrics(facility.facility_number));
      setFacilityBreakdown(getMockBreakdown(facility.facility_number));
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
      const [{ data: decisions, error: de }, { data: coaching, error: ce }] = await Promise.all([
        supabase.from("decision_logs").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
        supabase.from("coaching_requests").select("*").eq("user_id", person.id).order("created_at", { ascending: false }),
      ]);
      if (de) throw de;
      if (ce) throw ce;

      setPersonDecisions(decisions || []);
      setPersonCoaching(coaching || []);
    } catch (err) {
      console.error("Open person file error:", err);
    } finally {
      setPersonFileLoading(false);
    }
  };

  const enterDashboard = async () => {
    if (!profile) return;

    setDashboardLoading(true);

    try {
      if (isGeneralManager) {
        const metrics = await loadGmDashboardMetrics(profile);
        setGmMetrics({ pr: metrics.pr, pas: metrics.pas, tpr: metrics.tpr });
      } else if (isAreaManager) {
        const [metrics, territory] = await Promise.all([
          loadAmDashboardMetrics(profile),
          loadAmTerritoryData(profile),
        ]);
        setAmMetrics({ pr: metrics.pr, pas: metrics.pas, tpr: metrics.tpr, ppd: metrics.ppd });
        setAmTerritoryFacilities(territory);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const navItems = [
    { tab: TABS.dashboard, label: "Dashboard", show: hasDashboard, onEnter: enterDashboard },
    { tab: TABS.policy, label: "Request Policy", show: true },
    { tab: TABS.decision, label: "Document Decision", show: !isAreaManager },
    { tab: TABS.coaching, label: "Request Coaching", show: canRequestCoaching },
    { divider: true, show: canViewLeadershipTabs && !isAreaManager },
    { tab: TABS.teamDecisions, label: "Team Decisions", show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchTeamDecisions },
    { tab: TABS.teamCoaching, label: "Team Coaching", show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchTeamCoachingRequests },
    { tab: TABS.managers, label: "Managers", show: canViewLeadershipTabs && !isAreaManager, onEnter: fetchManagers },
    { divider: true, show: canViewFacilities },
    { tab: TABS.facilities, label: "Facilities", show: canViewFacilities, onEnter: fetchFacilities },
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
              from { opacity: 0; transform: translateY(7px); }
              to   { opacity: 1; transform: translateY(0);   }
            }
            .fade-up { animation: fadeUp 0.22s ease both; }
            .nav-tab:hover    { background: #0f1e2f !important; color: #e2eaf4 !important; }
            .person-row:hover { border-color: #2c3f55 !important; background: #0d1b2a !important; }
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

        {!isMobile && (
          <nav style={styles.topNavItems}>
            <button
              className="nav-tab"
              style={{ ...styles.topNavBtn, ...(activeTab === TABS.myLogs ? styles.topNavBtnActive : {}) }}
              onClick={() => {
                setActiveTab(TABS.myLogs);
                fetchMyLogs();
              }}
            >
              My Logs
            </button>
            <div style={styles.topNavDivider} />
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
                    item.onEnter?.();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

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
              <button style={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen((v) => !v)}>
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>
      </header>

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
                  item.onEnter?.();
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
      )}

      <main style={styles.main}>
        {activeTab === TABS.dashboard && isGeneralManager && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.dashHeaderRow}>
                <div>
                  <h1 style={styles.title}>Dashboard</h1>
                  <p style={styles.subtitle}>
                    Facility performance snapshot · Facility {profile?.facility_number || "—"} · {profile?.company || ""}
                  </p>
                </div>
                <span style={styles.roleBadge}>General Manager</span>
              </div>
            </div>

            {dashboardLoading ? (
              <div style={styles.panelCard}>
                <p style={styles.message}>Loading metrics...</p>
              </div>
            ) : (
              <div style={styles.metricsGrid} className="fade-up">
                {GM_METRIC_DEFS.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={gmAnimatedMetrics[metric.key] || 0} />
                ))}
              </div>
            )}

            <div style={styles.panelCard} className="fade-up">
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Performance Reference</div>
              </div>
              <div style={styles.thresholdGrid}>
                {GM_METRIC_DEFS.map((m) => (
                  <div key={m.key} style={styles.thresholdItem}>
                    <div style={styles.thresholdLabel}>{m.label}</div>
                    <div style={styles.thresholdValue}>Target ≥ {m.target}%</div>
                    <div style={styles.thresholdDesc}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === TABS.dashboard && isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.dashHeaderRow}>
                <div>
                  <h1 style={styles.title}>Dashboard</h1>
                  <p style={styles.subtitle}>
                    Area performance overview · All assigned facilities · {profile?.company || ""}
                  </p>
                </div>
                <span style={styles.roleBadge}>Area Manager</span>
              </div>
            </div>

            {dashboardLoading ? (
              <div style={styles.panelCard}>
                <p style={styles.message}>Loading metrics...</p>
              </div>
            ) : (
              <div style={styles.metricsGrid} className="fade-up">
                {AM_METRIC_DEFS.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={amAnimatedMetrics[metric.key] || 0} />
                ))}
              </div>
            )}

            {amTerritoryFacilities.length > 0 && (
              <div style={styles.panelCard} className="fade-up">
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Facility Breakdown</div>
                  <div style={styles.sectionHint}>All facilities · Mock territory data</div>
                </div>
                <TerritoryTable facilities={amTerritoryFacilities} />
              </div>
            )}

            <div style={styles.panelCard} className="fade-up">
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>PP/D Scoring Reference</div>
                <div style={styles.sectionHint}>Policy Pull / Documented Decision threshold</div>
              </div>
              <div style={styles.ppdLegendRow}>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.green }} />
                  <span style={styles.ppdLegendText}>Under 38% — On Target</span>
                </div>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.amber }} />
                  <span style={styles.ppdLegendText}>38–55% — Needs Attention</span>
                </div>
                <div style={styles.ppdLegendItem}>
                  <span style={{ ...styles.ppdLegendDot, background: PALETTE.red }} />
                  <span style={styles.ppdLegendText}>Over 55% — Alert</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === TABS.policy && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Policy</h1>
              <p style={styles.subtitle}>Describe the situation and log a policy pull before the response layer is added.</p>
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
              {policyMessage && <p style={styles.message}>{policyMessage}</p>}
            </div>
          </>
        )}

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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {autoDetectedCategory.category && !categoryManuallySet && (
                <div style={styles.autoDetectedText}>Auto-detected: {autoDetectedCategory.category}</div>
              )}
              <div style={styles.sectionDivider} />
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

        {activeTab === TABS.coaching && canRequestCoaching && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Request Coaching</h1>
              <p style={styles.subtitle}>Ask your General Manager for guidance and support.</p>
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

        {activeTab === TABS.myLogs && (
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
                {myLogType && (
                  <button style={styles.secondaryButton} onClick={() => setMyLogType(null)}>
                    ← Back
                  </button>
                )}
              </div>

              {myLogsLoading ? (
                <p style={styles.message}>Loading...</p>
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
                    myCoaching.map((item) => <CoachingCard key={item.id} item={item} formatDateFn={formatDate} />)
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === TABS.teamDecisions && canViewLeadershipTabs && !isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Team Decisions</h1>
              <p style={styles.subtitle}>Review decisions routed to your clearance level.</p>
            </div>
            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Decision Feed</div>
                <button style={styles.secondaryButton} onClick={fetchTeamDecisions}>
                  Refresh
                </button>
              </div>
              {teamDecisionsMessage && <p style={styles.message}>{teamDecisionsMessage}</p>}
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

        {activeTab === TABS.teamCoaching && canViewLeadershipTabs && !isAreaManager && (
          <>
            <div style={styles.headerCard}>
              <h1 style={styles.title}>Team Coaching Requests</h1>
              <p style={styles.subtitle}>Review and respond to coaching requests from your team.</p>
            </div>
            <div style={styles.panelCard}>
              <div style={styles.sectionTopRow}>
                <div style={styles.sectionHeading}>Coaching Queue</div>
                <button style={styles.secondaryButton} onClick={fetchTeamCoachingRequests}>
                  Refresh
                </button>
              </div>
              {teamCoachingMessage && <p style={styles.message}>{teamCoachingMessage}</p>}
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
                          <div style={styles.feedName}>{item.requester_name || "Unknown User"}</div>
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

                      {item.leadership_notes && (
                        <div style={styles.guidanceBlock}>
                          <div style={styles.guidanceLabel}>Leadership Notes</div>
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
              <p style={styles.subtitle}>Review managers and open their documentation history.</p>
            </div>
            <div style={{ ...styles.managersLayout, gridTemplateColumns: isMobile ? "1fr" : "300px 1fr" }}>
              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>Manager Directory</div>
                  <button style={styles.secondaryButton} onClick={fetchManagers}>
                    Refresh
                  </button>
                </div>
                {managersMessage && <p style={styles.message}>{managersMessage}</p>}
                {managersLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : managers.length === 0 ? (
                  <p style={styles.message}>No managers found.</p>
                ) : (
                  <div style={styles.cardList}>
                    {managers.map((mgr) => (
                      <button
                        key={mgr.id}
                        style={{
                          ...styles.managerRowButton,
                          ...(selectedManager?.id === mgr.id ? styles.managerRowButtonActive : {}),
                        }}
                        onClick={() => openManagerFile(mgr)}
                      >
                        <div style={styles.managerRowName}>{mgr.full_name || "Unnamed"}</div>
                        <div style={styles.managerRowMeta}>
                          {mgr.role}
                          {mgr.company ? ` · ${mgr.company}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.panelCard}>
                <div style={styles.sectionTopRow}>
                  <div style={styles.sectionHeading}>
                    {selectedManager ? `${selectedManager.full_name} — Decision Logs` : "Manager File"}
                  </div>
                </div>
                {!selectedManager ? (
                  <p style={styles.message}>Select a manager to view their decision logs.</p>
                ) : selectedManagerLoading ? (
                  <p style={styles.message}>Loading...</p>
                ) : selectedManagerDecisions.length === 0 ? (
                  <p style={styles.message}>No decision logs found.</p>
                ) : (
                  <div style={styles.cardList}>
                    {selectedManagerDecisions.map((item) => (
                      <DecisionCard
                        key={item.id}
                        item={item}
                        title={formatDate(item.created_at)}
                        meta={item.is_read ? "Read" : "Unread"}
                        formatDateFn={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === TABS.facilities && canViewFacilities && (
          <>
            <div style={styles.headerCard}>
              <div style={styles.facilitiesHeaderTop}>
                <div>
                  <h1 style={styles.title}>Facilities</h1>
                  <p style={styles.subtitle}>
                    {selectedPerson
                      ? `${selectedPerson.full_name} — ${selectedPerson.role}`
                      : selectedFacility
                      ? `Facility ${selectedFacility.facility_number} · ${selectedFacility.company || profile?.company || ""}`
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
                      setFacilityBreakdown(getMockBreakdown(""));
                    }}
                  >
                    ← All Facilities
                  </button>
                ) : null}
              </div>

              {(selectedFacility || selectedPerson) && (
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

                  {selectedFacility && (
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
                  )}

                  {selectedPerson && (
                    <>
                      <span style={styles.breadcrumbSep}>›</span>
                      <span style={styles.breadcrumbCurrent}>{selectedPerson.full_name}</span>
                    </>
                  )}
                </div>
              )}

              {!selectedFacility && (
                <div style={styles.facilitySelectorWrap}>
                  {facilitiesLoading ? (
                    <p style={styles.message}>Loading facilities...</p>
                  ) : facilities.length === 0 ? (
                    <p style={styles.message}>{facilitiesMessage || "No facilities found."}</p>
                  ) : (
                    <div style={styles.facilityPillWrap}>
                      {facilities.map((f) => (
                        <button
                          key={`${f.company || "co"}-${f.facility_number}`}
                          onClick={() => fetchFacilityPeople(f)}
                          style={styles.facilityPill}
                        >
                          Facility {f.facility_number}
                          <span style={styles.facilityPillMeta}>{f.company || profile?.company || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedFacility && !selectedPerson && (
              <>
                <div style={styles.metricsGrid} className="fade-up">
                  {AM_METRIC_DEFS.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} value={animatedFacilityMetrics[metric.key] || 0} />
                  ))}
                </div>

                <div style={styles.panelCard} className="fade-up">
                  <div style={styles.sectionTopRow}>
                    <div style={styles.sectionHeading}>Facility Category Mix</div>
                    <div style={styles.sectionHint}>Facility-level category distribution</div>
                  </div>
                  <div style={styles.breakdownList}>
                    {facilityBreakdown.map((item) => {
                      const st = getCategoryStyle(item.category);
                      return (
                        <div key={item.category} style={styles.breakdownItem}>
                          <div style={styles.breakdownTop}>
                            <div style={styles.breakdownLeft}>
                              <span
                                style={{
                                  ...styles.breakdownBadge,
                                  color: st.color,
                                  background: st.bg,
                                  border: `1px solid ${st.border}`,
                                }}
                              >
                                {item.category === "Operations" ? "Ops" : item.category}
                              </span>
                            </div>
                            <div style={{ ...styles.breakdownPercent, color: st.color }}>
                              {Math.round(item.category_percent)}%
                            </div>
                          </div>
                          <div style={styles.breakdownTrack}>
                            <div
                              style={{
                                ...styles.breakdownFill,
                                width: `${Math.max(0, Math.min(100, item.category_percent))}%`,
                                background: st.color,
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
                    <button style={styles.secondaryButton} onClick={() => fetchFacilityPeople(selectedFacility)}>
                      Refresh
                    </button>
                  </div>

                  {facilitiesMessage && <p style={styles.message}>{facilitiesMessage}</p>}

                  {facilityPeopleLoading ? (
                    <p style={styles.message}>Loading staff...</p>
                  ) : facilityPeople.length === 0 ? (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyStateIcon}>👥</div>
                      <div style={styles.emptyStateTitle}>No staff found</div>
                      <div style={styles.emptyStateText}>Make sure profiles have the correct facility_number set.</div>
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
                            <div style={styles.personName}>{person.full_name || "Unnamed"}</div>
                            <div style={styles.personMeta}>{person.role} · Facility {person.facility_number}</div>
                          </div>
                          <div style={styles.personRight}>
                            <span
                              style={{
                                ...styles.personRoleBadge,
                                ...(person.role === "General Manager" ? styles.personRoleBadgeGm : styles.personRoleBadgeMgr),
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
            )}

            {selectedPerson && (
              <div style={styles.personFileStack} className="fade-up">
                <div style={styles.panelCard}>
                  <div style={styles.personFileTitle}>{selectedPerson.full_name}</div>
                  <div style={styles.personFileMeta}>
                    {selectedPerson.role} · {selectedPerson.company || profile?.company || ""} · Facility {selectedPerson.facility_number}
                  </div>
                  <div style={styles.personStatsRow}>
                    <div style={styles.personStatBlock}>
                      <div style={{ ...styles.personStatValue, color: PALETTE.blue }}>{personDecisions.length}</div>
                      <div style={styles.personStatLabel}>Decisions</div>
                    </div>
                  </div>
                </div>

                {personFileLoading ? (
                  <div style={styles.panelCard}>
                    <p style={styles.message}>Loading logs...</p>
                  </div>
                ) : (
                  <div style={styles.panelCard}>
                    <div style={styles.sectionTopRow}>
                      <div style={styles.sectionHeading}>Decision Logs</div>
                    </div>
                    {personDecisions.length === 0 ? (
                      <div style={styles.emptyStateTight}>No decision logs on record.</div>
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
