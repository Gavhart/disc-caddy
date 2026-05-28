import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Course,
  CourseHole,
  CourseSummary,
  Elevation,
  HoleDirection,
  MandoRoute,
  TeeBearing,
  TEE_BEARING_OPTIONS,
  Terrain,
  TreeCoverage,
  TreeLayout,
} from '../types'
import {
  createCourse,
  createCourseHole,
  deleteCourse,
  deleteCourseHole,
  listCourses,
  listCourseSummaries,
  listHolesForCourse,
  updateCourseHole,
} from '../lib/courses'
import {
  DGAPI_ATTRIBUTION,
  DGAPI_LICENSE_URL,
  DgApiCourse,
  loadAllForCountry,
} from '../lib/discgolfapi'
import { CourseDiscoveryPanel } from '../components/CourseDiscoveryPanel'
import { MANDO_OPTIONS } from '../lib/holeLayoutOptions'

const DIRECTION_OPTIONS: { value: HoleDirection; label: string }[] = [
  { value: 'hard_left', label: 'Hard left' },
  { value: 'dogleg_left', label: 'Dogleg left' },
  { value: 'straight', label: 'Straight' },
  { value: 'dogleg_right', label: 'Dogleg right' },
  { value: 'hard_right', label: 'Hard right' },
]

const ELEVATION_OPTIONS: { value: Elevation; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Flat' },
  { value: 'downhill', label: 'Downhill' },
]

const TERRAIN_OPTIONS: { value: Terrain; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'rolling', label: 'Rolling' },
  { value: 'hilly', label: 'Hilly' },
  { value: 'mountainous', label: 'Mountainous' },
]

const TREE_COVERAGE_OPTIONS: { value: TreeCoverage; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'light', label: 'Light' },
  { value: 'wooded', label: 'Wooded' },
  { value: 'heavily_wooded', label: 'Heavy' },
]

