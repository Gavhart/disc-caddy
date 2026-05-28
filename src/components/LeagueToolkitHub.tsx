import { HubCard } from './HubCard'

/** Quick links from a league to tools that already exist in the app. */
export function LeagueToolkitHub() {
  return (
    <div className="league-toolkit">
      <h3>League toolkit</h3>
      <p className="muted small">Jump to live scoring, events, stats, courses, and messages.</p>
      <div className="hub-grid">
        <HubCard
          to="/rounds"
          icon="🎯"
          title="Live scorecards"
          description="Start or join a group round with live leaderboards."
        />
        <HubCard
          to="/community/events"
          icon="📅"
          title="Schedule events"
          description="League nights, pickup rounds, and tee times."
        />
        <HubCard
          to="/stats"
          icon="📈"
          title="Player stats"
          description="Season trends, birdies, and performance by disc."
        />
        <HubCard
          to="/library"
          icon="📋"
          title="Round history"
          description="Past scorecards to submit to this league."
        />
        <HubCard
          to="/courses"
          icon="🗺️"
          title="Courses & maps"
          description="Layouts, hole edits, and course discovery."
        />
        <HubCard
          to="/community/messages"
          icon="💬"
          title="Messages"
          description="Coordinate pairings and league chat with members."
        />
      </div>
    </div>
  )
}
