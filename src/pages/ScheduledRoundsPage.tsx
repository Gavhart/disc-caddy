import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCourses } from '../lib/courses'
import {
  createScheduledRound,
  listScheduledRounds,
  rsvpScheduledRound,
} from '../lib/scheduledRounds'
import { Course, ScheduledRound } from '../types'

export function ScheduledRoundsPage() {
  const [rounds, setRounds] = useState<ScheduledRound[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [when, setWhen] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    listScheduledRounds()
      .then(setRounds)
      .catch(() => setRounds([]))
  }

  useEffect(() => {
    reload()
    listCourses().then(setCourses).catch(() => setCourses([]))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!courseId || !when) return
    setBusy(true)
    setError(null)
    try {
      await createScheduledRound({
        courseId,
        scheduledAt: new Date(when).toISOString(),
        notes,
        visibility: 'community',
      })
      setNotes('')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule round')
    } finally {
      setBusy(false)
    }
  }

  async function handleRsvp(id: string, status: 'going' | 'maybe' | 'declined') {
    setBusy(true)
    try {
      await rsvpScheduledRound(id, status)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RSVP failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container scheduled-page">
      <p className="settings-back">
        <Link to="/community">← Back to Community</Link>
      </p>
      <div className="card">
        <h2>Scheduled rounds</h2>
        <p className="muted small">
          Post a tee time and let nearby players RSVP — then invite them to your live scorecard.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleCreate} className="scheduled-form">
          <label>
            Course
            <select value={courseId} onChange={e => setCourseId(e.target.value)} required>
              <option value="">Pick course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date &amp; time
            <input
              type="datetime-local"
              value={when}
              onChange={e => setWhen(e.target.value)}
              required
            />
          </label>
          <label>
            Notes
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Casual 9, need 2 more…"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            Post round
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Upcoming</h3>
        {rounds.length === 0 ? (
          <p className="muted">No scheduled rounds yet.</p>
        ) : (
          <ul className="scheduled-list">
            {rounds.map(r => (
              <li key={r.id} className="scheduled-item">
                <strong>{r.hostName}</strong>
                {r.courseName && <> at {r.courseName}</>}
                <br />
                <span className="muted small">
                  {new Date(r.scheduledAt).toLocaleString()} · {r.goingCount}/{r.maxPlayers}{' '}
                  going
                </span>
                {r.notes && <p className="small">{r.notes}</p>}
                <div className="scheduled-rsvp">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => handleRsvp(r.id, 'going')}
                  >
                    Going
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => handleRsvp(r.id, 'maybe')}
                  >
                    Maybe
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
