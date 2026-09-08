export type AiMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AiRequest = {
  messages: AiMessage[]
}

export async function requestAiCompletion({ messages }: AiRequest): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content?.trim() || 'the current project task'
    return [
      'AI is offline in this session, so here is a practical fallback suggestion:',
      '',
      `- Start by isolating the exact issue in ${latestUserMessage.slice(0, 160) || 'the current task'}.`,
      '- Verify data flow, then patch the smallest relevant function or API handler.',
      '- Re-run the action and confirm the result in the browser before moving on.',
      '',
      'If you configure AI_API_KEY on the server, the live assistant can replace this fallback with a richer response.'
    ].join('\n')
  }

  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.AI_MODEL || 'gpt-4o-mini'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  })

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
  if (!response.ok) throw new Error(data.error?.message || `AI provider returned ${response.status}.`)

  const message = data.choices?.[0]?.message?.content?.trim()
  if (!message) throw new Error('AI provider returned an empty response.')
  return message
}
