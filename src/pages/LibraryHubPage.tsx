import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { HubCard } from '../components/HubCard'
import { useAuth } from '../contexts/AuthContext'

export function LibraryHubPage() {
  const { me } = useAuth()

  return (
    <div className="container hub-page">
      <PageHeader
        title="Library"
        description="Your bags, courses, round history, stats, and course strategy."
      />

      <div className="hub-grid">
        <HubCard
          to="/bags"
          icon="🎒"
          title="My bags"
          description="Build bags, manage discs, and see bag insights."
        />
        <HubCard
          to="/courses"
          icon="🗺️"
          title="Courses"
          description="Browse courses, edit holes, and explore the map."
        />
        <HubCard
          to="/rounds"
          icon="📋"
          title="Round history"
          description="Past scorecards, leaderboards, and round details."
        />
        <HubCard
          to="/stats"
          icon="📈"
          title="Player stats"
          description={
            me?.isPro
              ? 'Trends, birdies, and disc performance.'
              : 'Pro — scoring trends and disc analytics.'
          }
        />
        <HubCard
          to="/playbook"
          icon="📖"
          title="Course playbook"
          description="Hole notes, strategy, and your scoring history per course."
        />
      </div>

      {!me?.isPro && (
        <p className="hub-footnote muted small">
          Several library tools are free.{' '}
          <Link to="/upgrade">Upgrade to Pro</Link> for stats, messaging, and more.
        </p>
      )}
    </div>
  )
}
