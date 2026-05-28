import { PageHeader } from '../components/PageHeader'
import { HubCard } from '../components/HubCard'
import { ActivityNotificationsPanel } from '../components/ActivityNotificationsPanel'
import { PlayingTodayPanel } from '../components/PlayingTodayPanel'
import { useAuth } from '../contexts/AuthContext'
import { useAppNotifications } from '../hooks/useAppNotifications'

export function SocialHubPage() {
  const { session, me } = useAuth()
  const { messageCount, refresh } = useAppNotifications(Boolean(session && me))

  return (
    <div className="container hub-page">
      <PageHeader
        title="Social"
        description="Find players, join events, message your group, and compete in leagues."
      />

      <ActivityNotificationsPanel onChange={refresh} />

      <PlayingTodayPanel />

      <div className="hub-grid">
        <HubCard
          to="/community"
          icon="👥"
          title="Find players"
          description="Set home areas, browse nearby players, and opt in to connect."
        />
        <HubCard
          to="/community/events"
          icon="📅"
          title="Events & pickup rounds"
          description="Post tee times or say you want people to play with you within 75 miles."
        />
        <HubCard
          to="/community/messages"
          icon="💬"
          title="Messages"
          description="Inbox for conversations with players in your area."
          badge={messageCount}
        />
        <HubCard
          to="/leagues"
          icon="🏆"
          title="Leagues"
          description="Season standings with friends — rounds auto-submit when you finish."
        />
      </div>
    </div>
  )
}
