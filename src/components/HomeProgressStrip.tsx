import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPlayerStatsSummary, listPlayerBadges } from '../lib/progression'
import { formatScoreToPar } from '../lib/rounds'

export function HomeProgressStrip() {
  const [badgeCount, setBadgeCount] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [birdies, setBirdies] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchPlayerStatsSummary(), listPlayerBadges()])
      .then(([stats, badges]) => {
        if (!mounted) return
        setRounds(stats.roundsCompleted)
        setBirdies(stats.birdies)
        setBest(stats.bestScoreToPar)
        setBadgeCount(badges.length)
      })
      .catch(() => {
        if (!mounted) return
        setBadgeCount(0)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return null
  if (rounds === 0 && badgeCount === 0) return null

  return (
    <Link to="/profile" className="card home-progress-strip">
      <div className="home-progress-strip-head">
        <strong>Your progress</strong>
        <span className="home-progress-strip-link muted small">Profile →</span>
      </div>
      <div className="home-progress-strip-stats">
        <div>
          <span className="home-progress-value">{rounds}</span>
          <span className="muted small">Rounds</span>
        </div>
        <div>
          <span className="home-progress-value">{birdies}</span>
          <span className="muted small">Birdies</span>
        </div>
        <div>
          <span className="home-progress-value">
            {best != null ? formatScoreToPar(best) : '—'}
          </span>
          <span className="muted small">Best</span>
        </div>
        <div>
          <span className="home-progress-value">{badgeCount}</span>
          <span className="muted small">Badges</span>
        </div>
      </div>
    </Link>
  )
}
