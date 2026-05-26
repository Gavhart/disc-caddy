import { useEffect, useState } from 'react'
import { fetchFriendHeadToHead } from '../lib/headToHead'
import { formatScoreToPar } from '../lib/rounds'
import { FriendHeadToHead } from '../types'

interface Props {
  friendUserId: string
  friendName: string
  onClose: () => void
}

export function FriendHeadToHeadModal({ friendUserId, friendName, onClose }: Props) {
  const [data, setData] = useState<FriendHeadToHead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFriendHeadToHead(friendUserId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [friendUserId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal-panel" onClick={e => e.stopPropagation()}>
        <h2>You vs {friendName}</h2>
        {loading && <p className="muted">Loading…</p>}
        {data && (
          <>
            <div className="h2h-grid">
              <div>
                <strong>You</strong>
                <p>{data.you.rounds} rounds</p>
                <p>
                  Avg{' '}
                  {data.you.avgScoreToPar != null
                    ? formatScoreToPar(data.you.avgScoreToPar)
                    : '—'}
                </p>
                <p>
                  Best{' '}
                  {data.you.bestScoreToPar != null
                    ? formatScoreToPar(data.you.bestScoreToPar)
                    : '—'}
                </p>
              </div>
              <div>
                <strong>{friendName}</strong>
                <p>{data.friend.rounds} rounds</p>
                <p>
                  Avg{' '}
                  {data.friend.avgScoreToPar != null
                    ? formatScoreToPar(data.friend.avgScoreToPar)
                    : '—'}
                </p>
                <p>
                  Best{' '}
                  {data.friend.bestScoreToPar != null
                    ? formatScoreToPar(data.friend.bestScoreToPar)
                    : '—'}
                </p>
              </div>
            </div>
            {data.sharedCourses.length > 0 && (
              <>
                <h3>Shared courses</h3>
                <ul className="stats-recent-list">
                  {data.sharedCourses.map(c => (
                    <li key={c.courseId}>
                      {c.courseName}: you{' '}
                      {c.yourAvg != null ? formatScoreToPar(c.yourAvg) : '—'} · them{' '}
                      {c.friendAvg != null ? formatScoreToPar(c.friendAvg) : '—'}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
