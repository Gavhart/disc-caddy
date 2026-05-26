import { supabase } from './supabase'

export async function fetchHoleNote(
  courseId: string,
  holeNumber: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('course_hole_notes')
    .select('note')
    .eq('course_id', courseId)
    .eq('hole_number', holeNumber)
    .maybeSingle()
  if (error) throw error
  return data?.note ?? null
}

export async function saveHoleNote(
  courseId: string,
  holeNumber: number,
  note: string,
): Promise<void> {
  const trimmed = note.trim()
  if (!trimmed) {
    await deleteHoleNote(courseId, holeNumber)
    return
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to save notes')

  const { error } = await supabase.from('course_hole_notes').upsert(
    {
      user_id: user.id,
      course_id: courseId,
      hole_number: holeNumber,
      note: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_id,hole_number' },
  )
  if (error) throw error
}

export async function deleteHoleNote(
  courseId: string,
  holeNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from('course_hole_notes')
    .delete()
    .eq('course_id', courseId)
    .eq('hole_number', holeNumber)
  if (error) throw error
}
