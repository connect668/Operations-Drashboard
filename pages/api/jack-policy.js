export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { situation, policy, refs } = req.body
  if (!policy) return res.status(400).json({ error: 'policy required' })

  // Fallback (no API key) — return static policy fields directly
  const staticFallback = () => res.status(200).json({
    play:          policy.action_steps || policy.policy_text || null,
    policyBehindIt:policy.summary || null,
    watchOuts:     policy.incorrect_examples || null,
    escalateIf:    policy.escalation_guidance || null,
    aiGenerated:   false,
  })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return staticFallback()

  const refList = refs?.map(r => `• ${r.file_name}${r.description ? ` — ${r.description}` : ''}`).join('\n') || 'None attached'

  const prompt = `You are Jack, an AI operational assistant built into Playbook. A team member needs help with a workplace situation. Answer ONLY using the policy provided. Do not invent information.

SITUATION: ${situation || '(no situation provided)'}

POLICY TITLE: ${policy.title}
${policy.policy_code ? `POLICY CODE: ${policy.policy_code}` : ''}
${policy.category    ? `CATEGORY: ${policy.category}` : ''}
${policy.summary     ? `\nSUMMARY:\n${policy.summary}` : ''}
${policy.policy_text ? `\nPOLICY CONTENT:\n${policy.policy_text}` : ''}
${policy.action_steps         ? `\nACTION STEPS:\n${policy.action_steps}` : ''}
${policy.incorrect_examples   ? `\nWHAT TO AVOID:\n${policy.incorrect_examples}` : ''}
${policy.escalation_guidance  ? `\nESCALATION GUIDANCE:\n${policy.escalation_guidance}` : ''}

REFERENCE DOCUMENTS:
${refList}

Respond with ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "play": "Clear numbered steps the employee should take right now, based on the policy",
  "policyBehindIt": "1-2 sentences explaining the policy rule that applies here",
  "watchOuts": "Key mistakes to avoid — or null if the policy doesn't specify",
  "escalateIf": "When to involve a manager or admin — or null if not specified"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 900,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return staticFallback()

    const data = await response.json()
    const raw  = data?.content?.[0]?.text || ''

    // Strip any markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return res.status(200).json({ ...parsed, aiGenerated: true })
    } catch {
      // JSON parse failed — return raw as play
      return res.status(200).json({
        play: raw,
        policyBehindIt: policy.summary || null,
        watchOuts:      policy.incorrect_examples || null,
        escalateIf:     policy.escalation_guidance || null,
        aiGenerated:    false,
      })
    }
  } catch (err) {
    console.error('jack-policy error:', err)
    return staticFallback()
  }
}
