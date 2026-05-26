import { supabase } from './supabase'
import {
  COMMUNITY_EVENT_RADIUS_MILES,
  CommunityEventPostType,
  ScheduledRound,
  ScheduledRoundAttendee,
} from '../types'

type ScheduledRoundRow = {
  id: string
  host_id: string
  host_name: string
  course_id: string | null
  course_name: string | null
  course_locality: string | null
  scheduled_at: string
  max_players: number
  visibility: 'friends' | 'community'
  status: string
  notes: string | null
  round_id: string | null
  post_type: CommunityEventPostType
  distance_miles: number | null
  going_count: number
  my_rsvp: string | null
}

function mapScheduledRound(r: ScheduledRoundRow): ScheduledRound {
  return {
    id: r.id,
    hostId: r.host_id,
    hostName: r.host_name,
    courseId: r.course_id,
    courseName: r.course_name,
    courseLocality: r.course_locality,
    scheduledAt: r.scheduled_at,
    maxPlayers: r.max_players,
    visibility: r.visibility,
    status: r.status,
    notes: r.notes,
    roundId: r.round_id,
    postType: r.post_type ?? 'event',
    distanceMiles: r.distance_miles,
    goingCount: r.going_count,
    myRsvp: r.my_rsvp,
  }
}

export async function listScheduledRounds(
  limit = 30,
  postType?: CommunityEventPostType,
): Promise<ScheduledRound[]> {
  const { data, error } = await supabase.rpc('list_scheduled_rounds', {
    p_limit: limit,
    p_radius_miles: COMMUNITY_EVENT_RADIUS_MILES,
    p_post_type: postType ?? null,
  })
  if (error) throw error
  return ((data as ScheduledRoundRow[]) ?? []).map(mapScheduledRound)
}

export async function listScheduledRoundAttendees(
  scheduledRoundId: string,
): Promise<ScheduledRoundAttendee[]> {
  const { data, error } = await supabase.rpc('list_scheduled_round_attendees', {
    p_scheduled_round_id: scheduledRoundId,
  })
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      status: 'going' | 'maybe'
      created_at: string
    }[]) ?? []
  ).map(r => ({
    userId: r.user_id,
    displayName: r.display_name,
    status: r.status,
    createdAt: r.created_at,
  }))
}

export async function createScheduledRound(input: {
  courseId: string
  scheduledAt: string
  maxPlayers?: number
  visibility?: 'friends' | 'community'
  notes?: string
  postType?: CommunityEventPostType
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_scheduled_round', {
    p_course_id: input.courseId,
    p_scheduled_at: input.scheduledAt,
    p_max_players: input.maxPlayers ?? 4,
    p_visibility: input.visibility ?? 'community',
    p_notes: input.notes ?? '',
    p_post_type: input.postType ?? 'event',
  })
  if (error) throw error
  return String(data)
}

export async function rsvpScheduledRound(
  scheduledRoundId: string,
  status: 'going' | 'maybe' | 'declined',
): Promise<void> {
  const { error } = await supabase.rpc('rsvp_scheduled_round', {
    p_scheduled_round_id: scheduledRoundId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function cancelScheduledRound(scheduledRoundId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_scheduled_round', {
    p_scheduled_round_id: scheduledRoundId,
  })
  if (error) throw error
}
