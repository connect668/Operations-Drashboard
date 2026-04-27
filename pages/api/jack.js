import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(200).json({ error: "Unauthorized", noPolicy: true });

  let user, profile;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user: u }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !u) return res.status(200).json({ error: "Invalid session", noPolicy: true });
    user = u;

    const { data: prof } = await supabase
      .from("profiles")
      .select("id,company_id,facility_number,role,company")
      .eq("id", user.id)
      .maybeSingle();
    profile = prof || {};
  } catch (err) {
    console.error("jack auth error:", err);
    return res.status(200).json({ error: "Auth failed", noPolicy: true });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(200).json({ error: "question is required", noPolicy: true });
  }

  // ── Policy search ─────────────────────────────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeUuid = v => UUID_RE.test(v) ? v : null;

  function applyScope(q) {
    const cid = safeUuid(profile.company_id);
    if (cid) return q.eq("company_id", cid);
    if (profile.company) return q.eq("company", profile.company);
    return q;
  }

  let policies = [];
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const q = question.trim();
    let pq = supabaseAdmin.from("company_policies")
      .select("id,title,category,summary,policy_text,keywords,action_steps,escalation_guidance")
      .eq("is_active", true);
    pq = applyScope(pq);
    pq = pq.or(
      `title.ilike.%${q}%,keywords.ilike.%${q}%,summary.ilike.%${q}%,policy_text.ilike.%${q}%,category.ilike.%${q}%`
    );
    const { data: primary } = await pq.limit(4);
    policies = primary || [];

    // Word-by-word fallback
    if (!policies.length) {
      const words = q.split(/\s+/).filter(w => w.length > 3).slice(0, 6);
      for (const word of words) {
        let wq = supabaseAdmin.from("company_policies")
          .select("id,title,category,summary,policy_text,keywords,action_steps,escalation_guidance")
          .eq("is_active", true);
        wq = applyScope(wq);
        wq = wq.or(
          `title.ilike.%${word}%,keywords.ilike.%${word}%,summary.ilike.%${word}%,category.ilike.%${word}%`
        );
        const { data: wr } = await wq.limit(4);
        if (wr?.length) { policies = wr; break; }
      }
    }
  } catch (err) {
    console.warn("jack policy search error:", err.message);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── Static fallback (no API key) ─────────────────────────────────────────
  if (!apiKey) {
    const first = policies[0];
    const fallback = {
      category:      first?.category || "General",
      thePlay:       first?.action_steps || first?.policy_text || "Please consult your manager for guidance on this situation.",
      policyContext: first?.summary || null,
      watchOuts:     null,
      escalateIf:    first?.escalation_guidance || null,
      noPolicy:      !first,
      searchId:      null,
    };
    await logSearch(token, user, profile, question, fallback);
    return res.status(200).json(fallback);
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const policyContext = policies.length
    ? policies.map((p, i) =>
        `POLICY ${i + 1}: ${p.title} [${p.category}]\nSummary: ${p.summary || "N/A"}\nText: ${p.policy_text || "N/A"}\nAction Steps: ${p.action_steps || "N/A"}\nEscalation: ${p.escalation_guidance || "N/A"}`
      ).join("\n\n---\n\n")
    : "No matching policies found in the company's policy library.";

  const systemPrompt = `You are Jack, an AI operational assistant for a quick-service or retail company. You help managers handle real workplace situations using their company's policy library.

COMPANY POLICIES:
${policyContext}

Respond ONLY with a valid JSON object (no markdown, no code fences) with these exact keys:
- category: the policy category (e.g. "Attendance", "Customer Service", "Food Safety", "Cash Handling", etc.)
- thePlay: a numbered list of concrete steps to handle this situation (use \\n between steps, e.g. "1. Do this\\n2. Do that")
- policyContext: 1-2 sentence plain-language summary of the relevant policy, or null
- watchOuts: common mistakes to avoid, or null
- escalateIf: specific conditions that require escalation to a higher manager, or null
- noPolicy: true ONLY if there is genuinely no matching policy for this situation, otherwise false

Be direct and practical. Write for a manager who needs to act in the next few minutes.`;

  // ── Call Anthropic ────────────────────────────────────────────────────────
  let aiResult = null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const raw = data?.content?.[0]?.text || "";
      try {
        aiResult = JSON.parse(raw);
      } catch {
        // Try extracting JSON from the text
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try { aiResult = JSON.parse(match[0]); } catch {}
        }
      }
    } else {
      console.warn("Anthropic non-OK:", response.status);
    }
  } catch (err) {
    console.warn("Anthropic fetch error:", err.message);
  }

  // ── Fallback if AI failed ─────────────────────────────────────────────────
  if (!aiResult) {
    const first = policies[0];
    aiResult = {
      category:      first?.category || "General",
      thePlay:       first?.action_steps || "Please consult your manager for guidance on this situation.",
      policyContext: first?.summary || null,
      watchOuts:     null,
      escalateIf:    first?.escalation_guidance || null,
      noPolicy:      !first,
    };
  }

  // Ensure required fields exist
  const result = {
    category:      aiResult.category || "General",
    thePlay:       aiResult.thePlay || "Consult your manager.",
    policyContext: aiResult.policyContext || null,
    watchOuts:     aiResult.watchOuts || null,
    escalateIf:    aiResult.escalateIf || null,
    noPolicy:      !!aiResult.noPolicy,
    searchId:      null,
  };

  // ── Log search ────────────────────────────────────────────────────────────
  result.searchId = await logSearch(token, user, profile, question, result);

  return res.status(200).json(result);
}

async function logSearch(token, user, profile, question, result) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeUuid = v => UUID_RE.test(v) ? v : null;
    const { data } = await supabase.from("jack_searches").insert({
      user_id:         user.id,
      company_id:      safeUuid(profile.company_id),
      company:         profile.company || null,
      facility_number: profile.facility_number || null,
      user_role:       profile.role || null,
      question:        question,
      answer:          result.thePlay || null,
      category:        result.category || null,
    }).select("id").single();
    return data?.id || null;
  } catch (err) {
    console.warn("jack log search error:", err.message);
    return null;
  }
}
