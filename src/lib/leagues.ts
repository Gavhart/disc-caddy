import { supabase } from './supabase'
import {
  Club,
  DiscoverableLeague,
  League,
  LeagueAnnouncement,
  LeagueMessage,
  LeaguePair,
  LeaguePairStanding,
  LeaguePot,
  LeaguePotEntry,
  LeagueMemberOption,
  LeagueRivalry,
  LeagueStanding,
  LeagueStreak,
  RoundFormat,
} from '../types'

function seasonStatus(start: string, end: string): League['seasonStatus'] {
  const today = new Date().toISOString().slice(0, 10)
  if (today < start) return 'upcoming'
  if (today > end) return 'ended'
  return 'active'
}

function mapLeague(l: Record<string, unknown>): League {
  return {
    id: String(l.id),
    name: String(l.name),
    seasonStart: String(l.season_start),
    seasonEnd: String(l.season_end),
    format: l.format as RoundFormat,
    playMode: (l.play_mode as League['playMode']) ?? 'singles',
    handicapEnabled: Boolean(l.handicap_enabled),
    minRounds: Number(l.min_rounds ?? 0),
    isPublic: Boolean(l.is_public),
    skillLevel: (l.skill_level as League['skillLevel']) ?? 'all',
    clubId: (l.club_id as string | null) ?? null,
    inviteCode: String(l.invite_code),
    memberCount: Number(l.member_count ?? 0),
    createdBy: String(l.created_by),
    createdAt: String(l.created_at),
    creatorName: (l.creator_name as string | null) ?? null,
    description: (l.description as string | null) ?? null,
    location: (l.location as string | null) ?? null,
    rules: (l.rules as string | null) ?? null,
    myRole: (l.my_role as League['myRole']) ?? 'member',
    isAdmin: l.my_role === 'admin',
    roundsSubmitted: Number(l.rounds_submitted ?? 0),
    playersWithRounds: Number(l.players_with_rounds ?? 0),
    myRoundsSubmitted: Number(l.my_rounds_submitted ?? 0),
    leaderName: (l.leader_name as string | null) ?? null,
    seasonStatus: seasonStatus(String(l.season_start), String(l.season_end)),
  }
}

export async function createLeague(input: {
  name: string
  seasonStart: string
  seasonEnd: string
  format?: RoundFormat
  description?: string
  location?: string
  rules?: string
  playMode?: 'singles' | 'doubles'
  handicapEnabled?: boolean
  minRounds?: number
  isPublic?: boolean
  skillLevel?: League['skillLevel']
  clubId?: string | null
}): Promise<{ id: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc('create_league', {
    p_name: input.name,
    p_season_start: input.seasonStart,
    p_season_end: input.seasonEnd,
    p_format: input.format ?? 'stroke',
    p_description: input.description?.trim() || null,
    p_location: input.location?.trim() || null,
    p_rules: input.rules?.trim() || null,
    p_play_mode: input.playMode ?? 'singles',
    p_handicap_enabled: input.handicapEnabled ?? false,
    p_min_rounds: input.minRounds ?? 0,
    p_is_public: input.isPublic ?? false,
    p_skill_level: input.skillLevel ?? 'all',
    p_club_id: input.clubId ?? null,
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
  return ((data as Record<string, unknown>[]) ?? []).map(mapLeague)
}

export async function discoverPublicLeagues(limit = 20): Promise<DiscoverableLeague[]> {
  const { data, error } = await supabase.rpc('discover_public_leagues', { p_limit: limit })
  if (error) throw error
  return (
    (data as {
      id: string
      name: string
      description: string | null
      location: string | null
      format: RoundFormat
      play_mode: 'singles' | 'doubles'
      skill_level: League['skillLevel']
      handicap_enabled: boolean
      season_start: string
      season_end: string
      invite_code: string
      member_count: number
      creator_name: string | null
    }[]) ?? []
  ).map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
    location: l.location,
    format: l.format,
    playMode: l.play_mode,
    skillLevel: l.skill_level,
    handicapEnabled: Boolean(l.handicap_enabled),
    seasonStart: l.season_start,
    seasonEnd: l.season_end,
    inviteCode: l.invite_code,
    memberCount: Number(l.member_count),
    creatorName: l.creator_name,
  }))
}

