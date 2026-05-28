import { useEffect, useState } from 'react'
import { fetchActiveChallenges, refreshChallengeProgress } from '../lib/challenges'
import { refreshProgression } from '../lib/progression'
import { Challenge } from '../types'

export function WeeklyChallengesPanel() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshChallengeProgress()
      .then(() => refreshProgression())
      .then(() => fetchActiveChallenges())
      .then(setChallenges)
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (challenges.length === 0) return null

  return (
    <div className="card weekly-challenges">
      <h2>Weekly challenges</h2>
      <ul className="challenge-list">
        {challenges.map(c => {
          const pct = Math.min(100, Math.round((c.progress / c.targetValue) * 100))
          const done = c.completedAt != null
          return (
            <li key={c.id} className={done ? 'challenge-done' : undefined}>
              <div className="challenge-header">
                <strong>{c.title}</strong>
                {done && <span className="pill small pill-pro">Done</span>}
              </div>
              <p className="muted small">{c.description}</p>
              <div className="challenge-progress-bar">
                <div className="challenge-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="muted small">
                {c.progress}/{c.targetValue}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
