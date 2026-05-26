import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  formatScoreToPar,
  getCourseLeaderboard,
  getHoleLeaderboard,
  getRoundDetail,
  listMyRounds,
} from '../lib/rounds'
import { listCourses } from '../lib/courses'
import { LeaderboardEntry, RoundDetail, RoundSummary, Course } from '../types'

export function RoundsPage() {
  const { roundId } = useParams<{ roundId?: string }>()

  if (roundId) {
    return <RoundDetailView roundId={roundId} />
  }

  return <RoundListView />
}

function RoundListView() {
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [leaderCourseId, setLeaderCourseId] = useState<string>('')
  const [courseBoard, setCourseBoard] = useState<LeaderboardEntry[]>([])
  const [boardLoading, setBoardLoading] = useState(false)

  useEffect(() => {
    listMyRounds()
      .then(setRounds)
      .catch(err => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false))
    listCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) setLeaderCourseId(list[0].id)
      })
      .catch(err => console.error('[rounds] courses failed', err))
  }, [])

  useEffect(() => {
    if (!leaderCourseId) {
      setCourseBoard([])
      return
    }
    setBoardLoading(true)
    getCourseLeaderboard(leaderCourseId)
      .then(setCourseBoard)
      .catch(err => console.error('[rounds] leaderboard failed', err))
      .finally(() => setBoardLoading(false))
  }, [leaderCourseId])

  const leaderCourse = courses.find(c => c.id === leaderCourseId)

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>Round history</h2>
          <Link to="/" className="btn-secondary">
            Play a round
          </Link>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? (
          <p className="muted">Loading rounds…</p>
        ) : rounds.length === 0 ? (
          <p className="muted">
            No completed rounds yet. Start a live round from the Recommend page
            while playing a course, or join a friend&apos;s group scorecard when
            they add you.
          </p>
        ) : (
          <ul className="round-history-list">
            {rounds.map(r => (
              <li key={r.id}>
                <Link to={`/rounds/${r.id}`} className="round-history-item">
                  <div className="round-history-main">
                    <strong>{r.courseName ?? 'Unknown course'}</strong>
                    {r.courseLocality && (
                      <span className="muted small"> · {r.courseLocality}</span>
                    )}
                  </div>
                  <div className="round-history-meta muted small">
                    {new Date(r.startedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {r.playerCount > 1 && ` · ${r.playerCount} players`}
                    {r.status === 'active' && (
                      <span className="pill small round-live-pill">Live</span>
                    )}
                  </div>
                  <div className="round-history-score">
                    {r.holesScored > 0 ? (
                      <>
                        <strong>{r.totalStrokes}</strong>
                        {r.totalPar > 0 && (
                          <span className="muted">
                            {' '}
                            ({formatScoreToPar(r.scoreToPar)})
                          </span>
                        )}
                        <span className="muted small"> · {r.holesScored} holes</span>
                      </>
                    ) : (
                      <span className="muted">No scores yet</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Course leaderboard</h2>
        </div>
        <p className="muted small">
          Best completed rounds at a course (fewest total strokes, min. 9 holes
          scored).
        </p>
        {courses.length === 0 ? (
          <p className="muted small">
            <Link to="/courses">Add a course</Link> to enable leaderboards.
          </p>
        ) : (
          <>
            <label className="leaderboard-course-pick">
              <span className="muted small">Course</span>
              <select
                value={leaderCourseId}
                onChange={e => setLeaderCourseId(e.target.value)}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.locality ? ` · ${c.locality}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {boardLoading ? (
              <p className="muted small">Loading…</p>
            ) : courseBoard.length === 0 ? (
              <p className="muted small">
                No ranked rounds at {leaderCourse?.name ?? 'this course'} yet.
                Finish a round with at least 9 scored holes to appear here.
              </p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Score</th>
                    <th>To par</th>
                    <th>Holes</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {courseBoard.map(row => (
                    <tr key={row.roundPlayerId}>
                      <td>{row.rank}</td>
                      <td>
                        <Link to={`/rounds/${row.roundId}`}>{row.displayName}</Link>
                      </td>
                      <td>{row.strokes}</td>
                      <td>{formatScoreToPar(row.scoreToPar)}</td>
                      <td>{row.holesScored}</td>
                      <td className="muted small">
                        {new Date(row.playedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RoundDetailView({ roundId }: { roundId: string }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<RoundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holeBoard, setHoleBoard] = useState<LeaderboardEntry[]>([])
  const [holePick, setHolePick] = useState<number>(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getRoundDetail(roundId)
      if (!d) {
        setError('Round not found')
        setDetail(null)
        return
      }
      setDetail(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [roundId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!detail?.courseId) {
      setHoleBoard([])
      return
    }
    getHoleLeaderboard(detail.courseId, holePick, 10)
      .then(setHoleBoard)
      .catch(err => console.error('[rounds] hole board failed', err))
  }, [detail?.courseId, holePick])

  const holeNumbers = useMemo(() => {
    if (!detail) return []
    const nums = new Set(detail.scores.map(s => s.holeNumber))
    return [...nums].sort((a, b) => a - b)
  }, [detail])

  useEffect(() => {
    if (holeNumbers.length > 0 && !holeNumbers.includes(holePick)) {
      setHolePick(holeNumbers[0])
    }
  }, [holeNumbers, holePick])

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading round…</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="container">
        <div className="form-error">{error ?? 'Not found'}</div>
        <Link to="/rounds">← Back to rounds</Link>
      </div>
    )
  }

  const sortedPlayers = [...detail.players].sort((a, b) => a.sortOrder - b.sortOrder)
  const holeNums = holeNumbers.length > 0 ? holeNumbers : [holePick]

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>{detail.courseName ?? 'Round'}</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/rounds')}
          >
            ← All rounds
          </button>
        </div>
        <p className="muted small">
          {new Date(detail.startedAt).toLocaleString()}
          {detail.endedAt &&
            ` – ${new Date(detail.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          {detail.status === 'active' && (
            <span className="pill small round-live-pill"> Live</span>
          )}
        </p>

        <div className="scorecard-grid-scroll">
          <table className="scorecard-grid">
            <thead>
              <tr>
                <th>Player</th>
                {holeNums.map(n => (
                  <th key={n}>#{n}</th>
                ))}
                <th>Tot</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map(player => {
                const mine = detail.scores.filter(
                  s => s.roundPlayerId === player.id,
                )
                const strokes = mine.reduce((n, s) => n + s.strokes, 0)
                const par = mine.reduce((n, s) => n + (s.par ?? 0), 0)
                return (
                  <tr key={player.id}>
                    <td>
                      {player.displayName}
                      {player.isHost && (
                        <span className="pill small scorecard-host-pill"> Host</span>
                      )}
                    </td>
                    {holeNums.map(n => {
                      const s = mine.find(sc => sc.holeNumber === n)
                      return <td key={n}>{s?.strokes ?? '·'}</td>
                    })}
                    <td>
                      <strong>{strokes || '—'}</strong>
                    </td>
                    <td>{par > 0 ? formatScoreToPar(strokes - par) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {detail.throws.length > 0 && (
          <details className="round-throws-detail">
            <summary>Caddy disc picks ({detail.throws.length})</summary>
            <ul className="round-throws-list">
              {detail.throws.map(t => (
                <li key={t.id}>
                  Hole {t.holeNumber}: {t.discName} ({t.throwStyle})
                  {!t.usedRecommendation && (
                    <span className="muted small"> · off-pick</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {detail.courseId && (
        <div className="card">
          <div className="card-header">
            <h2>Hole leaderboard</h2>
          </div>
          <p className="muted small">
            Best scores on a single hole at {detail.courseName}.
          </p>
          <label className="leaderboard-course-pick">
            <span className="muted small">Hole</span>
            <select
              value={holePick}
              onChange={e => setHolePick(Number(e.target.value))}
            >
              {holeNums.map(n => (
                <option key={n} value={n}>
                  #{n}
                </option>
              ))}
            </select>
          </label>
          {holeBoard.length === 0 ? (
            <p className="muted small">No scores for this hole yet.</p>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Strokes</th>
                  <th>To par</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {holeBoard.map(row => (
                  <tr key={row.roundPlayerId}>
                    <td>{row.rank}</td>
                    <td>{row.displayName}</td>
                    <td>{row.strokes}</td>
                    <td>{formatScoreToPar(row.scoreToPar)}</td>
                    <td className="muted small">
                      {new Date(row.playedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
