import { Link } from 'react-router-dom'

const FEATURES = [
  {
    id: 'rec',
    title: 'Smart disc picks',
    caption: 'Top pick + ranked bag for every hole',
    mock: 'recommend' as const,
  },
  {
    id: 'score',
    title: 'Live scorecards',
    caption: 'Group rounds — everyone updates their line',
    mock: 'scorecard' as const,
  },
  {
    id: 'league',
    title: 'League standings',
    caption: 'Season boards, pair shuffle, rivalries',
    mock: 'league' as const,
  },
  {
    id: 'badges',
    title: 'Badges & progress',
    caption: 'Earn milestones from rounds and leagues',
    mock: 'badges' as const,
  },
]

function RecommendMock() {
  return (
    <div className="ui-mock ui-mock-rec" aria-hidden>
      <div className="ui-mock-label">TOP PICK</div>
      <div className="ui-mock-disc">Buzzz</div>
      <div className="ui-mock-sub">Backhand · Hyzer · 285 ft</div>
      <div className="ui-mock-bar" />
      <div className="ui-mock-bar short" />
    </div>
  )
}

function ScorecardMock() {
  return (
    <div className="ui-mock ui-mock-score" aria-hidden>
      <div className="ui-mock-score-head">
        <span>Hole 7</span>
        <span className="ui-mock-par">Par 3</span>
      </div>
      <div className="ui-mock-score-row">
        <span>You</span>
        <span className="ui-mock-strokes">3</span>
      </div>
      <div className="ui-mock-score-row muted">
        <span>Partner</span>
        <span className="ui-mock-strokes">2</span>
      </div>
    </div>
  )
}

function LeagueMock() {
  return (
    <div className="ui-mock ui-mock-league" aria-hidden>
      <div className="ui-mock-podium">
        <div className="ui-mock-podium-slot second">2</div>
        <div className="ui-mock-podium-slot first">1</div>
        <div className="ui-mock-podium-slot third">3</div>
      </div>
      <div className="ui-mock-team">Chain Lightning · -4 avg</div>
    </div>
  )
}

function BadgesMock() {
  return (
    <div className="ui-mock ui-mock-badges" aria-hidden>
      <span className="ui-mock-badge">🥏</span>
      <span className="ui-mock-badge">🔥</span>
      <span className="ui-mock-badge">🏆</span>
      <span className="ui-mock-badge dim">⭐</span>
    </div>
  )
}

function Mock({ kind }: { kind: 'recommend' | 'scorecard' | 'league' | 'badges' }) {
  if (kind === 'recommend') return <RecommendMock />
  if (kind === 'scorecard') return <ScorecardMock />
  if (kind === 'league') return <LeagueMock />
  return <BadgesMock />
}

export function AppFeatureShowcase({ showRoadmapLink = true }: { showRoadmapLink?: boolean }) {
  return (
    <section className="feature-showcase">
      <h2 className="feature-showcase-title">What you get</h2>
      <div className="feature-showcase-grid">
        {FEATURES.map(f => (
          <article key={f.id} className="feature-showcase-card">
            <Mock kind={f.mock} />
            <h3>{f.title}</h3>
            <p className="muted small">{f.caption}</p>
          </article>
        ))}
      </div>
      {showRoadmapLink && (
        <p className="feature-showcase-roadmap muted small">
          <Link to="/updates">See the full roadmap</Link> — shipped, in progress, and coming soon.
        </p>
      )}
    </section>
  )
}
