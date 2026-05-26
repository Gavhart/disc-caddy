import { supabase } from './supabase'
import { PlaybookHole, ThrowStyle } from '../types'

export async function fetchCoursePlaybook(courseId: string): Promise<PlaybookHole[]> {
  const { data, error } = await supabase.rpc('get_course_playbook', {
    p_course_id: courseId,
  })
  if (error) throw error
  return (
    (data as {
      hole_number: number
      par: number | null
      distance: number | null
      bag_disc_id: string | null
      throw_style: ThrowStyle | null
      aim_notes: string | null
      wind_notes: string | null
      strategy: string | null
      hole_note: string | null
      recent_scores: { strokes: number; par: number | null; played_at: string | null }[]
    }[]) ?? []
  ).map(h => ({
    holeNumber: h.hole_number,
    par: h.par,
    distance: h.distance,
    bagDiscId: h.bag_disc_id,
    throwStyle: h.throw_style,
    aimNotes: h.aim_notes,
    windNotes: h.wind_notes,
    strategy: h.strategy,
    holeNote: h.hole_note,
    recentScores: (h.recent_scores ?? []).map(s => ({
      strokes: s.strokes,
      par: s.par,
      playedAt: s.played_at,
    })),
  }))
}

export async function savePlaybookEntry(input: {
  courseId: string
  holeNumber: number
  bagDiscId?: string | null
  throwStyle?: ThrowStyle | null
  aimNotes?: string
  windNotes?: string
  strategy?: string
}): Promise<void> {
  const { error } = await supabase.rpc('upsert_playbook_entry', {
    p_course_id: input.courseId,
    p_hole_number: input.holeNumber,
    p_bag_disc_id: input.bagDiscId ?? null,
    p_throw_style: input.throwStyle ?? null,
    p_aim_notes: input.aimNotes ?? '',
    p_wind_notes: input.windNotes ?? '',
    p_strategy: input.strategy ?? '',
  })
  if (error) throw error
}
