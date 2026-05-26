import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listCourses } from '../lib/courses'
import { fetchCoursePlaybook, savePlaybookEntry } from '../lib/playbook'
import { formatScoreToPar } from '../lib/rounds'
import { Course, PlaybookHole } from '../types'

export function CoursePlaybookPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const courseId = searchParams.get('course') ?? ''
  const [courses, setCourses] = useState<Course[]>([])
  const [holes, setHoles] = useState<PlaybookHole[]>([])
  const [loading, setLoading] = useState(false)
  const [editHole, setEditHole] = useState<number | null>(null)
  const [strategy, setStrategy] = useState('')
  const [aimNotes, setAimNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listCourses().then(setCourses).catch(() => setCourses([]))
  }, [])

  useEffect(() => {
    if (!courseId) {
      setHoles([])
      return
    }
    setLoading(true)
    fetchCoursePlaybook(courseId)
      .then(setHoles)
      .catch(() => setHoles([]))
      .finally(() => setLoading(false))
  }, [courseId])

  async function handleSave(holeNumber: number) {
    if (!courseId) return
    setSaving(true)
    try {
      await savePlaybookEntry({
        courseId,
        holeNumber,
        strategy,
        aimNotes,
      })
      const updated = await fetchCoursePlaybook(courseId)
      setHoles(updated)
      setEditHole(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container playbook-page">
      <div className="card">
        <h2>Course playbook</h2>
        <p className="muted small">
          Your lines, notes, and last 3 scores per hole — strategy hub for courses you play.
        </p>
        <label className="leaderboard-course-pick">
          <span>Course</span>
          <select
            value={courseId}
            onChange={e => setSearchParams(e.target.value ? { course: e.target.value } : {})}
          >
            <option value="">Pick a course…</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.locality ? ` · ${c.locality}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!courseId && (
        <p className="muted card">Select a course to see your hole-by-hole playbook.</p>
      )}

      {loading && <p className="muted card">Loading playbook…</p>}

      {holes.map(h => (
        <div key={h.holeNumber} className="card playbook-hole-card">
          <div className="playbook-hole-header">
            <h3>
              Hole {h.holeNumber}
              {h.par != null && <span className="muted"> · par {h.par}</span>}
              {h.distance != null && <span className="muted"> · {h.distance} ft</span>}
            </h3>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setEditHole(h.holeNumber)
                setStrategy(h.strategy ?? '')
                setAimNotes(h.aimNotes ?? '')
              }}
            >
              Edit strategy
            </button>
          </div>
          {h.holeNote && <p className="hole-note-text">{h.holeNote}</p>}
          {h.strategy && <p>{h.strategy}</p>}
          {h.aimNotes && <p className="muted small">Aim: {h.aimNotes}</p>}
          {h.recentScores.length > 0 && (
            <p className="muted small">
              Recent:{' '}
              {h.recentScores
                .map(s =>
                  s.par != null
                    ? `${s.strokes} (${formatScoreToPar(s.strokes - s.par)})`
                    : String(s.strokes),
                )
                .join(' · ')}
            </p>
          )}
          {editHole === h.holeNumber && (
            <div className="playbook-edit">
              <textarea
                value={strategy}
                onChange={e => setStrategy(e.target.value)}
                placeholder="Strategy for this hole…"
                rows={2}
              />
              <input
                value={aimNotes}
                onChange={e => setAimNotes(e.target.value)}
                placeholder="Aim / line notes"
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => handleSave(h.holeNumber)}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      ))}

      {courseId && !loading && holes.length === 0 && (
        <p className="muted card">
          No holes defined for this course yet.{' '}
          <Link to="/courses">Add holes on Courses</Link>.
        </p>
      )}
    </div>
  )
}