export async function updateLeague(
  leagueId: string,
  patch: {
    name?: string
    seasonStart?: string
    seasonEnd?: string
    format?: 'stroke' | 'stableford'
    description?: string | null
    location?: string | null
    rules?: string | null
    playMode?: 'singles' | 'doubles'
    handicapEnabled?: boolean
    minRounds?: number
    isPublic?: boolean
    skillLevel?: League['skillLevel']
    clubId?: string | null
  },
): Promise<void> {
  const { error } = await supabase.rpc('update_league', {
    p_league_id: leagueId,
    p_name: patch.name ?? null,
    p_season_start: patch.seasonStart ?? null,
    p_season_end: patch.seasonEnd ?? null,
    p_format: patch.format ?? null,
    p_description: patch.description ?? null,
    p_location: patch.location ?? null,
    p_rules: patch.rules ?? null,
    p_update_info: patch.description !== undefined,
    p_play_mode: patch.playMode ?? null,
    p_handicap_enabled: patch.handicapEnabled ?? null,
    p_min_rounds: patch.minRounds ?? null,
    p_update_settings:
      patch.playMode !== undefined ||
      patch.handicapEnabled !== undefined ||
      patch.minRounds !== undefined,
    p_is_public: patch.isPublic ?? null,
    p_skill_level: patch.skillLevel ?? null,
    p_club_id: patch.clubId === undefined ? null : patch.clubId,
    p_update_visibility:
      patch.isPublic !== undefined ||
      patch.skillLevel !== undefined ||
      patch.clubId !== undefined,
  })
  if (error) throw error
}

export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_league', { p_league_id: leagueId })
  if (error) throw error
}

export async function refreshLeagueHandicaps(leagueId: string): Promise<number> {
  const { data, error } = await supabase.rpc('refresh_league_handicaps', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return Number(data ?? 0)
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
      avg_stableford_points?: number | null
      best_stableford_points?: number | null
      avg_net_score_to_par?: number | null
      handicap_index?: number | null
      qualified?: boolean
      rank: number
    }[]) ?? []
  ).map(s => ({
    userId: s.user_id,
    displayName: s.display_name,
    roundsSubmitted: s.rounds_submitted,
    avgScoreToPar: s.avg_score_to_par,
    bestScoreToPar: s.best_score_to_par,
    avgStablefordPoints: s.avg_stableford_points ?? null,
    bestStablefordPoints: s.best_stableford_points ?? null,
    avgNetScoreToPar: s.avg_net_score_to_par ?? null,
    handicapIndex: s.handicap_index != null ? Number(s.handicap_index) : null,
    qualified: s.qualified !== false,
    rank: s.rank,
  }))
}

export async function fetchLeaguePairStandings(leagueId: string): Promise<LeaguePairStanding[]> {
  const { data, error } = await supabase.rpc('get_league_pair_standings', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      pair_id: string
      pair_name: string
      rounds_together: number
      avg_combined_to_par: number | null
      rank: number
    }[]) ?? []
  ).map(s => ({
    pairId: s.pair_id,
    pairName: s.pair_name,
    roundsTogether: s.rounds_together,
    avgCombinedToPar: s.avg_combined_to_par,
    rank: s.rank,
  }))
}

export async function listLeaguePairs(leagueId: string): Promise<LeaguePair[]> {
  const { data, error } = await supabase.rpc('list_league_pairs', { p_league_id: leagueId })
  if (error) throw error
  return (
    (data as {
      id: string
      name: string | null
      player1_id: string
      player2_id: string
      player1_name: string
      player2_name: string
    }[]) ?? []
  ).map(p => ({
    id: p.id,
    name: p.name,
    player1Id: p.player1_id,
    player2Id: p.player2_id,
    player1Name: p.player1_name,
    player2Name: p.player2_name,
  }))
}

export async function createLeaguePair(
  leagueId: string,
  player1Id: string,
  player2Id: string,
  name?: string,
): Promise<void> {
  const { error } = await supabase.rpc('create_league_pair', {
    p_league_id: leagueId,
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_name: name?.trim() || null,
  })
  if (error) throw error
}

export async function deleteLeaguePair(pairId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_league_pair', { p_pair_id: pairId })
  if (error) throw error
}

export async function listLeagueAnnouncements(leagueId: string): Promise<LeagueAnnouncement[]> {
  const { data, error } = await supabase.rpc('list_league_announcements', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      title: string
      body: string
      author_name: string
      created_at: string
    }[]) ?? []
  ).map(a => ({
    id: a.id,
    title: a.title,
    body: a.body,
    authorName: a.author_name,
    createdAt: a.created_at,
  }))
}

export async function postLeagueAnnouncement(
  leagueId: string,
  title: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc('post_league_announcement', {
    p_league_id: leagueId,
    p_title: title,
    p_body: body,
  })
  if (error) throw error
}

