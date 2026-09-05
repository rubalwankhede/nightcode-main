export type CopilotMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type CopilotRequest = {
  messages: CopilotMessage[]
  file?: {
    name: string
    language: string
    content: string
  }
  tone: 'professional' | 'friendly' | 'unhinged'
}

export async function sendCopilotMessage(request: CopilotRequest): Promise<string> {
  const response = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  const data = await response.json() as { message?: string; error?: string }
  if (!response.ok) throw new Error(data.error || 'Copilot could not answer right now.')
  if (!data.message) throw new Error('Copilot returned an empty response.')
  return data.message
}
