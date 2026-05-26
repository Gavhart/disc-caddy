import { supabase } from './supabase'
import { Friend, FriendRequest } from '../types'

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('list_friends')
  if (error) throw error
  return (
    (data as { user_id: string; display_name: string; email: string }[]) ?? []
  ).map(r => ({
    userId: r.user_id,
    displayName: r.display_name,
    email: r.email,
  }))
}

export async function listIncomingFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('list_incoming_friend_requests')
  if (error) throw error
  return (
    (data as {
      id: string
      from_user_id: string
      display_name: string
      email: string
      created_at: string
    }[]) ?? []
  ).map(r => ({
    id: r.id,
    fromUserId: r.from_user_id,
    displayName: r.display_name,
    email: r.email,
    createdAt: r.created_at,
  }))
}

export async function sendFriendRequest(toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', {
    p_to_user_id: toUserId,
  })
  if (error) throw error
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  })
  if (error) throw error
}

export async function removeFriend(friendUserId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', {
    p_friend_user_id: friendUserId,
  })
  if (error) throw error
}
