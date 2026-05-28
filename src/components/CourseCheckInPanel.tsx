import { FormEvent, useEffect, useState } from 'react'
import {
  checkInCourse,
  clearCourseCheckin,
  getMyCourseCheckin,
} from '../lib/checkins'
import { MyCourseCheckin } from '../types'

export function CourseCheckInPanel({
  courseId,
  courseName,
  courseLocality,
}: {
  courseId: string | null
  courseName: string | null
  courseLocality: string | null
}) {
  const [mine, setMine] = useState<MyCourseCheckin | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    getMyCourseCheckin()
      .then(setMine)
      .catch(() => setMine(null))
  }

  useEffect(() => {
    reload()
  }, [courseId])

  const checkedInHere =
    mine != null && courseId != null && mine.courseId === courseId
  const checkedInElsewhere =
    mine != null && courseId != null && mine.courseId !== courseId

  async function handleCheckIn(e?: FormEvent) {
    e?.preventDefault()
    if (!courseId) return
    setBusy(true)
    setError(null)
    try {
      await checkInCourse(courseId, note.trim() || undefined)
      setNote('')
      reload()
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
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear check-in')
    } finally {
      setBusy(false)
    }
  }

  if (!courseId || !courseName) return null

  const place = [courseName, courseLocality].filter(Boolean).join(', ')

  return (
    <div className="card course-checkin">
      <h3>Playing today?</h3>
      <p className="muted small">
        Let nearby players know you&apos;re at <strong>{place}</strong>. Visible on
        Community for 14 hours.
      </p>

      {error && <div className="form-error small">{error}</div>}

      {checkedInHere ? (
        <div className="course-checkin-active">
          <span className="pill small">Checked in</span>
          {mine?.note && <p className="muted small">{mine.note}</p>}
          <button type="button" className="btn-secondary" disabled={busy} onClick={handleClear}>
            I&apos;m done for today
          </button>
        </div>
      ) : (
        <form onSubmit={handleCheckIn} className="course-checkin-form">
          {checkedInElsewhere && mine && (
            <p className="muted small">
              You&apos;re checked in at {mine.courseName}. Checking in here will move
              your status.
            </p>
          )}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note (e.g. back 9, looking for a card)"
            maxLength={120}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            Check in at this course
          </button>
        </form>
      )}
    </div>
  )
}
