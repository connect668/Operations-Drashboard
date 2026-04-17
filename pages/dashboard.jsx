import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import MetricCard from "../components/MetricCard";
import DecisionCard from "../components/DecisionCard";
import CoachingCard from "../components/CoachingCard";

import * as constants from "../utils/dashboardConstants";
import * as helpers from "../utils/dashboardHelpers";
import * as mockData from "../utils/dashboardMockData";
import * as styles from "../utils/dashboardStyles";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [decisionLogs, setDecisionLogs] = useState([]);
  const [coachingRequests, setCoachingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [decisionText, setDecisionText] = useState("");
  const [policyReferenced, setPolicyReferenced] = useState("");
  const [category, setCategory] = useState("Operations");
  const [coachingText, setCoachingText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile load error:", profileError);
        }

        const { data: decisionData, error: decisionError } = await supabase
          .from("decision_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (decisionError) {
          console.error("Decision log load error:", decisionError);
        }

        const { data: coachingData, error: coachingError } = await supabase
          .from("coaching_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (coachingError) {
          console.error("Coaching load error:", coachingError);
        }

        if (!mounted) return;

        setProfile(profileData || null);
        setDecisionLogs(Array.isArray(decisionData) ? decisionData : []);
        setCoachingRequests(Array.isArray(coachingData) ? coachingData : []);
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (mockData?.metrics && typeof mockData.metrics === "object") {
      return mockData.metrics;
    }

    if (mockData?.default?.metrics && typeof mockData.default.metrics === "object") {
      return mockData.default.metrics;
    }

    if (mockData?.dashboardMockData?.metrics && typeof mockData.dashboardMockData.metrics === "object") {
      return mockData.dashboardMockData.metrics;
    }

    return {};
  }, []);

  async function handleDecisionSubmit(e) {
    e.preventDefault();

    if (!decisionText.trim()) return;

    try {
      setSubmitLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("No logged in user found.");

      const payload = {
        user_id: user.id,
        decision_text: decisionText.trim(),
        category: category || "Operations",
        policy_referenced: policyReferenced.trim() || null,
      };

      const { data, error } = await supabase
        .from("decision_logs")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setDecisionLogs((prev) => [data || { ...payload, id: Date.now(), created_at: new Date().toISOString() }, ...prev].slice(0, 10));
      setDecisionText("");
      setPolicyReferenced("");
      setCategory("Operations");
    } catch (error) {
      console.error("Decision submit error:", error);
      alert("Failed to save decision log.");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleCoachingSubmit(e) {
    e.preventDefault();

    if (!coachingText.trim()) return;

    try {
      setSubmitLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("No logged in user found.");

      const payload = {
        user_id: user.id,
        request_text: coachingText.trim(),
      };

      const { data, error } = await supabase
        .from("coaching_requests")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setCoachingRequests((prev) => [data || { ...payload, id: Date.now(), created_at: new Date().toISOString() }, ...prev].slice(0, 10));
      setCoachingText("");
    } catch (error) {
      console.error("Coaching submit error:", error);
      alert("Failed to save coaching request.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const containerStyle = styles?.container || {};
  const headerStyle = styles?.header || {};
  const metricGridStyle = styles?.metricGrid || {};
  const cardStyle = styles?.card || {};
  const textareaStyle = styles?.textarea || {};
  const inputStyle = styles?.input || {};
  const buttonStyle = styles?.button || {};
  const loadingStyle = styles?.loading || {};

  if (loading) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>
        {profile?.full_name || "Manager"} Dashboard
      </h1>

      <div style={{ marginBottom: "16px" }}>
        <strong>Role:</strong> {profile?.role || "No role assigned"}
        <br />
        <strong>Company:</strong> {profile?.company || "No company assigned"}
      </div>

      <div style={metricGridStyle}>
        {Object.entries(metrics).map(([key, value]) => (
          <MetricCard
            key={key}
            metricKey={key}
            label={constants?.METRIC_LABELS?.[key] || key}
            value={value}
            color={helpers?.getMetricColor?.(value) || "gray"}
            status={helpers?.getMetricStatus?.(value) || "neutral"}
            formatPercent={helpers?.formatPercent}
          />
        ))}
      </div>

      <form onSubmit={handleDecisionSubmit} style={cardStyle}>
        <h3>Document Decision</h3>

        <textarea
          placeholder="Describe your decision..."
          value={decisionText}
          onChange={(e) => setDecisionText(e.target.value)}
          style={textareaStyle}
        />

        <input
          placeholder="Policy reference (optional)"
          value={policyReferenced}
          onChange={(e) => setPolicyReferenced(e.target.value)}
          style={inputStyle}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        >
          <option value="Operations">Operations</option>
          <option value="HR">HR</option>
          <option value="Food Safety">Food Safety</option>
        </select>

        <button type="submit" disabled={submitLoading} style={buttonStyle}>
          {submitLoading ? "Saving..." : "Submit Decision"}
        </button>
      </form>

      <form onSubmit={handleCoachingSubmit} style={cardStyle}>
        <h3>Request Coaching</h3>

        <textarea
          placeholder="Describe the situation..."
          value={coachingText}
          onChange={(e) => setCoachingText(e.target.value)}
          style={textareaStyle}
        />

        <button type="submit" disabled={submitLoading} style={buttonStyle}>
          {submitLoading ? "Saving..." : "Request Coaching"}
        </button>
      </form>

      <div style={cardStyle}>
        <h3>Recent Decisions</h3>
        {decisionLogs.length === 0 ? (
          <p>No decisions logged yet.</p>
        ) : (
          decisionLogs.map((log) => (
            <DecisionCard key={log.id || log.created_at} log={log} />
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h3>Recent Coaching Requests</h3>
        {coachingRequests.length === 0 ? (
          <p>No coaching requests yet.</p>
        ) : (
          coachingRequests.map((request) => (
            <CoachingCard
              key={request.id || request.created_at}
              request={request}
            />
          ))
        )}
      </div>
    </div>
  );
}
