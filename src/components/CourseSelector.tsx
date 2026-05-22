import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Course, CourseHole, CourseSummary } from '../types'
import {
  listCourses,
  listCourseSummaries,
  listHolesForCourse,
} from '../lib/courses'

interface Props {
  /** Currently selected course id, or null. */
  courseId: string | null
  /** Currently selected hole number, or null. */
  holeNumber: number | null
  /**
   * Fires whenever the active course or hole changes. Hole may be null when
   * the user leaves the course (return to manual entry) or when the picked
   * course has no holes defined yet.
   */
  onPickHole: (course: Course | null, hole: CourseHole | null) => void
}

/**
 * Course + round tracker.
 *
 * When no course is selected: shows a course dropdown. Pick one and the
 * tracker auto-loads its first hole, then provides Prev/Next stepping
 * through the round. Wind stays editable per-hole on the main HoleInput.
 *
 * Hole-state changes flow up through `onPickHole` so the parent can keep its
 * own Hole record in sync and persist the round across refreshes.
 */
export function CourseSelector({ courseId, holeNumber, onPickHole }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [holes, setHoles] = useState<CourseHole[]>([])
  const [summaries, setSummaries] = useState<Map<string, CourseSummary>>(
    () => new Map(),
  )
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingHoles, setLoadingHoles] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial course catalog load + per-course summary stats (parallel, since
  // the summaries view is a separate Supabase round-trip).
  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingCourses(false))
    listCourseSummaries()
      .then(setSummaries)
      .catch(err => console.error('[course-selector] summaries failed', err))
  }, [])

  // Per-course hole load. Auto-selects the first hole when the parent hasn't
  // already picked one (typical for a fresh course pick or a restored round
  // whose hole number got dropped).
  useEffect(() => {
    if (!courseId) {
      setHoles([])
      return
    }
    setLoadingHoles(true)
    listHolesForCourse(courseId)
      .then(rows => {
        setHoles(rows)
        const course = courses.find(c => c.id === courseId) ?? null
        if (rows.length > 0) {
          const target =
            (holeNumber != null && rows.find(h => h.number === holeNumber)) ||
            rows[0]
          // Only re-emit if we actually changed the resolved hole, to avoid
          // an extra render storm right after the parent restored from
          // localStorage.
          if (target.number !== holeNumber) {
            onPickHole(course, target)
          }
        } else {
          onPickHole(course, null)
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingHoles(false))
    // We intentionally don't depend on `holeNumber` or `courses` to avoid
    // re-running the hole load on every step; the dependency closure already
    // sees the latest values via React's render snapshot for the auto-pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const course = useMemo(
    () => courses.find(c => c.id === courseId) ?? null,
    [courses, courseId],
  )
  const hole = useMemo(
    () => holes.find(h => h.number === holeNumber) ?? null,
    [holes, holeNumber],
  )

  // Sort holes by number so Prev/Next walks them in order regardless of how
  // they were inserted in the database.
  const sortedHoles = useMemo(
    () => [...holes].sort((a, b) => a.number - b.number),
    [holes],
  )
  const currentIdx = hole ? sortedHoles.findIndex(h => h.id === hole.id) : -1

  function handlePickCourse(nextId: string) {
    if (nextId === '') {
      onPickHole(null, null)
      return
    }
    const next = courses.find(c => c.id === nextId) ?? null
    // Hole defaults to first via the holes-load effect below.
    onPickHole(next, null)
  }

  function step(delta: number) {
    if (currentIdx < 0) return
    const targetIdx = currentIdx + delta
    if (targetIdx < 0 || targetIdx >= sortedHoles.length) return
    onPickHole(course, sortedHoles[targetIdx])
  }

  function jumpTo(num: string) {
    const n = Number(num)
    if (!Number.isFinite(n)) return
    const next = sortedHoles.find(h => h.number === n) ?? null
    if (next) onPickHole(course, next)
  }

  function leaveCourse() {
    onPickHole(null, null)
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

      {courses.length === 0 && !loadingCourses ? (
        <p className="muted small">
          No courses in the catalog yet.{' '}
          <Link to="/courses">Add one</Link> to start tracking a round.
        </p>
      ) : !course ? (
        <div className="course-picker-row">
          <p className="course-picker-intro">Two ways to use Disc Caddy:</p>
          <ul className="course-picker-options">
            <li>
              <strong>Pick a course</strong> — load the saved per-hole
              distances, doglegs, and elevation. Step through your round with
              Prev / Next buttons and the recommender updates for each hole.
            </li>
            <li>
              <strong>Skip it</strong> — fill in the{' '}
              <em>What hole are you playing?</em> panel below for a single
              shot. Useful for practice, courses you haven't added yet, or
              just answering “what disc?” on a tricky hole.
            </li>
          </ul>
          <label htmlFor="course" className="course-picker-label">
            Play a course
          </label>
          <select
            id="course"
            value=""
            onChange={e => handlePickCourse(e.target.value)}
            disabled={loadingCourses}
          >
            <option value="">
              {loadingCourses ? 'Loading courses…' : '— pick a course —'}
            </option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.locality ? ` · ${c.locality}` : ''}
                {formatSummaryStamp(summaries.get(c.id))}
              </option>
            ))}
          </select>
          <p className="muted small course-picker-hint">
            Don't see your course?{' '}
            <Link to="/courses">Add it from the Courses page</Link> — searches
            DiscGolfAPI's 4,000+ US records or lets you create your own.
          </p>
        </div>
      ) : (
        <RoundView
          course={course}
          hole={hole}
          holes={sortedHoles}
          currentIdx={currentIdx}
          loading={loadingHoles}
          onStep={step}
          onJump={jumpTo}
          onLeave={leaveCourse}
        />
      )}
    </section>
  )
}

