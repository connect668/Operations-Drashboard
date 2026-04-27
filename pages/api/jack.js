/**
 * /api/jack  — Jack AI assistant (server-only)
 *
 * Uses @anthropic-ai/sdk — ANTHROPIC_API_KEY is never sent to the browser.
 * Auth: Bearer token from Supabase session header.
 * RAG:  ilike policy search on company_policies, word-by-word fallback.
 * Logs: every question + answer saved to jack_searches.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// ── Anthropic client (server-side singleton) ──────────────────────────────────
// SDK reads ANTHROPIC_API_KEY from env automatically if apiKey is omitted,
// but we pass it explicitly so a missing key gives a clear startup error.
let anthropic = null;
function getAnthropic() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = (v) => (UUID_RE.test(v) ? v : null);

function scopedQuery(q, profile) {
  const cid = safeUuid(profile.company_id);
  if (cid) return q.eq("company_id", cid);
  if (profile.company) return q.eq("company", profile.company);
  return q;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(200).json({ error: "Unauthorized", noPolicy: true });
  }

  let user, profile;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user: u },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !u) {
      return res.status(200).json({ error: "Invalid session", noPolicy: true });
    }
    user = u;

    const { data: prof } = await supabase
      .from("profiles")
      .select("id,company_id,facility_number,role,company")
      .eq("id", user.id)
      .maybeSingle();
    profile = prof || {};
  } catch (err) {
    console.error("[jack] auth error:", err);
    return res.status(200).json({ error: "Auth failed", noPolicy: true });
  }

  // ── 2. Validate body ─────────────────────────────────────────────────────────
  const { question, companyContext } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(200).json({ error: "question is required", noPolicy: true });
  }
  const q = question.trim().slice(0, 1000);

  // ── 3. Policy RAG search ─────────────────────────────────────────────────────
  let policies = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const baseSelect = () =>
      scopedQuery(
        supabase
          .from("company_policies")
          .select(
            "id,title,category,summary,policy_text,keywords,action_steps,escalation_guidance"
          )
          .eq("is_active", true),
        profile
      );

    // Primary: full-phrase ilike across key columns
    const { data: primary } = await baseSelect()
      .or(
        `title.ilike.%${q}%,keywords.ilike.%${q}%,summary.ilike.%${q}%,` +
          `policy_text.ilike.%${q}%,category.ilike.%${q}%`
      )
      .limit(4);
    policies = primary || [];

    // Fallback: word-by-word (skip short filler words)
    if (!policies.length) {
      const words = q
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 6);
      for (const word of words) {
        const { data: wr } = await baseSelect()
          .or(
            `title.ilike.%${word}%,keywords.ilike.%${word}%,` +
              `summary.ilike.%${word}%,category.ilike.%${word}%`
          )
          .limit(4);
        if (wr?.length) {
          policies = wr;
          break;
        }
      }
    }
  } catch (err) {
    console.warn("[jack] policy search error:", err.message);
    // Non-fatal — carry on without policy context
  }

  // ── 4. Build system prompt ───────────────────────────────────────────────────
  const policyBlock = policies.length
    ? policies
        .map(
          (p, i) =>
            `POLICY ${i + 1}: ${p.title} [${p.category}]\n` +
            `Summary: ${p.summary || "N/A"}\n` +
            `Text: ${p.policy_text || "N/A"}\n` +
            `Action Steps: ${p.action_steps || "N/A"}\n` +
            `Escalation: ${p.escalation_guidance || "N/A"}`
        )
        .join("\n\n---\n\n")
    : "No matching policies found in the company's policy library.";

  // companyContext is optional — passed from dashboard when available
  const contextLine =
    companyContext && typeof companyContext === "string"
      ? `\nCOMPANY CONTEXT: ${companyContext.slice(0, 300)}\n`
      : "";

  const systemPrompt = `You are Jack, an AI operational assistant built into Playbook — a policy and procedure platform for quick-service restaurants, retail, and similar operations. You help managers handle real workplace situations using their company's policy library.
${contextLine}
COMPANY POLICIES:
${policyBlock}

INSTRUCTIONS:
- Answer ONLY from the provided policies. Do not invent rules or procedures.
- If no policy covers the situation, say so clearly and advise escalation.
- Be direct and practical. Write for a manager who needs to act in the next few minutes.
- Keep answers concise and mobile-friendly (short paragraphs, numbered steps).

Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation outside the JSON. Use these exact keys:
{
  "category": "The policy category (e.g. Attendance, Customer Service, Food Safety, Cash Handling)",
  "thePlay": "Numbered step-by-step action plan. Use \\n between steps (e.g. '1. Do this\\n2. Do that')",
  "policyContext": "1-2 sentence plain-language summary of the relevant policy, or null",
  "watchOuts": "Key mistakes to avoid, or null if none specified",
  "escalateIf": "Specific conditions requiring escalation to a higher manager, or null",
  "noPolicy": true if there is genuinely no matching policy for this situation, otherwise false
}`;

  // ── 5. Call Claude via SDK ───────────────────────────────────────────────────
  let aiResult = null;
  const client = getAnthropic();

  if (client) {
    try {
      const message = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: "user", content: q }],
      });

      const raw = message.content?.[0]?.text || "";

      // Strip accidental markdown fences
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      try {
        aiResult = JSON.parse(cleaned);
      } catch {
        // Try extracting a JSON object from the text
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            aiResult = JSON.parse(match[0]);
          } catch {
            console.warn("[jack] JSON parse failed after extraction");
          }
        }
      }
    } catch (err) {
      // Anthropic SDK throws typed errors — log but don't crash
      const type = err?.status ? `HTTP ${err.status}` : err?.constructor?.name;
      console.warn("[jack] Anthropic SDK error:", type, err?.message);
    }
  }

  // ── 6. Static fallback if AI unavailable or failed ───────────────────────────
  if (!aiResult) {
    const first = policies[0];
    aiResult = {
      category: first?.category || "General",
      thePlay:
        first?.action_steps ||
        "Please consult your manager for guidance on this situation.",
      policyContext: first?.summary || null,
      watchOuts: null,
      escalateIf: first?.escalation_guidance || null,
      noPolicy: !first,
    };
  }

  // ── 7. Normalise response ─────────────────────────────────────────────────────
  const result = {
    category: String(aiResult.category || "General"),
    thePlay: String(aiResult.thePlay || "Consult your manager."),
    policyContext: aiResult.policyContext ? String(aiResult.policyContext) : null,
    watchOuts: aiResult.watchOuts ? String(aiResult.watchOuts) : null,
    escalateIf: aiResult.escalateIf ? String(aiResult.escalateIf) : null,
    noPolicy: !!aiResult.noPolicy,
    searchId: null,
    aiGenerated: !!client && !!aiResult,
  };

  // ── 8. Log search ─────────────────────────────────────────────────────────────
  result.searchId = await logSearch(token, user, profile, question, result);

  return res.status(200).json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
async function logSearch(token, user, profile, question, result) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data } = await supabase
      .from("jack_searches")
      .insert({
        user_id: user.id,
        company_id: safeUuid(profile.company_id),
        company: profile.company || null,
        facility_number: profile.facility_number || null,
        user_role: profile.role || null,
        question: question,
        answer: result.thePlay || null,
        category: result.category || null,
      })
      .select("id")
      .single();

    return data?.id || null;
  } catch (err) {
    console.warn("[jack] log search error:", err.message);
    return null;
  }
}
