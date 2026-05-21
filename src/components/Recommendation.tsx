import { Recommendation as Rec } from '../types'

interface Props {
  recommendations: Rec[]
}

function styleLabel(style: Rec['throwStyle']): string {
  return style === 'forehand' ? 'Forehand' : 'Backhand'
}

export function Recommendation({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <section className="card">
        <h2>Recommendation</h2>
        <p className="muted">Add discs to your bag to see recommendations.</p>
      </section>
    )
  }

  const top = recommendations[0]

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
        <div className="pick-flight">
          Eff flight: <strong>{top.effTurn.toFixed(1)}</strong> /{' '}
          <strong>{top.effFade.toFixed(1)}</strong>
          <span className="dot">·</span>
          Stability <strong>{top.stability.toFixed(1)}</strong>
          <span className="dot">·</span>
          Distance <strong>{top.effDistance} ft</strong>
        </div>
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
