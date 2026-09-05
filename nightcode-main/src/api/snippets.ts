export type Snippet = {
  id: string
  title: string
  author: string
  code: string
  tag: string
  reactionCount: number
  reacted: boolean
}

export async function getSnippets(viewerId: string): Promise<Snippet[]> {
  const response = await fetch(`/api/snippets?viewer=${encodeURIComponent(viewerId)}`)
  const data = await response.json() as Snippet[] & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Unable to load snippets.')
  return data
}

export async function toggleSnippetReaction(snippetId: string, viewerId: string): Promise<Snippet> {
  const response = await fetch(`/api/snippets/${encodeURIComponent(snippetId)}/reaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewerId }),
  })
  const data = await response.json() as Snippet & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Unable to update reaction.')
  return data
}
