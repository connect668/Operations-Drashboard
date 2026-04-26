export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      reply: "Jack isn't configured yet — ask your administrator to add the ANTHROPIC_API_KEY environment variable."
    })
  }

  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        system: `You are Jack, an AI operational assistant built into Playbook by OSS. You help managers and team leaders handle real workplace situations — call-offs, customer disputes, policy questions, employee performance, safety incidents, and more. Be direct, practical, and brief. Give the manager a clear course of action. Avoid unnecessary disclaimers.`,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(200).json({ reply: "I'm having trouble connecting right now. Please try again in a moment." })
    }

    const data = await response.json()
    const reply = data?.content?.[0]?.text || "I couldn't generate a response. Please try rephrasing."
    return res.status(200).json({ reply })
  } catch (err) {
    console.error('Jack handler error:', err)
    return res.status(200).json({ reply: "Something went wrong on my end. Please try again." })
  }
}
