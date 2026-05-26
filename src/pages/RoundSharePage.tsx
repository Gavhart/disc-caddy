import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPublicRoundRecap } from '../lib/roundShare'
import { downloadRecapImage } from '../lib/recapImage'
import { formatScoreToPar } from '../lib/rounds'
import { PublicRoundRecap } from '../types'
import { Logo } from '../components/Logo'

export function RoundSharePage() {
  const { token } = useParams<{ token: string }>()
  const [recap, setRecap] = useState<PublicRoundRecap | null | undefined>(
    undefined,
  )
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!token) {
      setRecap(null)
      return
    }
    fetchPublicRoundRecap(token)
      .then(setRecap)
      .catch(() => setRecap(null))
  }, [token])

  if (recap === undefined) {
    return (
      <div className="container share-page">
        <div className="card">
          <p className="muted">Loading round recap…</p>
        </div>
      </div>
    )
  }

  if (!recap) {
    return (
      <div className="container share-page">
        <div className="card">
          <h2>Round not found</h2>
          <p className="muted">This share link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  const place = [recap.courseName, recap.courseLocality].filter(Boolean).join(', ')
  const when = recap.playedAt
    ? new Date(recap.playedAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const top = recap.players[0]

  return (
    <div className="container share-page">
      <header className="share-header">
        <Logo height={36} />
        <span className="muted small">Round recap</span>
      </header>
      <div className="card share-recap-card">
        {top && (
          <p className="share-recap-headline">
            Shot <strong>{top.total_strokes}</strong>{' '}
            ({formatScoreToPar(top.score_to_par)})
            {place ? (
              <>
                {' '}
                at <strong>{place}</strong>
              </>
            ) : null}
            {recap.players.length > 1 && (
              <> with {recap.players.length - 1} friend{recap.players.length > 2 ? 's' : ''}</>
            )}
          </p>
        )}
        {when && <p className="muted small share-recap-date">{when}</p>}
        {recap.players.length > 0 && (
          <table className="share-recap-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Score</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              {recap.players.map(p => (
                <tr key={p.display_name}>
                  <td>{p.display_name}</td>
                  <td>{p.total_strokes}</td>
                  <td>{formatScoreToPar(p.score_to_par)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true)
            try {
              await downloadRecapImage(recap)
            } finally {
              setDownloading(false)
            }
          }}
        >
          {downloading ? 'Creating…' : 'Download share image'}
        </button>
      </div>
    </div>
  )
}
