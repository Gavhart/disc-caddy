import { supabase } from './supabase'
import { OnboardingInput, completeOnboarding } from './profile'

export type SignUpProfile = OnboardingInput

export async function signUp(
  email: string,
  password: string,
  profile: SignUpProfile,
) {
  const throwsForehand = profile.primaryThrow === 'forehand'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: profile.displayName.trim(),
        max_distance: profile.maxDistance,
        dominant_hand: profile.dominantHand,
        primary_throw: profile.primaryThrow,
        throws_forehand: throwsForehand,
        onboarding_complete: true,
      },
    },
  })
  if (error) throw error

  if (data.session?.user) {
    await completeOnboarding(data.session.user.id, profile)
  }

  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}
