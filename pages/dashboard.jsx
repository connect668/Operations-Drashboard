import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [situation, setSituation] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) {
        setMessage("Could not load profile.");
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleSubmitLog(e) {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    const { error } = await supabase.from("decision_logs").insert([
      {
        user_id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        company: profile.company || null,
        situation,
        action_taken: actionTaken,
      },
    ]);

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSituation("");
    setActionTaken("");
    setMessage("Decision log submitted successfully.");
    setSubmitting(false);
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!profile) return <div style={{ padding: "2rem" }}>No profile found.</div>;

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Welcome, {profile.full_name}</h1>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Role:</strong> {profile.role}</p>
      <p><strong>Company:</strong> {profile.company || "Not assigned yet"}</p>

      {profile.role === "pending" && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Pending Access</h2>
          <p>Your account is waiting for approval.</p>
        </div>
      )}

      {(profile.role === "manager" || profile.role === "admin") && (
        <div style={{ marginTop: "2rem", maxWidth: "700px" }}>
          <h2>Submit Decision Log</h2>
          <form onSubmit={handleSubmitLog} style={{ display: "grid", gap: "12px" }}>
            <textarea
              placeholder="Situation"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              required
              rows={5}
              style={{ padding: "12px" }}
            />

            <textarea
              placeholder="Action Taken"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              required
              rows={5}
              style={{ padding: "12px" }}
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Log"}
            </button>
          </form>
        </div>
      )}

      {profile.role === "gm" && (
        <div style={{ marginTop: "2rem" }}>
          <h2>GM Dashboard</h2>
          <p>GM tools go here later.</p>
        </div>
      )}

      {profile.role === "area_coach" && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Area Coach Dashboard</h2>
          <p>Area coach tools go here later.</p>
        </div>
      )}

      {message && <p style={{ marginTop: "1rem" }}>{message}</p>}

      <button onClick={handleSignOut} style={{ marginTop: "2rem" }}>
        Sign Out
      </button>
    </div>
  );
}
