import { supabase } from './supabase'
import { PlayerBadge, PlayerStatsSummary } from '../types'

function mapStats(row: Record<string, unknown>): PlayerStatsSummary {
  return {
    roundsCompleted: Number(row.rounds_completed ?? 0),
    birdies: Number(row.birdies ?? 0),
    eagles: Number(row.eagles ?? 0),
    bestScoreToPar: row.best_score_to_par != null ? Number(row.best_score_to_par) : null,
    leagueRounds: Number(row.league_rounds ?? 0),
    leagueCount: Number(row.league_count ?? 0),
    groupRounds: Number(row.group_rounds ?? 0),
    challengesCompleted: Number(row.challenges_completed ?? 0),
    activeDaysLast7: Number(row.active_days_last_7 ?? 0),
    highlightCount: Number(row.highlight_count ?? 0),
  }
}

export async function fetchPlayerStatsSummary(userId?: string): Promise<PlayerStatsSummary> {
  const { data, error } = await supabase.rpc('get_player_stats_summary', {
    p_user_id: userId ?? null,
  })
  if (error) throw error
  return mapStats((data ?? {}) as Record<string, unknown>)
}

export async function refreshPlayerBadges(): Promise<number> {
  const { data, error } = await supabase.rpc('refresh_player_badges')
  if (error) throw error
  return Number(data ?? 0)
}

export async function listPlayerBadges(userId?: string): Promise<PlayerBadge[]> {
  const { data, error } = await supabase.rpc('list_player_badges', {
    p_user_id: userId ?? null,
  })
  if (error) throw error
  return (
    (data as {
      slug: string
      title: string
      description: string
      icon: string
      earned_at: string
    }[]) ?? []
  ).map(b => ({
    slug: b.slug,
    title: b.title,
    description: b.description,
    icon: b.icon,
    earnedAt: b.earned_at,
  }))
}

export async function refreshProgression(): Promise<void> {
  await refreshPlayerBadges()
}
