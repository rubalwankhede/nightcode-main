export type AiMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AiRequest = {
  messages: AiMessage[]
}

export async function requestAiCompletion({ messages }: AiRequest): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY is not configured on the server.')

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
