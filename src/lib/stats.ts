import { supabase } from './supabase'
import { adherencePct } from './caddyAdherence'
import { DiscPerformanceStat, PlayerStatsDashboard, ThrowPhaseStats, CaddyAdherenceStats } from '../types'

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

export async function fetchThrowPhaseStats(): Promise<ThrowPhaseStats> {
  const { data, error } = await supabase.rpc('get_throw_phase_stats')
  if (error) throw error
  const d = (data ?? {}) as {
    totals?: {
      throw_phase: string
      throws: number
      avg_distance_ft: number | null
    }[]
    by_disc?: {
      disc_name: string
      throw_phase: string
      throws: number
      avg_distance_ft: number | null
    }[]
  }
  return {
    totals: (d.totals ?? []).map(r => ({
      throwPhase: r.throw_phase as ThrowPhaseStats['totals'][0]['throwPhase'],
      throws: r.throws,
      avgDistanceFt: r.avg_distance_ft,
    })),
    byDisc: (d.by_disc ?? []).map(r => ({
      discName: r.disc_name,
      throwPhase: r.throw_phase as ThrowPhaseStats['byDisc'][0]['throwPhase'],
      throws: r.throws,
      avgDistanceFt: r.avg_distance_ft,
    })),
  }
}

export async function fetchCaddyAdherenceStats(): Promise<CaddyAdherenceStats> {
  const { data, error } = await supabase.rpc('get_caddy_adherence_stats')
  if (error) throw error
  const d = (data ?? {}) as {
    total_throws?: number
    top_pick_throws?: number
    off_script_throws?: number
    off_script_discs?: { disc_name: string; throws: number }[]
    by_phase?: {
      throw_phase: string
      total: number
      top_pick_throws: number
    }[]
  }
  const totalThrows = Number(d.total_throws ?? 0)
  const topPickThrows = Number(d.top_pick_throws ?? 0)
  return {
    totalThrows,
    topPickThrows,
    offScriptThrows: Number(d.off_script_throws ?? 0),
    adherencePct: adherencePct(topPickThrows, totalThrows),
    offScriptDiscs: (d.off_script_discs ?? []).map(r => ({
      discName: r.disc_name,
      throws: r.throws,
    })),
    byPhase: (d.by_phase ?? []).map(r => ({
      throwPhase: r.throw_phase as CaddyAdherenceStats['byPhase'][0]['throwPhase'],
      total: r.total,
      topPickThrows: r.top_pick_throws,
    })),
  }
}
