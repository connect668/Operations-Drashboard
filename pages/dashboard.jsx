import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import CategoryBadge from "./CategoryBadge";
import CoachingCard from "./CoachingCard";
import DecisionCard from "./DecisionCard";
import MetricCard from "./MetricCard";
import TerritoryTable from "./TerritoryTable";

import {
  ROLES,
  METRIC_LABELS,
  CATEGORY_COLORS,
} from "../utils/dashboardConstants";

import {
  getMetricColor,
  getMetricStatus,
  formatPercent,
  formatDateTime,
} from "../utils/dashboardHelpers";

import mockData from "../utils/dashboardMockData";
import styles from "../utils/dashboardStyles";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [decisionLogs, setDecisionLogs] = useState([]);
  const [coachingRequests, setCoachingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [decisionText, setDecisionText] = useState("");
  const [policyReferenced, setPolicyReferenced] = useState("");
  const [category, setCategory] = useState("Operations");

  const [coachingText, setCoachingText] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const { data: decisionData } = await supabase
          .from("decision_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: coachingData } = await supabase
          .from("coaching_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (!mounted) return;

        setProfile(profileData || null);
        setDecisionLogs(decisionData || []);
        setCoachingRequests(coachingData || []);
      } catch (err) {
        console.error("Load error:", err);
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
    return mockData.metrics;
  }, []);

  async function handleDecisionSubmit(e) {
    e.preventDefault();
    if (!decisionText.trim()) return;

    try {
      setSubmitLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const payload = {
        user_id: user.id,
        decision_text: decisionText,
        category,
        policy_referenced: policyReferenced || null,
      };

      const { error } = await supabase
        .from("decision_logs")
        .insert([payload]);

      if (error) throw error;

      setDecisionLogs((prev) => [
        { ...payload, id: Date.now(), created_at: new Date() },
        ...prev,
      ]);

      setDecisionText("");
      setPolicyReferenced("");
      setCategory("Operations");
    } catch (err) {
      console.error("Decision error:", err);
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
      } = await supabase.auth.getUser();

      if (!user) return;

      const payload = {
        user_id: user.id,
        request_text: coachingText,
      };

      const { error } = await supabase
        .from("coaching_requests")
        .insert([payload]);

      if (error) throw error;

      setCoachingRequests((prev) => [
        { ...payload, id: Date.now(), created_at: new Date() },
        ...prev,
      ]);

      setCoachingText("");
    } catch (err) {
      console.error("Coaching error:", err);
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>
        {profile?.full_name || "Manager"} Dashboard
      </h1>

      {/* Metrics */}
      <div style={styles.metricGrid}>
        {Object.entries(metrics).map(([key, value]) => (
          <MetricCard
            key={key}
            label={METRIC_LABELS[key] || key}
            value={value}
            color={getMetricColor(value)}
            status={getMetricStatus(value)}
          />
        ))}
      </div>

      {/* Decision Form */}
      <form onSubmit={handleDecisionSubmit} style={styles.card}>
        <h3>Document Decision</h3>

        <textarea
          placeholder="Describe your decision..."
          value={decisionText}
          onChange={(e) => setDecisionText(e.target.value)}
          style={styles.textarea}
        />

        <input
          placeholder="Policy reference (optional)"
          value={policyReferenced}
          onChange={(e) => setPolicyReferenced(e.target.value)}
          style={styles.input}
        />

        <button disabled={submitLoading} style={styles.button}>
          Submit Decision
        </button>
      </form>

      {/* Coaching Form */}
      <form onSubmit={handleCoachingSubmit} style={styles.card}>
        <h3>Request Coaching</h3>

        <textarea
          placeholder="Describe situation..."
          value={coachingText}
          onChange={(e) => setCoachingText(e.target.value)}
          style={styles.textarea}
        />

        <button disabled={submitLoading} style={styles.button}>
          Request Coaching
        </button>
      </form>

      {/* Decision Logs */}
      <div style={styles.card}>
        <h3>Recent Decisions</h3>
        {decisionLogs.map((log) => (
          <DecisionCard key={log.id} log={log} />
        ))}
      </div>

      {/* Coaching Logs */}
      <div style={styles.card}>
        <h3>Recent Coaching Requests</h3>
        {coachingRequests.map((req) => (
          <CoachingCard key={req.id} request={req} />
        ))}
      </div>
    </div>
  );
}
