import { supabase } from './supabase'
import { RoundHighlight } from '../types'

export async function listRoundHighlights(roundId: string): Promise<RoundHighlight[]> {
  const { data, error } = await supabase.rpc('list_round_highlights', {
    p_round_id: roundId,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      storage_path: string
      caption: string | null
      created_at: string
      user_id: string
    }[]) ?? []
  ).map(h => ({
    id: h.id,
    storagePath: h.storage_path,
    caption: h.caption,
    createdAt: h.created_at,
    userId: h.user_id,
  }))
}

export async function addRoundHighlightRecord(
  roundId: string,
  storagePath: string,
  caption?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('add_round_highlight', {
    p_round_id: roundId,
    p_storage_path: storagePath,
    p_caption: caption?.trim() || null,
  })
  if (error) throw error
  return String(data)
}

export async function deleteRoundHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_round_highlight', {
    p_highlight_id: highlightId,
  })
  if (error) throw error
}
