export type CodingStats = {
  totalEdits: number
  charactersChanged: number
  activeDays: number
  byLanguage: Record<string, number>
  recentActivity: Array<{ date: string; edits: number }>
}

export async function getCodingStats(): Promise<CodingStats> {
  const response = await fetch('/api/stats')
  const data = await response.json() as CodingStats & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Unable to load coding statistics.')
  return data
}
