import { supabase } from './supabase'

/** Subscribe to live scorecard updates for a group round. */
export function subscribeRoundUpdates(
  roundId: string,
  onUpdate: () => void,
): () => void {
  const channel = supabase
    .channel(`round-live:${roundId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'round_scores',
        filter: `round_id=eq.${roundId}`,
      },
      () => onUpdate(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'round_players',
        filter: `round_id=eq.${roundId}`,
      },
      () => onUpdate(),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `id=eq.${roundId}`,
      },
      () => onUpdate(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
