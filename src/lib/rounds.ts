import { supabase } from './supabase'
import {
  LeaderboardEntry,
  PlayerSearchResult,
  RoundDetail,
  RoundFormat,
  RoundPlayer,
  RoundScore,
  RoundSummary,
  RoundThrow,
  ThrowStyle,
} from '../types'

interface RoundRow {
  id: string
  user_id: string
  course_id: string | null
  bag_id: string | null
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed'
  format?: RoundFormat
}

interface RoundPlayerRow {
  id: string
  round_id: string
  user_id: string | null
  display_name: string
  is_host: boolean
  sort_order: number
  created_at: string
}

interface RoundScoreRow {
  id: string
  round_id: string
  round_player_id: string
  hole_number: number
  strokes: number
  putts: number | null
  par: number | null
  updated_at: string
}

interface RoundThrowRow {
  id: string
  round_id: string
  hole_number: number
  bag_disc_id: string | null
  disc_name: string
  throw_style: ThrowStyle
  recommended_rank: number | null
  used_recommendation: boolean
  notes: string | null
  created_at: string
}

interface RoundPlayerTotalRow {
  round_player_id: string
  round_id: string
  user_id: string | null
  display_name: string
  is_host: boolean
  course_id: string | null
  round_status: string
  started_at: string
  ended_at: string | null
  holes_scored: number
  total_strokes: number
  total_par: number
  score_to_par: number
}

interface CourseLeaderboardRow {
  course_id: string
  round_player_id: string
  round_id: string
  user_id: string | null
  display_name: string
  total_strokes: number
  total_par: number
  score_to_par: number
  holes_scored: number
  played_at: string
  course_rank: number
}

interface HoleLeaderboardRow {
  course_id: string
  hole_number: number
  round_player_id: string
  round_id: string
  user_id: string | null
  display_name: string
  strokes: number
  par: number | null
  score_to_par: number
  played_at: string
  hole_rank: number
}