interface RoundViewProps {
  course: Course
  hole: CourseHole | null
  holes: CourseHole[]
  currentIdx: number
  loading: boolean
  onStep: (delta: number) => void
  onJump: (num: string) => void
  onLeave: () => void
}

function RoundView({
  course,
  hole,
  holes,
  currentIdx,
  loading,
  onStep,
  onJump,
  onLeave,
}: RoundViewProps) {
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx >= 0 && currentIdx < holes.length - 1

  return (
    <div className="round-view">
      <div className="round-header">
        <div className="round-course">
          <strong>{course.name}</strong>
          {course.locality && (
            <span className="muted small"> · {course.locality}</span>
          )}
        </div>
        <button
          type="button"
          className="link-button"
          onClick={onLeave}
        >
          Leave course
        </button>
      </div>

      {loading ? (
        <p className="muted small">Loading holes…</p>
      ) : holes.length === 0 ? (
        <div className="round-empty-holes">
          <p>
            <strong>No holes for this course yet.</strong>
          </p>
          <p className="muted small">
            Disc Caddy course data is built by players. DiscGolfAPI only
            shares names and locations — the per-hole distance, par, dogleg
            and elevation come from people like you.
          </p>
          <Link to="/courses" className="btn-secondary round-empty-cta">
            Add holes for {course.name}
          </Link>
          <p className="muted small">
            Anything you add helps everyone who plays here next.
          </p>
        </div>
      ) : !hole ? (
        <p className="muted small">No hole selected.</p>
      ) : (
        <>
          <div className="round-stepper">
            <button
              type="button"
              className="btn-secondary round-step-btn"
              onClick={() => onStep(-1)}
              disabled={!hasPrev}
              aria-label="Previous hole"
            >
              ←
            </button>
            <div className="round-hole-info">
              <div className="round-hole-title">
                Hole {hole.number}
                <span className="muted"> of {holes.length}</span>
                {hole.par != null && (
                  <span className="round-hole-par"> · par {hole.par}</span>
                )}
              </div>
              <div className="round-hole-meta">
                {hole.distance} ft · {prettyDirection(hole.direction)} ·{' '}
                {prettyElevation(hole.elevation)}
                {prettyLayoutSuffix(hole)}
              </div>
              {hole.notes && (
                <div className="round-hole-notes">“{hole.notes}”</div>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary round-step-btn"
              onClick={() => onStep(1)}
              disabled={!hasNext}
              aria-label="Next hole"
            >
              →
            </button>
          </div>

          <div className="round-jump">
            <label htmlFor="hole-jump" className="muted small">
              Jump to hole
            </label>
            <select
              id="hole-jump"
              value={hole.number}
              onChange={e => onJump(e.target.value)}
            >
              {holes.map(h => (
                <option key={h.id} value={h.number}>
                  #{h.number}
                  {h.par != null ? ` · par ${h.par}` : ''} · {h.distance} ft
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
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

/**
 * Suffix appended to the hole-meta line summarising terrain + trees. Skips
 * each clause when it's the "no information" value (flat / open / none) so
 * boring holes stay tidy.
 */
function prettyLayoutSuffix(hole: CourseHole): string {
  const parts: string[] = []
  if (hole.terrain && hole.terrain !== 'flat') {
    parts.push(prettyTerrain(hole.terrain))
  }
  if (hole.treeCoverage && hole.treeCoverage !== 'open') {
    parts.push(prettyTreeCoverage(hole.treeCoverage, hole.treeLayout))
  }
  return parts.length ? ' · ' + parts.join(' · ') : ''
}

function prettyTerrain(t: CourseHole['terrain']): string {
  switch (t) {
    case 'flat':        return 'Flat'
    case 'rolling':     return 'Rolling'
    case 'hilly':       return 'Hilly'
    case 'mountainous': return 'Mountainous'
  }
}

function prettyTreeCoverage(
  c: CourseHole['treeCoverage'],
  layout: CourseHole['treeLayout'],
): string {
  const density =
    c === 'light'           ? 'Light trees'
    : c === 'wooded'        ? 'Wooded'
    : c === 'heavily_wooded' ? 'Heavily wooded'
    : 'Open'
  if (!layout || layout === 'none' || layout === 'throughout') return density
  const where =
    layout === 'front_half' ? 'front half'
    : layout === 'back_half' ? 'back half'
    : layout === 'left'      ? 'left side'
    : layout === 'right'     ? 'right side'
    : layout === 'canopy'    ? 'canopy'
    : ''
  return where ? `${density} (${where})` : density
}

/**
 * Short hole-fill stamp appended to dropdown options. `<option>` elements
 * can't carry styled children, so this is plain text only.
 *
 *  - `5/18`              expected total known, partly filled
 *  - `complete (18/18)`  expected total known, every hole filled
 *  - `12 holes`          no expected total, some filled
 *  - `needs holes`       nothing filled yet
 *  - (empty)             no summary loaded for this course yet
 */
function formatSummaryStamp(summary: CourseSummary | undefined): string {
  if (!summary) return ''
  const { holesFilled, totalHoles } = summary
  if (totalHoles != null && holesFilled >= totalHoles) {
    return ` · complete (${totalHoles}/${totalHoles})`
  }
  if (holesFilled === 0) {
    return totalHoles != null
      ? ` · 0/${totalHoles} — needs holes`
      : ' · needs holes'
  }
  return totalHoles != null
    ? ` · ${holesFilled}/${totalHoles}`
    : ` · ${holesFilled} hole${holesFilled === 1 ? '' : 's'}`
}
