import { PageHeader } from '../components/PageHeader'
import { HubCard } from '../components/HubCard'
import { ActivityNotificationsPanel } from '../components/ActivityNotificationsPanel'
import { useAuth } from '../contexts/AuthContext'
import { useAppNotifications } from '../hooks/useAppNotifications'

export function NotificationsPage() {
  const { me } = useAuth()
  const { messageCount, notificationCount, refresh } = useAppNotifications(Boolean(me))

  return (
    <div className="container notifications-page">
      <PageHeader
        title="Notifications"
        description="Messages, nearby events, friend activity, and scorecard updates."
      />

      <ActivityNotificationsPanel title="Recent updates" onChange={refresh} />

      <div className="notifications-quick-links">
        <h2 className="section-title">Go to</h2>
        <div className="hub-grid">
          <HubCard
            to="/community/messages"
            icon="💬"
            title="Messages"
            description="Direct conversations with players in your area."
            badge={messageCount}
          />
          <HubCard
            to="/community/events"
            icon="📅"
            title="Events near you"
            description="Pickup rounds and group events within 75 miles."
          />
          <HubCard
            to="/social"
            icon="👥"
            title="Social hub"
            description="Find players, leagues, and community settings."
            badge={notificationCount > 0 && messageCount === 0 ? notificationCount : undefined}
          />
        </div>
      </div>
    </div>
  )
}
