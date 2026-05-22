import { Link } from 'react-router-dom'
import { Recommendation as Rec } from '../types'

interface Props {
  recommendations: Rec[]
  roundActive?: boolean
  isPro?: boolean
  loggedHoleNumber?: number | null
  currentHoleNumber?: number | null
  onLogThrow?: (rec: Rec) => Promise<void>
}

function styleLabel(style: Rec['throwStyle']): string {
  return style === 'forehand' ? 'Forehand' : 'Backhand'
}

export function Recommendation({
  recommendations,
  roundActive = false,
  isPro = false,
  loggedHoleNumber = null,
  currentHoleNumber = null,
  onLogThrow,
}: Props) {
  if (recommendations.length === 0) {
    return (
      <section className="card">
        <h2>Recommendation</h2>
        <p className="muted">Add discs to your bag to see recommendations.</p>
      </section>
    )
  }

  const top = recommendations[0]
  const alreadyLogged =
    loggedHoleNumber != null &&
    currentHoleNumber != null &&
    loggedHoleNumber === currentHoleNumber

  return (
    <section className="card recommendation">
      <h2>Recommendation</h2>
      <div className="top-pick">
        <div className="pick-label">★ TOP PICK</div>
        <div className="pick-disc">
          {top.bagDisc.discName}
          <span className="pill small pick-throw">{styleLabel(top.throwStyle)}</span>
        </div>
        <div className="pick-detail">
          {top.bagDisc.plastic} · {top.bagDisc.weight} wt · {top.bagDisc.wear}
        </div>
        <div className="pick-rationale">{top.explanation}</div>

        {top.explanationSections.length > 0 && (
          <div className="pick-sections">
            {top.explanationSections.map(section => (
              <div key={section.title} className="pick-section">
                <div className="pick-section-title">{section.title}</div>
                <div className="pick-section-body">{section.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className="pick-flight">
          Eff flight: <strong>{top.effTurn.toFixed(1)}</strong> /{' '}
          <strong>{top.effFade.toFixed(1)}</strong>
          <span className="dot">·</span>
          Stability <strong>{top.stability.toFixed(1)}</strong>
          <span className="dot">·</span>
          Distance <strong>{top.effDistance} ft</strong>
          {top.aimOffsetFt != null && top.aimOffsetFt !== 0 && (
            <>
              <span className="dot">·</span>
              Aim{' '}
              <strong>
                {Math.abs(top.aimOffsetFt)} ft {top.aimOffsetFt < 0 ? 'left' : 'right'}
              </strong>
            </>
          )}
        </div>

        {roundActive && onLogThrow && (
          <div className="pick-actions">
            {isPro ? (
              alreadyLogged ? (
                <span className="pill small">Logged for this hole ✓</span>
              ) : (
                <button
                  type="button"
                  className="btn-primary pick-log-btn"
                  onClick={() => onLogThrow(top)}
                >
                  Log this throw
                </button>
              )
            ) : (
              <p className="muted small">
                <Link to="/upgrade" className="link-button">
                  Upgrade to Pro
                </Link>{' '}
                to log throws during a live round.
              </p>
            )}
          </div>
        )}
      </div>
      {recommendations.length > 1 && (
        <details className="alternatives" open>
          <summary>All picks ranked</summary>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Disc</th>
                <th>Throw</th>
                <th>Stab</th>
                <th>Dist</th>
                <th>Pick</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map(r => (
                <tr key={r.bagDisc.id} className={r.rank <= 3 ? 'ranked' : ''}>
                  <td>{r.rank}</td>
                  <td>
                    <div>{r.bagDisc.discName}</div>
                    <div className="muted small">
                      {r.bagDisc.plastic} · {r.bagDisc.wear}
                    </div>
                  </td>
                  <td>{styleLabel(r.throwStyle)}</td>
                  <td>{r.stability.toFixed(2)}</td>
                  <td>{r.effDistance}</td>
                  <td>{r.pick ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  )
}
