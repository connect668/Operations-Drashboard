import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data?.user;

    if (!user) {
      setMessage("Account created, but no user was returned.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: name,
      company: company || null,
      role: selectedRole,
    });

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    setMessage("Account created successfully. Please log in.");
    setLoading(false);
    router.push("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0f172a",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#111827",
          padding: "32px",
          borderRadius: "16px",
          border: "1px solid #1f2937",
          color: "white",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>Create Account</h1>
        <p style={{ marginBottom: "24px", color: "#9ca3af" }}>
          Set up your account to access the dashboard.
        </p>

        <form
          onSubmit={handleSignup}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "white",
            }}
          />

          <input
            type="text"
            placeholder="Company (optional for now)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "white",
            }}
          />

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: selectedRole ? "white" : "#9ca3af",
            }}
          >
            <option value="" disabled>Select your role</option>
            <option value="Manager">Manager</option>
            <option value="General Manager">General Manager</option>
            <option value="Area Coach">Area Coach</option>
            <option value="Area Manager">Area Manager</option>
          </select>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "white",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "white",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: "16px", color: "#fbbf24" }}>{message}</p>
        )}

        <p style={{ marginTop: "20px", color: "#9ca3af" }}>
          Already have an account?{" "}
          <Link href="/" style={{ color: "#60a5fa", textDecoration: "none" }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