const TREE_LAYOUT_OPTIONS: { value: TreeLayout; label: string }[] = [
  { value: 'throughout', label: 'Throughout' },
  { value: 'front_half', label: 'Front half' },
  { value: 'back_half', label: 'Back half' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
  { value: 'canopy', label: 'Canopy' },
]

/** How many DiscGolfAPI matches to show in the live filter list. */
const SEARCH_RESULT_CAP = 25

export function CoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // DiscGolfAPI search state. We pull the entire country slice once (the API
  // serves all 4k+ US records in a single response) and filter in memory as
  // the user types — that gives an autocomplete feel and avoids the dropped-
  // matches we had with the older limit-500 approach.
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCountry, setSearchCountry] = useState('US')
  const [dgCache, setDgCache] = useState<DgApiCourse[] | null>(null)
  const [dgCacheCountry, setDgCacheCountry] = useState<string | null>(null)
  const [dgLoading, setDgLoading] = useState(false)
  const [dgError, setDgError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)

  // Manual-add panel state. Cancel clears the draft entirely so re-opening
  // the panel doesn't surprise the user with stale text.
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualLocality, setManualLocality] = useState('')
  const [manualHoles, setManualHoles] = useState<string>('')
  const [creatingManual, setCreatingManual] = useState(false)

  // Selected course (expanded with hole editor).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [holes, setHoles] = useState<CourseHole[]>([])
  const [holesLoading, setHolesLoading] = useState(false)
  const [holeError, setHoleError] = useState<string | null>(null)

  // Per-course aggregate stats (hole-fill counts, distance totals). Loaded
  // in parallel with the catalog and refreshed whenever holes change in the
  // selected course so the catalog badges stay in sync without a re-fetch.
  const [summaries, setSummaries] = useState<Map<string, CourseSummary>>(
    () => new Map(),
  )

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
    listCourseSummaries()
      .then(setSummaries)
      .catch(err =>
        console.error('[courses] summary load failed', err),
      )
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setHoles([])
      setHoleError(null)
      return
    }
    setHolesLoading(true)
    listHolesForCourse(selectedId)
      .then(setHoles)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setHolesLoading(false))
  }, [selectedId])

  // Fetch the country slice the first time the user starts typing a search,
  // and again whenever they change country. Cached in component state so
  // subsequent keystrokes are instant.
  useEffect(() => {
    const country = searchCountry.trim().toUpperCase()
    if (!country || country.length < 2) return
    if (dgCacheCountry === country) return
    if (!searchQuery.trim()) return
    setDgLoading(true)
    setDgError(null)
    loadAllForCountry(country)
      .then(rows => {
        setDgCache(rows)
        setDgCacheCountry(country)
      })
      .catch(err =>
        setDgError(err instanceof Error ? err.message : 'Search failed'),
      )
      .finally(() => setDgLoading(false))
  }, [searchCountry, searchQuery, dgCacheCountry])

  /** Already-imported source ids from this catalog (prevents double-import). */
  const importedSourceIds = useMemo(() => {
    const out = new Set<string>()
    for (const c of courses) {
      if (c.source === 'discgolfapi' && c.sourceId) out.add(c.sourceId)
    }
    return out
  }, [courses])

  /**
   * Filtered DiscGolfAPI hits. Empty array when there's no query, or until the
   * country cache is loaded for the first time.
   */
  const searchResults = useMemo<DgApiCourse[]>(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle || !dgCache) return []
    return dgCache
      .filter(c => c.name && c.name.toLowerCase().includes(needle))
      .slice(0, SEARCH_RESULT_CAP)
  }, [dgCache, searchQuery])

  const selectedCourse = useMemo(
    () => courses.find(c => c.id === selectedId) ?? null,
    [courses, selectedId],
  )

  async function importFromApi(c: DgApiCourse) {
    setError(null)
    setImportingId(c.id)
    try {
      const created = await createCourse({
        name: c.name,
        locality: c.locality,
        regionCode: c.region_code,
        countryCode: c.country_code,
        lat: c.lat,
        lon: c.lon,
        totalHoles: c.holes ?? c.primary_layout?.holes ?? null,
        source: 'discgolfapi',
        sourceId: c.id,
      })
      setCourses(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId(created.id)
      setSearchQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportingId(null)
    }
  }

  function discardManual() {
    setManualName('')
    setManualLocality('')
    setManualHoles('')
    setShowManual(false)
  }

  /** Re-query summaries from the view after a hole mutation. Cheap (one row
   *  per course) and keeps the catalog badges in sync without manual math. */
  async function refreshSummaries() {
    try {
      const next = await listCourseSummaries()
      setSummaries(next)
    } catch (err) {
      console.error('[courses] summary refresh failed', err)
    }
  }

  async function createManual() {
    if (!manualName.trim()) return
    setCreatingManual(true)
    setError(null)
    try {
      const totalHolesParsed = manualHoles.trim() === ''
        ? null
        : Number(manualHoles)
      if (
        totalHolesParsed !== null &&
        (!Number.isFinite(totalHolesParsed) || totalHolesParsed < 1 || totalHolesParsed > 50)
      ) {
        throw new Error('Expected holes must be a number between 1 and 50.')
      }
      const created = await createCourse({
        name: manualName,
        locality: manualLocality || null,
        totalHoles: totalHolesParsed,
      })
      setCourses(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId(created.id)
      discardManual()
      // New course starts with 0/N badge — pull the summary so the catalog
      // shows it immediately instead of falling back to "no data" until the
      // user adds a hole.
      await refreshSummaries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreatingManual(false)
    }
  }

  async function removeCourse(c: Course) {
    if (
      !confirm(
        `Delete “${c.name}”? This also removes every hole you've saved for it. This can't be undone.`,
      )
    )
      return
    setError(null)
    const prev = courses
    setCourses(courses.filter(x => x.id !== c.id))
    if (selectedId === c.id) setSelectedId(null)
    try {
      await deleteCourse(c.id)
    } catch (err) {
      setCourses(prev)
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const nextHoleNumber = useMemo(() => {
    if (holes.length === 0) return 1
    return Math.max(...holes.map(h => h.number)) + 1
  }, [holes])

  async function addHole(input: {
    number: number
    distance: number
    par: number | null
    direction: HoleDirection
    elevation: Elevation
    terrain: Terrain
    treeCoverage: TreeCoverage
    treeLayout: TreeLayout
    mando: MandoRoute
    teeBearing: TeeBearing
    notes: string | null
  }) {
    if (!selectedId) return false
    setHoleError(null)
    try {
      const created = await createCourseHole({
        courseId: selectedId,
        number: input.number,
        distance: input.distance,
        par: input.par,
        direction: input.direction,
        elevation: input.elevation,
        terrain: input.terrain,
        treeCoverage: input.treeCoverage,
        treeLayout: input.treeLayout,
        mando: input.mando,
        teeBearing: input.teeBearing,
        notes: input.notes,
      })
      setHoles(prev => [...prev, created].sort((a, b) => a.number - b.number))
      refreshSummaries()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Add hole failed'
      setHoleError(message)
      setError(message)
      return false
    }
  }

  async function patchHole(holeId: string, patch: Partial<CourseHole>) {
    setHoles(prev => prev.map(h => (h.id === holeId ? { ...h, ...patch } : h)))
    try {
      await updateCourseHole(holeId, {
        distance: patch.distance,
        par: patch.par,
        direction: patch.direction,
        elevation: patch.elevation,
        terrain: patch.terrain,
        treeCoverage: patch.treeCoverage,
        treeLayout: patch.treeLayout,
        mando: patch.mando,
        teeBearing: patch.teeBearing,
        notes: patch.notes,
      })
      // Only the distance edit affects the badge/totals; cheap enough to
      // unconditionally refresh.
      if (patch.distance !== undefined) refreshSummaries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function removeHole(holeId: string) {
    if (!confirm('Delete this hole?')) return
    setHoles(prev => prev.filter(h => h.id !== holeId))
    try {
      await deleteCourseHole(holeId)
      refreshSummaries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="container">
      <CourseDiscoveryPanel />

      <div className="card community-callout">
        <h2>Help us map every course</h2>
        <p>
          DiscGolfAPI gives us names and locations, but the per-hole detail —
          distance, par, dogleg, elevation, notes — comes from players adding
          what they know. The more we crowdsource, the smarter the
          recommendation engine gets for everyone.
        </p>
        <p className="muted small">
          Add a course from the search below, or play your home course
          first-hand and fill in the holes as you go.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Courses</h2>
          <div className="bag-actions">
            {!showManual && (
              <button
                type="button"
                className="link-button"
                onClick={() => setShowManual(true)}
              >
                + Add manually
              </button>
            )}
          </div>
        </div>

        <div className="course-search">
          <div className="field-row">
            <label htmlFor="course-q">Search DiscGolfAPI</label>
            <div className="course-search-row">
              <input
                id="course-q"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Start typing — e.g. Maple Hill"
              />
              <input
                type="text"
                value={searchCountry}
                onChange={e => setSearchCountry(e.target.value.toUpperCase())}
                placeholder="US"
                maxLength={2}
                style={{ maxWidth: 80 }}
                aria-label="Country code"
                title="Two-letter ISO country code"
              />
            </div>
            <p className="muted small course-search-hint">
              {DGAPI_ATTRIBUTION} ·{' '}
              <a href={DGAPI_LICENSE_URL} target="_blank" rel="noreferrer">
                License
              </a>
            </p>
          </div>

          {dgError && <div className="form-error small">{dgError}</div>}

          {searchQuery.trim() && (
            <div className="course-search-results">
              {dgLoading && !dgCache ? (
                <p className="muted small">
                  Loading {searchCountry} courses…
                </p>
              ) : searchResults.length === 0 ? (
                <p className="muted small">
                  No matches for “{searchQuery.trim()}” in {searchCountry}.
                </p>
              ) : (
                <>
                  <p className="muted small">
                    {searchResults.length === SEARCH_RESULT_CAP
                      ? `Showing first ${SEARCH_RESULT_CAP} matches — keep typing to narrow down.`
                      : `${searchResults.length} match${searchResults.length === 1 ? '' : 'es'}`}
                  </p>
                  <ul className="bags-list">
                    {searchResults.map(c => {
                      const already = importedSourceIds.has(c.id)
                      return (
                        <li key={c.id} className="bag-list-row">
                          <div className="bag-name">
                            {c.name}
                            <div className="muted small">
                              {[c.locality, c.region_code, c.country_code]
                                .filter(Boolean)
                                .join(' · ')}
                              {c.holes ? ` · ${c.holes} holes` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => importFromApi(c)}
                            disabled={already || importingId === c.id}
                            title={already ? 'Already in your catalog' : 'Add to catalog'}
                          >
                            {already
                              ? 'Added'
                              : importingId === c.id
                                ? 'Adding…'
                                : 'Add'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {showManual && (
          <div className="course-manual">
            <h3 className="course-manual-heading">New course</h3>
            <div className="field-row">
              <label htmlFor="m-name">Course name</label>
              <input
                id="m-name"
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="My Backyard"
                autoFocus
              />
            </div>
            <div className="field-row">
              <label htmlFor="m-loc">City / locality (optional)</label>
              <input
                id="m-loc"
                type="text"
                value={manualLocality}
                onChange={e => setManualLocality(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="m-holes">Expected holes (optional)</label>
              <input
                id="m-holes"
                type="number"
                min={1}
                max={50}
                value={manualHoles}
                onChange={e => setManualHoles(e.target.value)}
                placeholder="18"
              />
            </div>
            <p className="muted small">
              The expected hole count drives the catalog badge — e.g. “5/18”
              means 5 of 18 holes have been filled in. Leave blank if you
              aren't sure.
            </p>
            <div className="course-manual-actions">
              <button
                type="button"
                className="link-button"
                onClick={discardManual}
                disabled={creatingManual}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={createManual}
                disabled={!manualName.trim() || creatingManual}
              >
                {creatingManual ? 'Creating…' : 'Create course'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {loading && <p className="muted">Loading…</p>}
      </div>

      {courses.length > 0 && (
        <div className="card">
          <h2>Catalog ({courses.length})</h2>
          <ul className="bags-list">
            {courses.map(c => {
              const canDelete = !!user && c.createdBy === user.id
              const summary = summaries.get(c.id)
              return (
                <li key={c.id} className="bag-list-row">
                  <div className="bag-name">
                    <div className="course-row-name">
                      <span>{c.name}</span>
                      <CourseFillBadge summary={summary} />
                    </div>
                    <div className="muted small">
                      {[c.locality, c.regionCode, c.countryCode]
                        .filter(Boolean)
                        .join(' · ')}
                      {c.source === 'discgolfapi' && (
                        <> · <em>via DiscGolfAPI</em></>
                      )}
                    </div>
                    {summary && summary.holesFilled > 0 && (
                      <div className="muted small course-row-distance">
                        {summary.distanceTotalFt.toLocaleString()} ft total
                        {summary.distanceAvgFt != null && (
                          <> · avg {summary.distanceAvgFt} ft / hole</>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="course-row-actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                    >
                      {selectedId === c.id ? 'Hide holes' : 'Edit holes'}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => removeCourse(c)}
                        title="Delete this course"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selectedCourse && (
        <div className="card">
          <h2>
            Holes — {selectedCourse.name}
            {selectedCourse.locality && (
              <span className="muted small"> · {selectedCourse.locality}</span>
            )}
          </h2>
          {holesLoading ? (
            <p className="muted">Loading holes…</p>
          ) : (
            <>
              {holeError && <div className="form-error">{holeError}</div>}
              {holes.length === 0 ? (
                <div className="empty-holes-prompt">
                  <p>
                    <strong>No holes filled in for this course yet.</strong>
                  </p>
                  <p className="muted small">
                    You'd be the first. Add what you know and the next player
                    to load this course gets your hole data automatically.
                  </p>
                </div>
              ) : (
                <ul className="bags-list">
                  {holes.map(h => (
                    <li key={h.id} className="bag-row">
                      <HoleEditor
                        hole={h}
                        onChange={patch => patchHole(h.id, patch)}
                        onDelete={() => removeHole(h.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <AddHoleForm
                nextNumber={nextHoleNumber}
                onAdd={addHole}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Visual stamp showing how complete a course is. Three states:
 *
 *  - `complete`: known expected total and every hole filled. Green check.
 *  - `partial`:  some holes filled (with or without a known expected total).
 *  - `empty`:    no holes filled — surfaces the "needs help" framing.
 *
 * Renders nothing if we haven't loaded a summary for this course yet,
 * because guessing is worse than not showing anything.
 */
function CourseFillBadge({ summary }: { summary: CourseSummary | undefined }) {
  if (!summary) return null
  const { holesFilled, totalHoles } = summary
  if (totalHoles != null && holesFilled >= totalHoles) {
    return (
      <span className="course-badge course-badge-complete">
        ✓ {totalHoles}/{totalHoles}
      </span>
    )
  }
  if (holesFilled === 0) {
    return (
      <span className="course-badge course-badge-empty">
        {totalHoles != null ? `0/${totalHoles}` : '0 holes'} · needs help
      </span>
    )
  }
  return (
    <span className="course-badge course-badge-partial">
      {totalHoles != null
        ? `${holesFilled}/${totalHoles}`
        : `${holesFilled} hole${holesFilled === 1 ? '' : 's'}`}
    </span>
  )
}

interface HoleEditorProps {
  hole: CourseHole
  onChange: (patch: Partial<CourseHole>) => void
  onDelete: () => void
}

function HoleEditor({ hole, onChange, onDelete }: HoleEditorProps) {
  return (
    <div className="hole-editor">
      <div className="hole-editor-top">
        <strong>Hole {hole.number}</strong>
        <button
          type="button"
          className="link-button danger"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      <div className="hole-editor-grid">
        <label>
          <span>Distance (ft)</span>
          <input
            type="number"
            min={50}
            max={1500}
            step={5}
            value={hole.distance}
            onChange={e => onChange({ distance: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          <span>Par</span>
          <input
            type="number"
            min={2}
            max={6}
            value={hole.par ?? ''}
            onChange={e => {
              const v = e.target.value
              onChange({ par: v === '' ? null : Number(v) })
            }}
          />
        </label>
        <label>
          <span>Direction</span>
          <select
            value={hole.direction}
            onChange={e => onChange({ direction: e.target.value as HoleDirection })}
          >
            {DIRECTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Elevation</span>
          <select
            value={hole.elevation}
            onChange={e => onChange({ elevation: e.target.value as Elevation })}
          >
            {ELEVATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tee faces</span>
          <select
            value={hole.teeBearing}
            onChange={e => onChange({ teeBearing: e.target.value as TeeBearing })}
          >
            {TEE_BEARING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Terrain</span>
          <select
            value={hole.terrain}
            onChange={e => onChange({ terrain: e.target.value as Terrain })}
          >
            {TERRAIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Trees</span>
          <select
            value={hole.treeCoverage}
            onChange={e => {
              const next = e.target.value as TreeCoverage
              onChange({
                treeCoverage: next,
                treeLayout:
                  next === 'open'
                    ? 'none'
                    : hole.treeLayout === 'none'
                      ? 'throughout'
                      : hole.treeLayout,
              })
            }}
          >
            {TREE_COVERAGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {hole.treeCoverage !== 'open' && (
          <label>
            <span>Tree layout</span>
            <select
              value={hole.treeLayout === 'none' ? 'throughout' : hole.treeLayout}
              onChange={e =>
                onChange({ treeLayout: e.target.value as TreeLayout })
              }
            >
              {TREE_LAYOUT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Mando</span>
          <select
            value={hole.mando ?? 'none'}
            onChange={e => onChange({ mando: e.target.value as MandoRoute })}
          >
            {MANDO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="hole-editor-notes">
          <span>Notes</span>
          <input
            type="text"
            value={hole.notes ?? ''}
            onChange={e => onChange({ notes: e.target.value || null })}
            placeholder="OB right, water short…"
          />
        </label>
      </div>
    </div>
  )
}

interface AddHoleFormProps {
  nextNumber: number
  onAdd: (input: {
    number: number
    distance: number
    par: number | null
    direction: HoleDirection
    elevation: Elevation
    terrain: Terrain
    treeCoverage: TreeCoverage
    treeLayout: TreeLayout
    mando: MandoRoute
    teeBearing: TeeBearing
    notes: string | null
  }) => Promise<boolean>
}

function AddHoleForm({ nextNumber, onAdd }: AddHoleFormProps) {
  const [number, setNumber] = useState<string>(String(nextNumber))
  const [distance, setDistance] = useState<string>('')
  const [par, setPar] = useState<string>('3')
  const [direction, setDirection] = useState<HoleDirection>('straight')
  const [elevation, setElevation] = useState<Elevation>('flat')
  const [terrain, setTerrain] = useState<Terrain>('flat')
  const [treeCoverage, setTreeCoverage] = useState<TreeCoverage>('open')
  const [treeLayout, setTreeLayout] = useState<TreeLayout>('none')
  const [mando, setMando] = useState<MandoRoute>('none')
  const [teeBearing, setTeeBearing] = useState<TeeBearing>('north')
  const [notes, setNotes] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setNumber(String(nextNumber))
  }, [nextNumber])

  function changeTreeCoverage(next: TreeCoverage) {
    setTreeCoverage(next)
    setTreeLayout(
      next === 'open'
        ? 'none'
        : treeLayout === 'none'
          ? 'throughout'
          : treeLayout,
    )
  }

  async function submit() {
    const numN = Number(number)
    const distN = Number(distance)
    if (!Number.isFinite(numN) || numN <= 0) {
      setFormError('Enter a valid hole number.')
      return
    }
    if (!Number.isFinite(distN) || distN <= 0) {
      setFormError('Enter a distance in feet.')
      return
    }
    setFormError(null)
    setBusy(true)
    const ok = await onAdd({
      number: numN,
      distance: distN,
      par: par.trim() === '' ? null : Number(par),
      direction,
      elevation,
      terrain,
      treeCoverage,
      treeLayout,
      mando,
      teeBearing,
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (!ok) return
    setNumber(String(numN + 1))
    setDistance('')
    setNotes('')
  }

  return (
    <div className="add-hole-form">
      <h3>Add a hole</h3>
      <div className="hole-editor-grid">
        <label>
          <span>#</span>
          <input
            type="number"
            min={1}
            value={number}
            onChange={e => setNumber(e.target.value)}
          />
        </label>
        <label>
          <span>Distance (ft)</span>
          <input
            type="number"
            min={50}
            max={1500}
            step={5}
            value={distance}
            onChange={e => setDistance(e.target.value)}
          />
        </label>
        <label>
          <span>Par</span>
          <input
            type="number"
            min={2}
            max={6}
            value={par}
            onChange={e => setPar(e.target.value)}
          />
        </label>
        <label>
          <span>Direction</span>
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as HoleDirection)}
          >
            {DIRECTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Elevation</span>
          <select
            value={elevation}
            onChange={e => setElevation(e.target.value as Elevation)}
          >
            {ELEVATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tee faces</span>
          <select
            value={teeBearing}
            onChange={e => setTeeBearing(e.target.value as TeeBearing)}
          >
            {TEE_BEARING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Terrain</span>
          <select
            value={terrain}
            onChange={e => setTerrain(e.target.value as Terrain)}
          >
            {TERRAIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Trees</span>
          <select
            value={treeCoverage}
            onChange={e => changeTreeCoverage(e.target.value as TreeCoverage)}
          >
            {TREE_COVERAGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {treeCoverage !== 'open' && (
          <label>
            <span>Tree layout</span>
            <select
              value={treeLayout === 'none' ? 'throughout' : treeLayout}
              onChange={e => setTreeLayout(e.target.value as TreeLayout)}
            >
              {TREE_LAYOUT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Mando</span>
          <select value={mando} onChange={e => setMando(e.target.value as MandoRoute)}>
            {MANDO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="hole-editor-notes">
          <span>Notes</span>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="OB right, water short…"
          />
        </label>
      </div>
      {formError && <div className="form-error small">{formError}</div>}
      <button
        type="button"
        className="btn-secondary"
        onClick={submit}
        disabled={!distance.trim() || busy}
      >
        {busy ? 'Adding…' : 'Add hole'}
      </button>
    </div>
  )
}