export async function listLeagueMessages(leagueId: string): Promise<LeagueMessage[]> {
  const { data, error } = await supabase.rpc('list_league_messages', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      body: string
      sender_id: string
      sender_name: string
      created_at: string
    }[]) ?? []
  ).map(m => ({
    id: m.id,
    body: m.body,
    senderId: m.sender_id,
    senderName: m.sender_name,
    createdAt: m.created_at,
  }))
}

export async function sendLeagueMessage(leagueId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_league_message', {
    p_league_id: leagueId,
    p_body: body,
  })
  if (error) throw error
}

export async function fetchLeaguePot(leagueId: string): Promise<LeaguePot> {
  const { data, error } = await supabase.rpc('get_league_pot', { p_league_id: leagueId })
  if (error) throw error
  const row = data as {
    id: string
    label: string
    balance_cents: number
    entry_fee_cents: number
  }
  return {
    id: row.id,
    label: row.label,
    balanceCents: row.balance_cents,
    entryFeeCents: row.entry_fee_cents,
  }
}

export async function addLeaguePotEntry(
  leagueId: string,
  amountCents: number,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_league_pot_entry', {
    p_league_id: leagueId,
    p_amount_cents: amountCents,
    p_note: note?.trim() || null,
  })
  if (error) throw error
}

export async function listLeaguePotEntries(leagueId: string): Promise<LeaguePotEntry[]> {
  const { data, error } = await supabase.rpc('list_league_pot_entries', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      amount_cents: number
      note: string | null
      player_name: string
      created_at: string
    }[]) ?? []
  ).map(e => ({
    id: e.id,
    amountCents: e.amount_cents,
    note: e.note,
    playerName: e.player_name,
    createdAt: e.created_at,
  }))
}

export async function listLeagueMembers(leagueId: string): Promise<LeagueMemberOption[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name, email)')
    .eq('league_id', leagueId)
  if (error) throw error
  return ((data ?? []) as unknown as {
    user_id: string
    profiles: { display_name: string | null; email: string | null } | null
  }[]).map(row => {
    const profile = row.profiles
    const displayName =
      profile?.display_name?.trim() ||
      profile?.email?.split('@')[0] ||
      'Player'
    return { userId: row.user_id, displayName }
  })
}

export async function fetchLeagueStreaks(leagueId: string): Promise<LeagueStreak[]> {
  const { data, error } = await supabase.rpc('get_league_streaks', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      submitted_rounds: number
      avg_score_to_par: number | null
    }[]) ?? []
  ).map(s => ({
    userId: s.user_id,
    displayName: s.display_name,
    submittedRounds: s.submitted_rounds,
    avgScoreToPar: s.avg_score_to_par,
  }))
}

export async function fetchLeagueRivalries(leagueId: string): Promise<LeagueRivalry[]> {
  const { data, error } = await supabase.rpc('get_league_rivalries', {
    p_league_id: leagueId,
  })
  if (error) throw error
  return (
    (data as {
      user_a_id: string
      user_b_id: string
      user_a_name: string
      user_b_name: string
      shared_rounds: number
      a_wins: number
      b_wins: number
    }[]) ?? []
  ).map(r => ({
    userAId: r.user_a_id,
    userBId: r.user_b_id,
    userAName: r.user_a_name,
    userBName: r.user_b_name,
    sharedRounds: r.shared_rounds,
    aWins: r.a_wins,
    bWins: r.b_wins,
  }))
}

export async function createClub(input: {
  name: string
  description?: string
  location?: string
}): Promise<{ id: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc('create_club', {
    p_name: input.name,
    p_description: input.description?.trim() || null,
    p_location: input.location?.trim() || null,
  })
  if (error) throw error
  const row = data as { id: string; invite_code: string }
  return { id: row.id, inviteCode: row.invite_code }
}

export async function joinClub(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_club', { p_invite_code: inviteCode })
  if (error) throw error
  return String(data)
}

export async function listMyClubs(): Promise<Club[]> {
  const { data, error } = await supabase.rpc('list_my_clubs')
  if (error) throw error
  return (
    (data as {
      id: string
      name: string
      description: string | null
      location: string | null
      invite_code: string
      my_role: 'admin' | 'member'
      member_count: number
    }[]) ?? []
  ).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    location: c.location,
    inviteCode: c.invite_code,
    myRole: c.my_role,
    memberCount: c.member_count,
  }))
}

export async function submitRoundToLeague(leagueId: string, roundId: string): Promise<void> {
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
