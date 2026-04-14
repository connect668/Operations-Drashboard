import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      setUser(user);

      const { data, error } = await supabase
        .from("Profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
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

  if (loading) return <div style={{ padding: "2rem" }}>Loading dashboard...</div>;

  if (!profile) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>No profile found</h1>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Welcome, {profile.name}</h1>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Role:</strong> {profile.role}</p>

      <div style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
        {profile.role === "manager" && (
          <>
            <h2>Manager Dashboard</h2>
            <p>Submit decision logs, ask policy questions, and review your own activity.</p>
          </>
        )}

        {profile.role === "gm" && (
          <>
            <h2>GM Dashboard</h2>
            <p>Review manager activity, ratings, and store-level trends.</p>
          </>
        )}

        {profile.role === "area_coach" && (
          <>
            <h2>Area Coach Dashboard</h2>
            <p>Compare stores, monitor GMs, and review higher-level trends.</p>
          </>
        )}

        {profile.role === "admin" && (
          <>
            <h2>Admin Dashboard</h2>
            <p>Manage users, roles, and company-wide settings.</p>
          </>
        )}
      </div>

      <button onClick={handleSignOut} style={{ marginTop: "2rem" }}>
        Sign Out
      </button>
    </div>
  );
}
