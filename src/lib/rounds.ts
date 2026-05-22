import { supabase } from './supabase'
import { RoundThrow, ThrowStyle } from '../types'

interface RoundRow {
  id: string
  user_id: string
  course_id: string | null
  bag_id: string | null
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed'
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

export async function startRound(input: {
  courseId: string
  bagId: string
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
  if (error) throw error
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
  recommendedRank: number
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

export async function getActiveRound(): Promise<RoundRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as RoundRow | null
}
