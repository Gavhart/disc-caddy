import { supabase } from './supabase'
import { Hand, Me, ThrowStyle } from '../types'

/** Player info collected at signup or on the welcome screen. */
export interface OnboardingInput {
  displayName: string
  maxDistance: number
  dominantHand: Hand
  primaryThrow: ThrowStyle
}

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
    displayName: data.display_name ?? null,
    onboardingComplete: Boolean(data.onboarding_complete ?? true),
    maxDistance: data.max_distance,
    putterMaxDistance: data.putter_max_distance ?? Math.round(data.max_distance * 0.5),
    midrangeMaxDistance: data.midrange_max_distance ?? Math.round(data.max_distance * 0.7),
    fairwayMaxDistance: data.fairway_max_distance ?? Math.round(data.max_distance * 0.85),
    dominantHand: (data.dominant_hand ?? 'right') as Hand,
    throwsForehand: Boolean(data.throws_forehand),
    // `primary_throw` lives behind migration 007. Fall back to backhand when
    // the column / view is older so the app stays functional pre-migration.
    primaryThrow: (data.primary_throw ?? 'backhand') as ThrowStyle,
    forehandMaxDistance: data.forehand_max_distance ?? data.max_distance,
    subscriptionTier: data.subscription_tier,
    subscriptionStatus: data.subscription_status,
    subscriptionPeriodEnd: data.subscription_period_end,
    isPro: data.is_pro,
  }
}

/** Save signup / welcome profile and mark onboarding complete. */
export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const throwsForehand = input.primaryThrow === 'forehand'
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim(),
      max_distance: input.maxDistance,
      dominant_hand: input.dominantHand,
      primary_throw: input.primaryThrow,
      throws_forehand: throwsForehand,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
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
  displayName?: string | null
  dominantHand?: Hand
  throwsForehand?: boolean
  /** Preferred release. Setting to 'forehand' implicitly enables forehand
   *  even if `throwsForehand` was not also set in the same patch. */
  primaryThrow?: ThrowStyle
  /** Set to null to clear the override (derives from max_distance instead). */
  forehandMaxDistance?: number | null
  /** Per-type max distances. Set to null to clear (derives from max_distance). */
  putterMaxDistance?: number | null
  midrangeMaxDistance?: number | null
  fairwayMaxDistance?: number | null
}

/** Update player handedness / forehand fields. */
export async function updatePlayer(userId: string, patch: PlayerPatch) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.displayName !== undefined) update.display_name = patch.displayName
  if (patch.dominantHand !== undefined) update.dominant_hand = patch.dominantHand
  if (patch.throwsForehand !== undefined)
    update.throws_forehand = patch.throwsForehand
  if (patch.primaryThrow !== undefined) {
    update.primary_throw = patch.primaryThrow
    // Picking forehand as the primary release without also flipping the
    // "I throw forehand" bit would yield a profile the recommender can't
    // honor (FH attempts gated off). Force them in lockstep here so the
    // UI doesn't have to remember to do it everywhere.
    if (patch.primaryThrow === 'forehand' && patch.throwsForehand === undefined) {
      update.throws_forehand = true
    }
  }
  if (patch.forehandMaxDistance !== undefined)
    update.forehand_max_distance = patch.forehandMaxDistance
  if (patch.putterMaxDistance !== undefined)
    update.putter_max_distance = patch.putterMaxDistance
  if (patch.midrangeMaxDistance !== undefined)
    update.midrange_max_distance = patch.midrangeMaxDistance
  if (patch.fairwayMaxDistance !== undefined)
    update.fairway_max_distance = patch.fairwayMaxDistance

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
  if (error) throw error
}
