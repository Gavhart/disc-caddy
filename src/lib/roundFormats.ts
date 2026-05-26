import { supabase } from './supabase'
import { FormatStandings, RoundFormat } from '../types'

export async function setRoundFormat(
  roundId: string,
  format: RoundFormat,
): Promise<void> {
  const { error } = await supabase.rpc('set_round_format', {
    p_round_id: roundId,
    p_format: format,
    p_config: {},
  })
  if (error) throw error
}

export async function fetchFormatStandings(roundId: string): Promise<FormatStandings> {
  const { data, error } = await supabase.rpc('get_round_format_standings', {
    p_round_id: roundId,
  })
  if (error) throw error
  const row = (data ?? {}) as {
    format: RoundFormat
    standings: {
      player_id?: string
      team_id?: string
      display_name: string
      rank: number
      display_score: number
      unit: string
      score_to_par?: number
      stableford_points?: number
      skins_won?: number
    }[]
  }
  return {
    format: row.format ?? 'stroke',
    standings: (row.standings ?? []).map(s => ({
      playerId: s.player_id,
      teamId: s.team_id,
      displayName: s.display_name,
      rank: s.rank,
      displayScore: s.display_score,
      unit: s.unit,
      scoreToPar: s.score_to_par,
      stablefordPoints: s.stableford_points,
      skinsWon: s.skins_won,
    })),
  }
}

export async function createRoundTeam(roundId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_round_team', {
    p_round_id: roundId,
    p_name: name,
  })
  if (error) throw error
  return String(data)
}

export async function assignPlayerTeam(
  roundPlayerId: string,
  teamId: string,
): Promise<void> {
  const { error } = await supabase.rpc('assign_player_team', {
    p_round_player_id: roundPlayerId,
    p_team_id: teamId,
  })
  if (error) throw error
}

export const FORMAT_LABELS: Record<RoundFormat, string> = {
  stroke: 'Stroke play',
  stableford: 'Stableford',
  skins: 'Skins',
  best_ball: 'Best ball',
}
