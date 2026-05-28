import { FormEvent, useEffect, useState } from 'react'
import { searchCoursesByName } from '../lib/courses'
import {
  checkInCourse,
  clearCourseCheckin,
  getMyCourseCheckin,
} from '../lib/checkins'
import { Course, MyCourseCheckin } from '../types'

export function CommunityCheckInSection() {
  const [mine, setMine] = useState<MyCourseCheckin | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Course[]>([])
  const [selected, setSelected] = useState<Course | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reloadMine() {
    getMyCourseCheckin()
      .then(setMine)
      .catch(() => setMine(null))
  }

  useEffect(() => {
    reloadMine()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    const t = window.setTimeout(() => {
      searchCoursesByName(query.trim())
        .then(setHits)
        .catch(() => setHits([]))
    }, 250)
    return () => window.clearTimeout(t)
  }, [query])

  async function handleCheckIn(e: FormEvent) {
    e.preventDefault()
    if (!selected) {
      setError('Pick a course')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await checkInCourse(selected.id, note.trim() || undefined)
      setNote('')
      setQuery('')
      setSelected(null)
      setHits([])
      reloadMine()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    setBusy(true)
    setError(null)
    try {
      await clearCourseCheckin()
      reloadMine()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear check-in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card community-checkin">
      <h2 className="section-title">Check in</h2>
      <p className="muted small">
        Show up on <strong>Playing today</strong> for the next 14 hours. Community-visible
        players only.
      </p>

      {error && <div className="form-error small">{error}</div>}

      {mine ? (
        <div className="community-checkin-active">
          <span className="pill small">Checked in</span>
          <p>
            <strong>{mine.courseName}</strong>
            {mine.courseLocality ? ` · ${mine.courseLocality}` : ''}
          </p>
          {mine.note && <p className="muted small">{mine.note}</p>}
          <button type="button" className="btn-secondary" disabled={busy} onClick={handleClear}>
            I&apos;m done for today
          </button>
        </div>
      ) : (
        <form onSubmit={handleCheckIn} className="community-checkin-form">
          <label>
            Course
            <input
              value={selected ? selected.name : query}
              onChange={e => {
                setSelected(null)
                setQuery(e.target.value)
              }}
              placeholder="Search courses…"
              required={!selected}
            />
          </label>
          {!selected && hits.length > 0 && (
            <ul className="community-checkin-hits">
              {hits.slice(0, 6).map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setSelected(c)
                      setQuery('')
                      setHits([])
                    }}
                  >
                    {c.name}
                    {c.locality ? ` · ${c.locality}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <p className="muted small">
              Selected: <strong>{selected.name}</strong>{' '}
              <button type="button" className="link-button" onClick={() => setSelected(null)}>
                Change
              </button>
            </p>
          )}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note"
            maxLength={120}
          />
          <button type="submit" className="btn-primary" disabled={busy || !selected}>
            Check in
          </button>
        </form>
      )}
    </div>
  )
}
