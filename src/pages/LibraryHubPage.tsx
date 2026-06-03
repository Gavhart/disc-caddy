import { PageHeader } from '../components/PageHeader'
import { HubCard } from '../components/HubCard'

export function LibraryHubPage() {
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
          description="Trends, birdies, and disc performance."
        />
        <HubCard
          to="/practice"
          icon="🏟️"
          title="Field practice"
          description="Throw in a field, measure distance per disc, and spot gaps in your bag."
        />
        <HubCard
          to="/playbook"
          icon="📖"
          title="Course playbook"
          description="Hole notes, strategy, and your scoring history per course."
        />
      </div>
    </div>
  )
}
