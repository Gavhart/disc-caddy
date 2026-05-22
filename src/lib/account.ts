import { supabase } from './supabase'
import { signOut } from './auth'

/** Permanently delete the signed-in user's account and all associated data. */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account')
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
  await signOut()
}
