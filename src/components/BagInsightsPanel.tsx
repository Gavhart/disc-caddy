import { useEffect, useState } from 'react'
import { fetchBagInsights } from '../lib/bagInsights'
import { BagInsights } from '../types'

interface Props {
  bagId: string | null
}

export function BagInsightsPanel({ bagId }: Props) {
  const [insights, setInsights] = useState<BagInsights | null>(null)

  useEffect(() => {
    if (!bagId) {
      setInsights(null)
      return
    }
    fetchBagInsights(bagId)
      .then(setInsights)
      .catch(() => setInsights(null))
  }, [bagId])

  if (!insights) return null

  return (
    <div className="card bag-insights">
      <h3>Bag insights</h3>
      {insights.topDiscs.length > 0 && (
        <>
          <p className="muted small">Most thrown in logged rounds</p>
          <ul className="bag-insights-top">
            {insights.topDiscs.map(d => (
              <li key={d.discName}>
                {d.discName} · {d.throws} throws
              </li>
            ))}
          </ul>
        </>
      )}
      {insights.unusedDiscs.length > 0 && (
        <>
          <p className="muted small">Never logged on a round — consider swapping out</p>
          <div className="bag-insights-unused">
            {insights.unusedDiscs.slice(0, 8).map(d => (
              <span key={d.id} className="pill small">
                {d.discName}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
