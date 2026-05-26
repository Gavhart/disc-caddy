import { supabase } from './supabase'
import { DiscPerformanceStat, PlayerStatsDashboard } from '../types'

export async function fetchPlayerStatsDashboard(): Promise<PlayerStatsDashboard> {
  const { data, error } = await supabase.rpc('get_player_stats_dashboard')
  if (error) throw error
  const d = (data ?? {}) as Record<string, unknown>
  return {
    roundsPlayed: Number(d.rounds_played ?? 0),
    avgScoreToPar: d.avg_score_to_par != null ? Number(d.avg_score_to_par) : null,
    bestScoreToPar: d.best_score_to_par != null ? Number(d.best_score_to_par) : null,
    worstScoreToPar: d.worst_score_to_par != null ? Number(d.worst_score_to_par) : null,
    totalBirdies: Number(d.total_birdies ?? 0),
    avgPutts: d.avg_putts != null ? Number(d.avg_putts) : null,
    roundsLast30d: Number(d.rounds_last_30d ?? 0),
    recentRounds: (
      (d.recent_rounds as {
        round_id: string
        score_to_par: number
        total_strokes: number
        holes_scored: number
        played_at: string | null
        course_name: string | null
      }[]) ?? []
    ).map(r => ({
      roundId: r.round_id,
      scoreToPar: r.score_to_par,
      totalStrokes: r.total_strokes,
      holesScored: r.holes_scored,
      playedAt: r.played_at,
      courseName: r.course_name,
    })),
  }
}

export async function fetchDiscPerformanceStats(): Promise<DiscPerformanceStat[]> {
  const { data, error } = await supabase.rpc('get_disc_performance_stats')
  if (error) throw error
  return (
    (data as {
      disc_name: string
      throw_style: string
      throws: number
      avg_strokes: number | null
      avg_to_par: number | null
    }[]) ?? []
  ).map(r => ({
    discName: r.disc_name,
    throwStyle: r.throw_style as DiscPerformanceStat['throwStyle'],
    throws: r.throws,
    avgStrokes: r.avg_strokes,
    avgToPar: r.avg_to_par,
  }))
}
