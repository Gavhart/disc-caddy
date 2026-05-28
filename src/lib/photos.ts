import { supabase } from './supabase'

const BUCKET = 'disc-photos'

/**
 * Upload a disc photo. Returns the storage object path
 * (e.g. "<userId>/<discId>-<timestamp>.jpg").
 */
export async function uploadDiscPhoto(
  userId: string,
  discId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${discId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })
  if (error) throw error
  return path
}

/** Returns a signed URL for a private photo (valid 1 hour). */
export async function getDiscPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) {
    console.warn('[photos] signed url failed', error)
    return null
  }
  return data.signedUrl
}

/** Upload a round highlight photo. Returns the storage object path. */
export async function uploadRoundHighlight(
  userId: string,
  roundId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/highlights/${roundId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
  if (error) throw error
  return path
}

/** Upload a profile avatar. Returns the storage object path. */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })
  if (error) throw error
  return path
}

export async function deleteDiscPhoto(path: string): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
