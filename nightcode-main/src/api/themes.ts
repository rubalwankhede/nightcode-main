export type Theme = {
  id: string
  name: string
  author: string
  description: string
  accent: 'violet' | 'lime' | 'pink' | 'cyan'
  likes: number
  installed: boolean
}

export async function getThemes(viewerId: string): Promise<Theme[]> {
  const response = await fetch(`/api/themes?viewer=${encodeURIComponent(viewerId)}`)
  const data = await response.json() as Theme[] & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Unable to load themes.')
  return data
}

export async function toggleTheme(themeId: string, viewerId: string): Promise<Theme> {
  const response = await fetch(`/api/themes/${encodeURIComponent(themeId)}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewerId }),
  })
  const data = await response.json() as Theme & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Unable to install theme.')
  return data
}
