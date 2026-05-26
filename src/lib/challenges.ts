import { supabase } from './supabase'
import { Challenge } from '../types'

export async function fetchActiveChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase.rpc('list_active_challenges')
  if (error) throw error
  return (
    (data as {
      id: string
      slug: string
      title: string
      description: string
      kind: string
      target_value: number
      starts_at: string
      ends_at: string
      progress: number
      completed_at: string | null
    }[]) ?? []
  ).map(c => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    kind: c.kind,
    targetValue: c.target_value,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    progress: c.progress,
    completedAt: c.completed_at,
  }))
}

export async function refreshChallengeProgress(): Promise<void> {
  const { error } = await supabase.rpc('refresh_challenge_progress')
  if (error) throw error
}
