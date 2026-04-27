import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(200).json({ ok: false, error: "Unauthorized" });

  let user, profile;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user: u }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !u) return res.status(200).json({ ok: false, error: "Invalid session" });
    user = u;

    const { data: prof } = await supabase
      .from("profiles")
      .select("id,company_id,facility_number")
      .eq("id", user.id)
      .maybeSingle();
    profile = prof || {};
  } catch (err) {
    console.error("jack-feedback auth error:", err);
    return res.status(200).json({ ok: false, error: "Auth failed" });
  }

  const { searchId, helpful, comment } = req.body || {};
  if (searchId === undefined && helpful === undefined) {
    return res.status(200).json({ ok: false, error: "searchId and helpful are required" });
  }

  // ── Upsert feedback ───────────────────────────────────────────────────────
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeUuid = v => UUID_RE.test(v) ? v : null;

    await supabase.from("jack_feedback").upsert({
      search_id:       searchId || null,
      user_id:         user.id,
      company_id:      safeUuid(profile.company_id),
      facility_number: profile.facility_number || null,
      helpful:         typeof helpful === "boolean" ? helpful : null,
      comment:         comment ? String(comment).trim() : null,
    }, { onConflict: "search_id,user_id" });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.warn("jack-feedback upsert error:", err.message);
    return res.status(200).json({ ok: false, error: "Failed to save feedback" });
  }
}
