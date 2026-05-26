import { PageHeader } from '../components/PageHeader'
import { HubCard } from '../components/HubCard'
import { useAuth } from '../contexts/AuthContext'
import { useAppNotifications } from '../hooks/useAppNotifications'

export function SocialHubPage() {
  const { session, me } = useAuth()
  const { communityBadgeCount } = useAppNotifications(Boolean(session && me))

  return (
    <div className="container hub-page">
      <PageHeader
        title="Social"
        description="Find players, join events, message your group, and compete in leagues."
      />

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
          badge={communityBadgeCount}
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
