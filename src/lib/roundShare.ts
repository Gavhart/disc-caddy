import { supabase } from './supabase'
import { PublicRoundRecap } from '../types'

export async function createRoundShareLink(roundId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_round_share_link', {
    p_round_id: roundId,
  })
  if (error) throw error
  return String(data)
}

export async function fetchPublicRoundRecap(
  token: string,
): Promise<PublicRoundRecap | null> {
  const { data, error } = await supabase.rpc('get_public_round_recap', {
    p_token: token,
  })
  if (error) throw error
  if (!data) return null
  const row = data as {
    course_name: string | null
    course_locality: string | null
    played_at: string | null
    status: string
    players: {
      display_name: string
      total_strokes: number
      total_par: number
      score_to_par: number
      holes_scored: number
    }[]
  }
  return {
    courseName: row.course_name,
    courseLocality: row.course_locality,
    playedAt: row.played_at,
    status: row.status,
    players: row.players ?? [],
  }
}

export function roundShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`
}
