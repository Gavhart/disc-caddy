import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDiscPhotoUrl } from '../lib/photos'
import { FriendActivity } from '../types'
import { listFriendActivity } from '../lib/roundInvites'
import { formatScoreToPar } from '../lib/rounds'

function ActivityThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    getDiscPhotoUrl(path).then(setUrl)
  }, [path])
  if (!url) return null
  return <img src={url} alt="" className="friend-activity-thumb" />
}

export function FriendActivityFeed() {
  const [items, setItems] = useState<FriendActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listFriendActivity()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="card">
        <h2>Friend activity</h2>
        <p className="muted small">Loading…</p>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="card friend-activity">
      <h2>Friend activity</h2>
      <ul className="friend-activity-list">
        {items.map(item => {
          const place = [item.courseName, item.courseLocality]
            .filter(Boolean)
            .join(', ')
          const when = new Date(item.playedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
          return (
            <li key={`${item.roundId}-${item.userId}`} className="friend-activity-item">
              {item.highlightPath && <ActivityThumb path={item.highlightPath} />}
              <div>
                <strong>{item.displayName}</strong> finished a round
                {place ? (
                  <>
                    {' '}
                    at <span>{place}</span>
                  </>
                ) : null}{' '}
                — {item.totalStrokes} ({formatScoreToPar(item.scoreToPar)}) ·{' '}
                <span className="muted small">{when}</span>
                <Link
                  to={`/rounds/${item.roundId}`}
                  className="link-button friend-activity-link"
                >
                  View
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
