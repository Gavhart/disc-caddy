import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Course, CourseHole } from '../types'
import { listCourses, listHolesForCourse } from '../lib/courses'

interface Props {
  /** Currently selected course id, or null. */
  courseId: string | null
  /** Currently selected hole number, or null. */
  holeNumber: number | null
  onPickHole: (course: Course | null, hole: CourseHole | null) => void
}

/**
 * Compact Course → Hole picker. Loads the shared course catalog from
 * Supabase and lets the user pick a course, then a hole. Selecting a hole
 * fires `onPickHole` so the parent can populate distance/direction/etc.
 *
 * "Clear" returns to manual hole entry.
 */
export function CourseSelector({ courseId, holeNumber, onPickHole }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [holes, setHoles] = useState<CourseHole[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    if (!courseId) {
      setHoles([])
      return
    }
    setLoading(true)
    listHolesForCourse(courseId)
      .then(setHoles)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [courseId])

  const course = courses.find(c => c.id === courseId) ?? null
  const hole = holes.find(h => h.number === holeNumber) ?? null

  function handlePickCourse(nextId: string) {
    const next = courses.find(c => c.id === nextId) ?? null
    onPickHole(next, null)
  }

  function handlePickHole(nextNumberStr: string) {
    const n = Number(nextNumberStr)
    if (!Number.isFinite(n)) return
    const next = holes.find(h => h.number === n) ?? null
    onPickHole(course, next)
  }

  return (
    <section className="course-selector card">
      <div className="card-header">
        <h2>Course</h2>
        <Link to="/courses" className="link-button">
          Manage
        </Link>
      </div>

      {error && <div className="form-error small">{error}</div>}

      {courses.length === 0 ? (
        <p className="muted small">
          No courses in the catalog yet.{' '}
          <Link to="/courses">Add one</Link> to start picking holes.
        </p>
      ) : (
        <div className="course-selector-grid">
          <div className="field-row">
            <label htmlFor="course">Course</label>
            <select
              id="course"
              value={courseId ?? ''}
              onChange={e => handlePickCourse(e.target.value)}
            >
              <option value="">— manual hole —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.locality ? ` · ${c.locality}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label htmlFor="hole">Hole</label>
            <select
              id="hole"
              value={holeNumber ?? ''}
              onChange={e => handlePickHole(e.target.value)}
              disabled={!courseId || loading}
            >
              <option value="">{loading ? 'Loading…' : '— pick hole —'}</option>
              {holes.map(h => (
                <option key={h.id} value={h.number}>
                  #{h.number} · {h.distance} ft
                  {h.par ? ` · par ${h.par}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {hole && course && (
        <div className="course-selector-summary">
          <strong>{course.name}</strong> — Hole {hole.number}
          {hole.par ? ` (par ${hole.par})` : ''} · {hole.distance} ft ·{' '}
          {prettyDirection(hole.direction)} · {prettyElevation(hole.elevation)}
          {hole.notes && (
            <div className="muted small">“{hole.notes}”</div>
          )}
        </div>
      )}
    </section>
  )
}

function prettyDirection(d: CourseHole['direction']): string {
  switch (d) {
    case 'hard_left':    return 'Hard left'
    case 'dogleg_left':  return 'Dogleg left'
    case 'straight':     return 'Straight'
    case 'dogleg_right': return 'Dogleg right'
    case 'hard_right':   return 'Hard right'
  }
}

function prettyElevation(e: CourseHole['elevation']): string {
  switch (e) {
    case 'uphill':   return 'Uphill'
    case 'flat':     return 'Flat'
    case 'downhill': return 'Downhill'
  }
}
