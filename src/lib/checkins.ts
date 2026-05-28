import { supabase } from './supabase'
import { CourseCheckin, MyCourseCheckin } from '../types'

export async function checkInCourse(courseId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('check_in_course', {
    p_course_id: courseId,
    p_note: note?.trim() || null,
  })
  if (error) throw error
}

export async function clearCourseCheckin(): Promise<void> {
  const { error } = await supabase.rpc('clear_course_checkin')
  if (error) throw error
}

export async function getMyCourseCheckin(): Promise<MyCourseCheckin | null> {
  const { data, error } = await supabase.rpc('get_my_course_checkin')
  if (error) throw error
  if (!data) return null
  const row = data as {
    course_id: string
    course_name: string
    course_locality: string | null
    note: string | null
    checked_in_at: string
  }
  return {
    courseId: row.course_id,
    courseName: row.course_name,
    courseLocality: row.course_locality,
    note: row.note,
    checkedInAt: row.checked_in_at,
  }
}

export async function listPlayingToday(limit = 30): Promise<CourseCheckin[]> {
  const { data, error } = await supabase.rpc('list_playing_today', { p_limit: limit })
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      course_id: string
      course_name: string
      course_locality: string | null
      note: string | null
      checked_in_at: string
    }[]) ?? []
  ).map(c => ({
    userId: c.user_id,
    displayName: c.display_name,
    courseId: c.course_id,
    courseName: c.course_name,
    courseLocality: c.course_locality,
    note: c.note,
    checkedInAt: c.checked_in_at,
  }))
}
