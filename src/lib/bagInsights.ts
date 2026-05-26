import { supabase } from './supabase'
import { BagInsights } from '../types'

export async function fetchBagInsights(bagId: string): Promise<BagInsights> {
  const { data, error } = await supabase.rpc('get_bag_insights', {
    p_bag_id: bagId,
  })
  if (error) throw error
  const d = (data ?? {}) as {
    unused_discs: { id: string; disc_name: string }[]
    top_discs: { disc_name: string; throws: number }[]
    disc_count: number
  }
  return {
    unusedDiscs: (d.unused_discs ?? []).map(x => ({ id: x.id, discName: x.disc_name })),
    topDiscs: (d.top_discs ?? []).map(x => ({ discName: x.disc_name, throws: x.throws })),
    discCount: Number(d.disc_count ?? 0),
  }
}
