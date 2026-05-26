import { supabase } from './supabase'
import {
  BagDisc,
  HoleMemory,
  Recommendation,
  ThrowStyle,
} from '../types'

interface MemoryThrowRow {
  id: string
  round_id: string
  hole_number: number
  bag_disc_id: string | null
  disc_name: string
  throw_style: ThrowStyle
  created_at: string
}

/** Golf result phrase for hole memory copy, e.g. "parred", "birdied". */
export function formatHoleResult(strokes: number, par: number | null): string {
  if (par == null) return `shot ${strokes}`
  const diff = strokes - par
  if (diff === 0) return 'parred'
  if (diff === -1) return 'birdied'
  if (diff === -2) return 'eagled'
  if (diff === -3) return 'albatrossed'
  if (diff === 1) return 'bogeyed'
  if (diff === 2) return 'double-bogeyed'
  if (diff > 2) return `made ${strokes} (+${diff})`
  return `made ${strokes} (${diff})`
}

export function resolveMemoryBagDiscId(
  memory: HoleMemory,
  bag: BagDisc[],
): string | null {
  if (memory.bagDiscId && bag.some(d => d.id === memory.bagDiscId)) {
    return memory.bagDiscId
  }
  const byName = bag.find(
    d => d.discName.trim().toLowerCase() === memory.discName.trim().toLowerCase(),
  )
  return byName?.id ?? null
}

export function findMemoryRecommendation(
  recommendations: Recommendation[],
  memory: HoleMemory,
  bag: BagDisc[],
): Recommendation | null {
  const bagDiscId = resolveMemoryBagDiscId(memory, bag)
  if (!bagDiscId) return null
  return (
    recommendations.find(
      r => r.bagDisc.id === bagDiscId && r.throwStyle === memory.throwStyle,
    ) ??
    recommendations.find(r => r.bagDisc.id === bagDiscId) ??
    null
  )
}

export function buildHoleMemoryMessage(
  memory: HoleMemory,
  discInBag: boolean,
): string {
  const discLabel =
    memory.throwStyle === 'forehand'
      ? `${memory.discName} (forehand)`
      : memory.discName
  const result =
    memory.strokes != null
      ? formatHoleResult(memory.strokes, memory.par)
      : null

  let message = `Last time you played this hole, you threw a ${discLabel}`
  if (result) message += ` and ${result}`
  message += '.'
  if (discInBag) message += ' Recommended again.'
  else message += " That disc isn't in your bag anymore."
  return message
}

/** Summarize up to 3 prior rounds on this hole for the Recommend banner. */
export function buildHoleMemoriesMessage(
  memories: HoleMemory[],
  bag: BagDisc[],
): string | null {
  if (memories.length === 0) return null
  const latest = memories[0]
  const inBag = resolveMemoryBagDiscId(latest, bag) != null
  const lines = memories.slice(0, 3).map((m, i) => {
    const disc =
      m.throwStyle === 'forehand'
        ? `${m.discName} (FH)`
        : m.discName
    const result =
      m.strokes != null ? formatHoleResult(m.strokes, m.par) : null
    const when = new Date(m.playedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    return result
      ? `${i === 0 ? 'Latest' : when}: ${disc} — ${result}`
      : `${when}: ${disc}`
  })
  let header = buildHoleMemoryMessage(latest, inBag)
  if (memories.length > 1) {
    header += ` Prior rounds: ${lines.slice(1).join(' · ')}.`
  }
  return header
}

/** Move the prior disc to #1 when it's still in the bag. */
export function applyHoleMemory(
  recommendations: Recommendation[],
  memory: HoleMemory,
  bag: BagDisc[],
): Recommendation[] {
  const match = findMemoryRecommendation(recommendations, memory, bag)
  if (!match) return recommendations

  const rest = recommendations.filter(
    r => !(r.bagDisc.id === match.bagDisc.id && r.throwStyle === match.throwStyle),
  )
  const memoryPick: Recommendation = {
    ...match,
    rank: 1,
    pick: 'MEMORY',
    explanation: `Hole memory — ${buildHoleMemoryMessage(memory, true)}`,
  }

  const reranked = [memoryPick, ...rest].map((r, i) => ({
    ...r,
    rank: i + 1,
    pick:
      i === 0
        ? ('MEMORY' as const)
        : i === 1
          ? ('Alternative' as const)
          : i === 2
            ? ('Backup' as const)
            : null,
  }))

  return reranked
}

export async function fetchHoleMemory(
  courseId: string,
  holeNumber: number,
): Promise<HoleMemory | null> {
  const list = await fetchHoleMemories(courseId, holeNumber, 1)
  return list[0] ?? null
}

export async function fetchHoleMemories(
  courseId: string,
  holeNumber: number,
  limit = 3,
): Promise<HoleMemory[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rounds, error: roundsErr } = await supabase
    .from('rounds')
    .select('id, ended_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })

  if (roundsErr) {
    console.warn('[holeMemory] load rounds failed', roundsErr)
    return []
  }
  if (!rounds?.length) return []

  const memories: HoleMemory[] = []

  for (const round of rounds) {
    if (memories.length >= limit) break

    const { data: throwRow, error: throwErr } = await supabase
      .from('round_throws')
      .select('*')
      .eq('round_id', round.id)
      .eq('hole_number', holeNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (throwErr) {
      console.warn('[holeMemory] load throw failed', throwErr)
      continue
    }
    if (!throwRow) continue

    const row = throwRow as MemoryThrowRow
    let strokes: number | null = null
    let par: number | null = null

    const { data: hostPlayer } = await supabase
      .from('round_players')
      .select('id')
      .eq('round_id', round.id)
      .eq('is_host', true)
      .maybeSingle()

    if (hostPlayer) {
      const { data: score } = await supabase
        .from('round_scores')
        .select('strokes, par')
        .eq('round_player_id', hostPlayer.id)
        .eq('hole_number', holeNumber)
        .maybeSingle()
      strokes = score?.strokes ?? null
      par = score?.par ?? null
    }

    memories.push({
      courseId,
      holeNumber,
      roundId: row.round_id,
      bagDiscId: row.bag_disc_id,
      discName: row.disc_name,
      throwStyle: row.throw_style,
      strokes,
      par,
      playedAt: round.ended_at ?? row.created_at,
    })
  }

  return memories
}
