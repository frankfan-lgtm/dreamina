import { buildSystemPrompt, buildTickPrompt } from '../utils/prompt'

export async function simulateTick(apiKey, template, npcs, tick, pendingIntervention) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildTickPrompt(template, npcs, tick, pendingIntervention)

  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  return parseResponse(text)
}

function parseResponse(text) {
  // Strip potential markdown code fences
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const result = JSON.parse(cleaned)
    // Validate structure
    if (!result.npcs || !Array.isArray(result.npcs)) {
      throw new Error('Missing npcs array')
    }
    return result
  } catch (e) {
    console.error('Failed to parse AI response:', e, '\nRaw:', text)
    // Return a minimal valid response so the simulation doesn't break
    return {
      npcs: [],
      sum: '平静的一天，什么特别的事都没有发生。',
      talks: [],
    }
  }
}