function rowToThrow(r: RoundThrowRow): RoundThrow {
  return {
    id: r.id,
    roundId: r.round_id,
    holeNumber: r.hole_number,
    bagDiscId: r.bag_disc_id,
    discName: r.disc_name,
    throwStyle: r.throw_style,
    recommendedRank: r.recommended_rank,
    usedRecommendation: r.used_recommendation,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

function rowToPlayer(r: RoundPlayerRow): RoundPlayer {
  return {
    id: r.id,
    roundId: r.round_id,
    userId: r.user_id,
    displayName: r.display_name,
    isHost: r.is_host,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

function rowToScore(r: RoundScoreRow): RoundScore {
  return {
    id: r.id,
    roundId: r.round_id,
    roundPlayerId: r.round_player_id,
    holeNumber: r.hole_number,
    strokes: r.strokes,
    putts: r.putts,
    par: r.par,
    updatedAt: r.updated_at,
  }
}

function formatScoreToPar(n: number): string {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : String(n)
}

export { formatScoreToPar }

export async function startRound(input: {
  courseId: string
  bagId: string
  hostDisplayName: string
}): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to start a round')

  const { data, error } = await supabase
    .from('rounds')
    .insert({
      user_id: user.id,
      course_id: input.courseId,
      bag_id: input.bagId,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '42501' || error.message?.includes('row-level security')) {
      throw new Error(
        'Could not start round — database permissions may be incomplete. Run migration 008_rounds.sql (and 013_scorecard_social.sql) in Supabase.',
      )
    }
    throw new Error(error.message || 'Could not start round')
  }

  const { error: playerErr } = await supabase.from('round_players').insert({
    round_id: data.id,
    user_id: user.id,
    display_name: input.hostDisplayName.trim() || 'You',
    is_host: true,
    sort_order: 0,
  })
  if (playerErr) {
    // Round exists; scorecard needs migration 013. Live round + disc logging still work.
    console.warn('[rounds] round_players insert failed — apply 013_scorecard_social.sql', playerErr)
  }

  return data.id
}

export async function endRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', roundId)
  if (error) throw error
}

export async function logThrow(input: {
  roundId: string
  holeNumber: number
  bagDiscId: string
  discName: string
  throwStyle: ThrowStyle
  recommendedRank: number | null
  usedRecommendation?: boolean
}): Promise<RoundThrow> {
  const { data, error } = await supabase
    .from('round_throws')
    .insert({
      round_id: input.roundId,
      hole_number: input.holeNumber,
      bag_disc_id: input.bagDiscId,
      disc_name: input.discName,
      throw_style: input.throwStyle,
      recommended_rank: input.recommendedRank,
      used_recommendation: input.usedRecommendation ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToThrow(data as RoundThrowRow)
}

export async function listThrowsForRound(roundId: string): Promise<RoundThrow[]> {
  const { data, error } = await supabase
    .from('round_throws')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as RoundThrowRow[]).map(rowToThrow)
}

export async function listPlayersForRound(roundId: string): Promise<RoundPlayer[]> {
  const { data, error } = await supabase
    .from('round_players')
    .select('*')
    .eq('round_id', roundId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data as RoundPlayerRow[]).map(rowToPlayer)
}

export async function listScoresForRound(roundId: string): Promise<RoundScore[]> {
  const { data, error } = await supabase
    .from('round_scores')
    .select('*')
    .eq('round_id', roundId)
    .order('hole_number', { ascending: true })
  if (error) throw error
  return (data as RoundScoreRow[]).map(rowToScore)
}

export async function upsertHoleScore(input: {
  roundId: string
  roundPlayerId: string
  holeNumber: number
  strokes: number
  putts?: number | null
  par?: number | null
}): Promise<RoundScore> {
  const { data, error } = await supabase
    .from('round_scores')
    .upsert(
      {
        round_id: input.roundId,
        round_player_id: input.roundPlayerId,
        hole_number: input.holeNumber,
        strokes: input.strokes,
        putts: input.putts ?? null,
        par: input.par ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'round_player_id,hole_number' },
    )
    .select('*')
    .single()
  if (error) throw error
  return rowToScore(data as RoundScoreRow)
}

export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const { data, error } = await supabase.rpc('search_players', {
    p_query: query.trim(),
  })
  if (error) throw error
  return ((data as { user_id: string; display_name: string; email: string }[]) ?? []).map(
    r => ({
      userId: r.user_id,
      displayName: r.display_name,
      email: r.email,
    }),
  )
}

export async function addRoundPlayer(input: {
  roundId: string
  displayName: string
  userId?: string | null
}): Promise<RoundPlayer> {
  const existing = await listPlayersForRound(input.roundId)
  if (input.userId && existing.some(p => p.userId === input.userId)) {
    throw new Error('That player is already on this card')
  }

  const { data, error } = await supabase
    .from('round_players')
    .insert({
      round_id: input.roundId,
      user_id: input.userId ?? null,
      display_name: input.displayName.trim(),
      is_host: false,
      sort_order: existing.length,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToPlayer(data as RoundPlayerRow)
}

export async function removeRoundPlayer(playerId: string): Promise<void> {
  const { error } = await supabase.from('round_players').delete().eq('id', playerId)
  if (error) throw error
}

export async function getActiveRound(): Promise<RoundRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: hosted, error: hostErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (hostErr) throw hostErr
  if (hosted) return hosted as RoundRow

  const { data: joined, error: joinErr } = await supabase
    .from('round_players')
    .select('round_id, rounds!inner(*)')
    .eq('user_id', user.id)
    .eq('rounds.status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (joinErr) {
    // round_players table may not exist yet (migration 013 not applied).
    console.warn('[rounds] joined active round lookup failed', joinErr)
    return null
  }
  if (!joined) return null
  const round = (joined as unknown as { rounds: RoundRow }).rounds
  return round
}

async function hydrateRoundSummaries(
  totals: RoundPlayerTotalRow[],
): Promise<RoundSummary[]> {
  const courseIds = [...new Set(totals.map(t => t.course_id).filter(Boolean))] as string[]
  const courseMap = new Map<string, { name: string; locality: string | null }>()
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('courses')
      .select('id, name, locality')
      .in('id', courseIds)
    for (const c of data ?? []) {
      courseMap.set(c.id, { name: c.name, locality: c.locality })
    }
  }

  const byRound = new Map<string, RoundPlayerTotalRow[]>()
  for (const t of totals) {
    const list = byRound.get(t.round_id) ?? []
    list.push(t)
    byRound.set(t.round_id, list)
  }

  const roundIds = [...byRound.keys()]
  const roundMetaMap = new Map<
    string,
    { format: RoundFormat; bagId: string | null; hostUserId: string }
  >()
  if (roundIds.length > 0) {
    const { data: roundRows } = await supabase
      .from('rounds')
      .select('id, format, bag_id, user_id')
      .in('id', roundIds)
    for (const r of roundRows ?? []) {
      roundMetaMap.set(r.id, {
        format: (r.format ?? 'stroke') as RoundFormat,
        bagId: r.bag_id,
        hostUserId: r.user_id,
      })
    }
  }

  const out: RoundSummary[] = []
  for (const [roundId, players] of byRound) {
    const row = players.find(p => p.is_host) ?? players[0]
    const course = row.course_id ? courseMap.get(row.course_id) : null
    const meta = roundMetaMap.get(roundId)
    out.push({
      id: roundId,
      courseId: row.course_id,
      courseName: course?.name ?? null,
      courseLocality: course?.locality ?? null,
      bagId: meta?.bagId ?? null,
      status: row.round_status as 'active' | 'completed',
      format: meta?.format ?? 'stroke',
      startedAt: row.started_at,
      endedAt: row.ended_at,
      hostUserId: meta?.hostUserId ?? row.user_id ?? '',
      holesScored: row.holes_scored,
      totalStrokes: row.total_strokes,
      totalPar: row.total_par,
      scoreToPar: row.score_to_par,
      playerCount: players.length,
    })
  }

  return out.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export async function getRoundStatus(
  roundId: string,
): Promise<'active' | 'completed' | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('status')
    .eq('id', roundId)
    .maybeSingle()
  if (error) throw error
  return (data?.status as 'active' | 'completed' | undefined) ?? null
}

export async function listMyRounds(limit = 40): Promise<RoundSummary[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('round_player_totals')
    .select('*')
    .eq('user_id', user.id)
    .eq('round_status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit * 2)
  if (error) throw error

  const byRound = new Map<string, RoundPlayerTotalRow>()
  for (const t of (data as RoundPlayerTotalRow[]) ?? []) {
    byRound.set(t.round_id, t)
  }
  const summaries = await hydrateRoundSummaries([...byRound.values()])
  return summaries.slice(0, limit)
}

export async function getRoundDetail(roundId: string): Promise<RoundDetail | null> {
  const { data: round, error: roundErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .maybeSingle()
  if (roundErr) throw roundErr
  if (!round) return null

  const [players, scores, throws] = await Promise.all([
    listPlayersForRound(roundId),
    listScoresForRound(roundId),
    listThrowsForRound(roundId),
  ])

  let courseName: string | null = null
  let courseLocality: string | null = null
  if (round.course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('name, locality')
      .eq('id', round.course_id)
      .maybeSingle()
    courseName = course?.name ?? null
    courseLocality = course?.locality ?? null
  }

  const hostPlayer = players.find(p => p.isHost) ?? players[0]
  const hostTotals = scores.filter(s => s.roundPlayerId === hostPlayer?.id)
  const holesScored = new Set(hostTotals.map(s => s.holeNumber)).size
  const totalStrokes = hostTotals.reduce((n, s) => n + s.strokes, 0)
  const totalPar = hostTotals.reduce((n, s) => n + (s.par ?? 0), 0)

  return {
    id: round.id,
    courseId: round.course_id,
    courseName,
    courseLocality,
    bagId: round.bag_id,
    status: round.status,
    format: (round.format ?? 'stroke') as RoundFormat,
    startedAt: round.started_at,
    endedAt: round.ended_at,
    hostUserId: round.user_id,
    holesScored,
    totalStrokes,
    totalPar,
    scoreToPar: totalStrokes - totalPar,
    playerCount: players.length,
    players,
    scores,
    throws,
  }
}

export async function getCourseLeaderboard(
  courseId: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('course_leaderboard')
    .select('*')
    .eq('course_id', courseId)
    .order('course_rank', { ascending: true })
    .limit(limit)
  if (error) throw error
  return ((data as CourseLeaderboardRow[]) ?? []).map(r => ({
    rank: r.course_rank,
    roundPlayerId: r.round_player_id,
    roundId: r.round_id,
    userId: r.user_id,
    displayName: r.display_name,
    strokes: r.total_strokes,
    par: r.total_par,
    scoreToPar: r.score_to_par,
    holesScored: r.holes_scored,
    playedAt: r.played_at,
  }))
}

export async function getHoleLeaderboard(
  courseId: string,
  holeNumber: number,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('hole_leaderboard')
    .select('*')
    .eq('course_id', courseId)
    .eq('hole_number', holeNumber)
    .order('hole_rank', { ascending: true })
    .limit(limit)
  if (error) throw error
  return ((data as HoleLeaderboardRow[]) ?? []).map(r => ({
    rank: r.hole_rank,
    roundPlayerId: r.round_player_id,
    roundId: r.round_id,
    userId: r.user_id,
    displayName: r.display_name,
    strokes: r.strokes,
    par: r.par,
    scoreToPar: r.score_to_par,
    holesScored: 1,
    playedAt: r.played_at,
  }))
}

/** Running totals for each player on a scorecard. */
export function computePlayerTotals(
  players: RoundPlayer[],
  scores: RoundScore[],
): Map<
  string,
  { strokes: number; par: number; scoreToPar: number; holes: number }
> {
  const out = new Map<
    string,
    { strokes: number; par: number; scoreToPar: number; holes: number }
  >()
  for (const p of players) {
    const mine = scores.filter(s => s.roundPlayerId === p.id)
    const strokes = mine.reduce((n, s) => n + s.strokes, 0)
    const par = mine.reduce((n, s) => n + (s.par ?? 0), 0)
    out.set(p.id, {
      strokes,
      par,
      scoreToPar: strokes - par,
      holes: mine.length,
    })
  }
  return out
}

/** Rank players on the current hole (1 = best / fewest strokes). */
export function rankPlayersOnHole(
  players: RoundPlayer[],
  scores: RoundScore[],
  holeNumber: number,
): { player: RoundPlayer; strokes: number; rank: number }[] {
  const onHole = players
    .map(p => {
      const s = scores.find(
        sc => sc.roundPlayerId === p.id && sc.holeNumber === holeNumber,
      )
      return s ? { player: p, strokes: s.strokes } : null
    })
    .filter(Boolean) as { player: RoundPlayer; strokes: number }[]

  onHole.sort((a, b) => a.strokes - b.strokes)
  let lastStrokes = -1
  let lastRank = 0
  return onHole.map((row, i) => {
    if (row.strokes !== lastStrokes) {
      lastRank = i + 1
      lastStrokes = row.strokes
    }
    return { ...row, rank: lastRank }
  })
}
