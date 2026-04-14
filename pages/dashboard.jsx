import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

function renderDashboardByRole(role) {
  switch (role) {
    case "pending":
      return (
        <div>
          <h2>Pending Access</h2>
          <p>Your account is waiting for approval.</p>
        </div>
      );

    case "manager":
      return (
        <div>
          <h2>Manager Dashboard</h2>
          <p>Manager tools go here.</p>
        </div>
      );

    case "gm":
      return (
        <div>
          <h2>GM Dashboard</h2>
          <p>GM tools go here.</p>
        </div>
      );

    case "area_coach":
      return (
        <div>
          <h2>Area Coach Dashboard</h2>
          <p>Area coach tools go here.</p>
        </div>
      );

    case "admin":
      return (
        <div>
          <h2>Admin Dashboard</h2>
          <p>Admin tools go here.</p>
        </div>
      );

    default:
      return (
        <div>
          <h2>Unknown Role</h2>
          <p>This account has role: {role || "none"}</p>
        </div>
      );
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage("No profile row exists for this user yet.");
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

  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;

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
      <h1>Welcome, {profile.full_name}</h1>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Role from DB:</strong> {profile.role}</p>
      <p><strong>Company:</strong> {profile.company || "Not assigned yet"}</p>

      <div style={{ marginTop: "2rem" }}>
        {renderDashboardByRole(profile.role)}
      </div>

      <button onClick={handleSignOut} style={{ marginTop: "2rem" }}>
        Sign Out
      </button>
    </div>
  );
}
