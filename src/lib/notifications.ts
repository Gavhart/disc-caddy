import { supabase } from './supabase'
import { AppNotification } from '../types'

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notification_count')
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('list_user_notifications', {
    p_limit: limit,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      kind: string
      title: string
      body: string
      link_path: string | null
      metadata: Record<string, unknown>
      read_at: string | null
      created_at: string
    }[]) ?? []
  ).map(r => ({
    id: r.id,
    kind: r.kind as AppNotification['kind'],
    title: r.title,
    body: r.body,
    linkPath: r.link_path,
    metadata: r.metadata ?? {},
    readAt: r.read_at,
    createdAt: r.created_at,
  }))
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
}

export async function setNotifyEmail(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_notify_email', { p_enabled: enabled })
  if (error) throw error
}

/** Fire-and-forget optional email for a notification. */
export function sendNotificationEmail(payload: {
  userId: string
  title: string
  body: string
  linkPath?: string | null
}): void {
  supabase.functions
    .invoke('send-notification-email', {
      body: {
        user_id: payload.userId,
        title: payload.title,
        body: payload.body,
        link_path: payload.linkPath ?? null,
      },
    })
    .catch(err => console.warn('[notifications] email send failed', err))
}

export async function fetchCommunityUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('list_community_messages')
  if (error) return 0
  return (
    (data as { is_inbound: boolean; read_at: string | null }[]) ?? []
  ).filter(m => m.is_inbound && !m.read_at).length
}
