import { supabase } from './supabase'
import { RoundInvite, FriendActivity } from '../types'
import { sendNotificationEmail } from './notifications'

export async function invitePlayerToRound(
  roundId: string,
  inviteeId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('invite_player_to_round', {
    p_round_id: roundId,
    p_invitee_id: inviteeId,
  })
  if (error) throw error

  sendNotificationEmail({
    userId: inviteeId,
    title: 'Scorecard invite on Disc Caddy',
    body: 'A friend invited you to join their live scorecard.',
    linkPath: '/',
  })

  void data
}

export async function respondRoundInvite(
  inviteId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_round_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  })
  if (error) throw error
}

export async function listPendingRoundInvites(): Promise<RoundInvite[]> {
  const { data, error } = await supabase.rpc('list_pending_round_invites')
  if (error) throw error
  return (
    (data as {
      id: string
      round_id: string
      inviter_name: string
      course_name: string | null
      course_id: string | null
      created_at: string
    }[]) ?? []
  ).map(r => ({
    id: r.id,
    roundId: r.round_id,
    inviterName: r.inviter_name,
    courseName: r.course_name,
    courseId: r.course_id,
    createdAt: r.created_at,
  }))
}

export async function setRoundHostScoringOnly(
  roundId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_round_host_scoring_only', {
    p_round_id: roundId,
    p_enabled: enabled,
  })
  if (error) throw error
}

export async function fetchRoundHostScoringOnly(roundId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rounds')
    .select('host_scoring_only')
    .eq('id', roundId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.host_scoring_only)
}

export async function notifyFriendsRoundCompleted(roundId: string): Promise<void> {
  const { error } = await supabase.rpc('notify_friends_round_completed', {
    p_round_id: roundId,
  })
  if (error) console.warn('[rounds] friend activity notify failed', error)
}

export async function listFriendActivity(limit = 15): Promise<FriendActivity[]> {
  const { data, error } = await supabase.rpc('list_friend_activity', {
    p_limit: limit,
  })
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      course_name: string | null
      course_locality: string | null
      score_to_par: number
      total_strokes: number
      played_at: string
      round_id: string
    }[]) ?? []
  ).map(r => ({
    userId: r.user_id,
    displayName: r.display_name,
    courseName: r.course_name,
    courseLocality: r.course_locality,
    scoreToPar: r.score_to_par,
    totalStrokes: r.total_strokes,
    playedAt: r.played_at,
    roundId: r.round_id,
  }))
}
