import { supabase } from './supabase'
import { Hand, Me } from '../types'

/** Fetch the current user's profile via the 'me' SQL view. */
export async function fetchMe(): Promise<Me | null> {
  const { data, error } = await supabase
    .from('me')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    email: data.email,
    maxDistance: data.max_distance,
    dominantHand: (data.dominant_hand ?? 'right') as Hand,
    throwsForehand: Boolean(data.throws_forehand),
    forehandMaxDistance: data.forehand_max_distance ?? data.max_distance,
    subscriptionTier: data.subscription_tier,
    subscriptionStatus: data.subscription_status,
    subscriptionPeriodEnd: data.subscription_period_end,
    isPro: data.is_pro,
  }
}

/** Update the player's max distance setting. */
export async function updateMaxDistance(userId: string, maxDistance: number) {
  const { error } = await supabase
    .from('profiles')
    .update({ max_distance: maxDistance, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export interface PlayerPatch {
  dominantHand?: Hand
  throwsForehand?: boolean
  /** Set to null to clear the override (derives from max_distance instead). */
  forehandMaxDistance?: number | null
}

/** Update player handedness / forehand fields. */
export async function updatePlayer(userId: string, patch: PlayerPatch) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.dominantHand !== undefined) update.dominant_hand = patch.dominantHand
  if (patch.throwsForehand !== undefined)
    update.throws_forehand = patch.throwsForehand
  if (patch.forehandMaxDistance !== undefined)
    update.forehand_max_distance = patch.forehandMaxDistance

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
  if (error) throw error
}
