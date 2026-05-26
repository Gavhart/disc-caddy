import { supabase } from './supabase'
import { FriendHeadToHead } from '../types'

export async function fetchFriendHeadToHead(
  friendUserId: string,
): Promise<FriendHeadToHead> {
  const { data, error } = await supabase.rpc('get_friend_head_to_head', {
    p_friend_user_id: friendUserId,
  })
  if (error) throw error
  const d = (data ?? {}) as {
    you: { rounds: number; avg_score_to_par: number | null; best_score_to_par: number | null }
    friend: { rounds: number; avg_score_to_par: number | null; best_score_to_par: number | null }
    shared_courses: {
      course_id: string
      course_name: string
      your_avg: number | null
      friend_avg: number | null
    }[]
  }
  const mapSide = (s: typeof d.you) => ({
    rounds: Number(s?.rounds ?? 0),
    avgScoreToPar: s?.avg_score_to_par ?? null,
    bestScoreToPar: s?.best_score_to_par ?? null,
  })
  return {
    you: mapSide(d.you),
    friend: mapSide(d.friend),
    sharedCourses: (d.shared_courses ?? []).map(c => ({
      courseId: c.course_id,
      courseName: c.course_name,
      yourAvg: c.your_avg,
      friendAvg: c.friend_avg,
    })),
  }
}
