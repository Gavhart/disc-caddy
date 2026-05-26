import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchUnreadActivityNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications'
import { AppNotification } from '../types'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface ActivityNotificationsPanelProps {
  title?: string
  onChange?: () => void
}

export function ActivityNotificationsPanel({
  title = 'Updates',
  onChange,
}: ActivityNotificationsPanelProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      setItems(await fetchUnreadActivityNotifications())
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleOpen(item: AppNotification) {
    setBusy(true)
    try {
      await markNotificationRead(item.id)
      await reload()
      onChange?.()
      if (item.linkPath) navigate(item.linkPath)
    } catch {
      // still navigate if mark read failed
      if (item.linkPath) navigate(item.linkPath)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkAll() {
    setBusy(true)
    try {
      await markAllNotificationsRead()
      await reload()
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  if (items.length === 0) return null

  return (
    <section className="card activity-notifications">
      <div className="activity-notifications-head">
        <h2 className="section-title">{title}</h2>
        <button
          type="button"
          className="link-button activity-notifications-clear"
          disabled={busy}
          onClick={handleMarkAll}
        >
          Mark all read
        </button>
      </div>
      <ul className="activity-notifications-list">
        {items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              className="activity-notification-item"
              disabled={busy}
              onClick={() => handleOpen(item)}
            >
              <span className="activity-notification-title">{item.title}</span>
              <span className="activity-notification-body muted small">{item.body}</span>
              <span className="activity-notification-time muted small">{formatWhen(item.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small activity-notifications-hint">
        Event RSVPs, friend activity, and scorecard invites appear here — not in your DM inbox.
      </p>
    </section>
  )
}
