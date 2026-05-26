import { supabase } from './supabase'
import { League, LeagueStanding, RoundFormat } from '../types'

function seasonStatus(start: string, end: string): League['seasonStatus'] {
  const today = new Date().toISOString().slice(0, 10)
  if (today < start) return 'upcoming'
  if (today > end) return 'ended'
  return 'active'
}

export async function createLeague(input: {
  name: string
  seasonStart: string
  seasonEnd: string
  format?: RoundFormat
}): Promise<{ id: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc('create_league', {
    p_name: input.name,
    p_season_start: input.seasonStart,
    p_season_end: input.seasonEnd,
    p_format: input.format ?? 'stroke',
  })
  if (error) throw error
  const row = data as { id: string; invite_code: string }
  return { id: row.id, inviteCode: row.invite_code }
}

export async function joinLeague(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_league', {
    p_invite_code: inviteCode,
  })
  if (error) throw error
  return String(data)
}

export async function listMyLeagues(): Promise<League[]> {
  const { data, error } = await supabase.rpc('list_my_leagues')
  if (error) throw error
  return (
    (data as {
      id: string
      name: string
      season_start: string
      season_end: string
      format: RoundFormat
      invite_code: string
      member_count: number
      created_by: string
      created_at: string
      my_role: 'admin' | 'member'
      rounds_submitted: number
      players_with_rounds: number
      my_rounds_submitted: number
      leader_name: string | null
    }[]) ?? []
  ).map(l => ({
    id: l.id,
    name: l.name,
    seasonStart: l.season_start,
    seasonEnd: l.season_end,
    format: l.format,
    inviteCode: l.invite_code,
    memberCount: l.member_count,
    createdBy: l.created_by,
    createdAt: l.created_at,
    myRole: l.my_role ?? 'member',
    isAdmin: l.my_role === 'admin',
    roundsSubmitted: Number(l.rounds_submitted ?? 0),
    playersWithRounds: Number(l.players_with_rounds ?? 0),
    myRoundsSubmitted: Number(l.my_rounds_submitted ?? 0),
    leaderName: l.leader_name ?? null,
    seasonStatus: seasonStatus(l.season_start, l.season_end),
  }))
}

export async function updateLeague(
  leagueId: string,
  patch: {
    name?: string
    seasonStart?: string
    seasonEnd?: string
    format?: 'stroke' | 'stableford'
  },
): Promise<void> {
  const { error } = await supabase.rpc('update_league', {
    p_league_id: leagueId,
    p_name: patch.name ?? null,
    p_season_start: patch.seasonStart ?? null,
    p_season_end: patch.seasonEnd ?? null,
    p_format: patch.format ?? null,
  })
  if (error) throw error
}

export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_league', {
    p_league_id: leagueId,
  })
  if (error) throw error
}

export async function fetchLeagueStandings(leagueId: string): Promise<LeagueStanding[]> {
  const { data, error } = await supabase.rpc('get_league_standings', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      rounds_submitted: number
      avg_score_to_par: number | null
      best_score_to_par: number | null
      rank: number
    }[]) ?? []
  ).map(s => ({
    userId: s.user_id,
    displayName: s.display_name,
    roundsSubmitted: s.rounds_submitted,
    avgScoreToPar: s.avg_score_to_par,
    bestScoreToPar: s.best_score_to_par,
    rank: s.rank,
  }))
}

export async function submitRoundToLeague(
  leagueId: string,
  roundId: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_round_to_league', {
    p_league_id: leagueId,
    p_round_id: roundId,
  })
  if (error) throw error
}

export async function autoSubmitRoundToLeagues(
  roundId: string,
): Promise<{ submitted: number; leagueIds: string[] }> {
  const { data, error } = await supabase.rpc('auto_submit_round_to_leagues', {
    p_round_id: roundId,
  })
  if (error) throw error
  const row = (data ?? {}) as { submitted: number; league_ids: string[] }
  return {
    submitted: Number(row.submitted ?? 0),
    leagueIds: row.league_ids ?? [],
  }
}
