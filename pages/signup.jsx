import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CreateAccount() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e) {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      setMessage("User was created, but no user data came back.");
      return;
    }

    const { error: profileError } = await supabase.from("Profiles").insert([
      {
        id: user.id,
        email: user.email,
        name,
        role,
      },
    ]);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    setMessage("Account created successfully.");
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Create Account</h1>

      <form onSubmit={handleSignup} style={{ display: "grid", gap: "1rem", maxWidth: "400px" }}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <select value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="manager">Manager</option>
          <option value="gm">GM</option>
          <option value="area_coach">Area Coach</option>
          <option value="admin">Admin</option>
        </select>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Create Account</button>
      </form>

      {message && <p style={{ marginTop: "1rem" }}>{message}</p>}
    </div>
  );
}
