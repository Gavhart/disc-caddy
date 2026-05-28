import { useMemo } from 'react'
import { DEMO_BAG, DEMO_COURSE_LABEL, DEMO_HOLE, DEMO_PLAYER } from '../data/demoHole'
import { recommend } from '../lib/recommend'

function releaseLabel(release: 'hyzer' | 'flat' | 'anhyzer'): string {
  if (release === 'hyzer') return 'Hyzer'
  if (release === 'anhyzer') return 'Anhyzer'
  return 'Flat'
}

export function CaddyDemoPreview() {
  const recommendations = useMemo(
    () =>
      recommend({
        bag: DEMO_BAG,
        hole: DEMO_HOLE,
        playerMaxDistance: DEMO_PLAYER.maxDistance,
        playerPutterDistance: DEMO_PLAYER.putterMaxDistance,
        playerMidrangeDistance: DEMO_PLAYER.midrangeMaxDistance,
        playerFairwayDistance: DEMO_PLAYER.fairwayMaxDistance,
        playerForehandDistance: DEMO_PLAYER.forehandMaxDistance,
        hand: DEMO_PLAYER.hand,
        throwsForehand: DEMO_PLAYER.throwsForehand,
        primaryThrow: DEMO_PLAYER.primaryThrow,
      }),
    [],
  )

  const top = recommendations[0]
  if (!top) return null

  return (
    <section className="card caddy-demo-preview" aria-label="Sample Caddy recommendation">
      <div className="caddy-demo-header">
        <span className="caddy-demo-badge">Live demo</span>
        <h2>See how Caddy thinks</h2>
        <p className="muted small">{DEMO_COURSE_LABEL}</p>
      </div>

      <div className="top-pick caddy-demo-top-pick">
        <div className="pick-label">TOP PICK</div>
        <div className="pick-disc">{top.bagDisc.discName}</div>
        <div className="pick-meta">
          Backhand · {releaseLabel(top.release)} · {top.effDistance} ft carry
        </div>
        <p className="pick-explanation">{top.explanation}</p>
        {top.explanationSections.slice(0, 2).map(section => (
          <div key={section.title} className="explanation-section">
            <strong>{section.title}</strong>
            <p className="muted small">{section.body}</p>
          </div>
        ))}
      </div>

      <div className="caddy-demo-alts">
        <h3 className="caddy-demo-alts-title">Also in the bag</h3>
        <ul className="caddy-demo-alt-list">
          {recommendations.slice(1, 4).map(r => (
            <li key={r.bagDisc.id}>
              <span className="caddy-demo-alt-rank">#{r.rank}</span>
              <span>{r.bagDisc.discName}</span>
              <span className="muted small">
                {releaseLabel(r.release)} · {r.effDistance} ft
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="muted small caddy-demo-footnote">
        Sample bag and hole — sign up to use your real discs, distances, and course holes.
      </p>
    </section>
  )
}
