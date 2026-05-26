import { useCallback, useEffect, useState } from 'react'
import {
  fetchCommunityUnreadCount,
  fetchUnreadNotificationCount,
} from '../lib/notifications'

export function useAppNotifications(enabled: boolean) {
  const [notificationCount, setNotificationCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNotificationCount(0)
      setMessageCount(0)
      return
    }
    try {
      const [notif, msgs] = await Promise.all([
        fetchUnreadNotificationCount(),
        fetchCommunityUnreadCount(),
      ])
      setNotificationCount(notif)
      setMessageCount(msgs)
    } catch {
      // tables/RPCs may not exist until migration 024
    }
  }, [enabled])

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [refresh])

  return {
    notificationCount,
    messageCount,
    communityBadgeCount: notificationCount + messageCount,
    refresh,
  }
}
