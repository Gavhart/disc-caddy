import { useEffect, useMemo, useState } from 'react'
import {
  Course,
  CourseHole,
  Elevation,
  HoleDirection,
} from '../types'
import {
  createCourse,
  createCourseHole,
  deleteCourseHole,
  listCourses,
  listHolesForCourse,
  updateCourseHole,
} from '../lib/courses'
import {
  DGAPI_ATTRIBUTION,
  DGAPI_LICENSE_URL,
  DgApiCourse,
  searchByName,
} from '../lib/discgolfapi'

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

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search + add panel state.
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCountry, setSearchCountry] = useState('US')
  const [searchResults, setSearchResults] = useState<DgApiCourse[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualLocality, setManualLocality] = useState('')

  // Selected course (expanded with hole editor).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [holes, setHoles] = useState<CourseHole[]>([])
  const [holesLoading, setHolesLoading] = useState(false)

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setHoles([])
      return
    }
    setHolesLoading(true)
    listHolesForCourse(selectedId)
      .then(setHoles)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setHolesLoading(false))
  }, [selectedId])

  const selectedCourse = useMemo(
    () => courses.find(c => c.id === selectedId) ?? null,
    [courses, selectedId],
  )

  async function runSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setError(null)
    try {
      const r = await searchByName(searchQuery, { country: searchCountry })
      setSearchResults(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function importFromApi(c: DgApiCourse) {
    setError(null)
    try {
      const created = await createCourse({
        name: c.name,
        locality: c.locality,
        regionCode: c.region_code,
        countryCode: c.country_code,
        lat: c.lat,
        lon: c.lon,
        source: 'discgolfapi',
        sourceId: c.id,
      })
      setCourses(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId(created.id)
      setSearchResults(null)
      setSearchQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  async function createManual() {
    if (!manualName.trim()) return
    setError(null)
    try {
      const created = await createCourse({
        name: manualName,
        locality: manualLocality || null,
      })
      setCourses(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId(created.id)
      setManualName('')
      setManualLocality('')
      setShowManual(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  async function addHole(input: {
    number: number
    distance: number
    par: number | null
    direction: HoleDirection
    elevation: Elevation
    notes: string | null
  }) {
    if (!selectedId) return
    try {
      const created = await createCourseHole({
        courseId: selectedId,
        number: input.number,
        distance: input.distance,
        par: input.par,
        direction: input.direction,
        elevation: input.elevation,
        notes: input.notes,
      })
      setHoles(prev => [...prev, created].sort((a, b) => a.number - b.number))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add hole failed')
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
        notes: patch.notes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function removeHole(holeId: string) {
    if (!confirm('Delete this hole?')) return
    setHoles(prev => prev.filter(h => h.id !== holeId))
    try {
      await deleteCourseHole(holeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>Courses</h2>
          <div className="bag-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => setShowManual(s => !s)}
            >
              {showManual ? 'Cancel manual' : '+ Add manually'}
            </button>
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
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder="e.g. Maple Hill"
              />
              <input
                type="text"
                value={searchCountry}
                onChange={e => setSearchCountry(e.target.value.toUpperCase())}
                placeholder="US"
                maxLength={2}
                style={{ maxWidth: 80 }}
                aria-label="Country code"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={runSearch}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>

          {searchResults !== null && (
            <div className="course-search-results">
              <div className="muted small">
                {DGAPI_ATTRIBUTION} ·{' '}
                <a
                  href={DGAPI_LICENSE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  License
                </a>
              </div>
              {searchResults.length === 0 ? (
                <p className="muted small">No matches in {searchCountry}.</p>
              ) : (
                <ul className="bags-list">
                  {searchResults.map(c => (
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
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {showManual && (
          <div className="course-manual">
            <div className="field-row">
              <label htmlFor="m-name">Course name</label>
              <input
                id="m-name"
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="My Backyard"
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
            <button
              type="button"
              className="btn-secondary"
              onClick={createManual}
              disabled={!manualName.trim()}
            >
              Create course
            </button>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {loading && <p className="muted">Loading…</p>}
      </div>

      {courses.length > 0 && (
        <div className="card">
          <h2>Catalog ({courses.length})</h2>
          <ul className="bags-list">
            {courses.map(c => (
              <li key={c.id} className="bag-list-row">
                <div className="bag-name">
                  {c.name}
                  <div className="muted small">
                    {[c.locality, c.regionCode, c.countryCode]
                      .filter(Boolean)
                      .join(' · ')}
                    {c.source === 'discgolfapi' && (
                      <> · <em>via DiscGolfAPI</em></>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                >
                  {selectedId === c.id ? 'Hide holes' : 'Edit holes'}
                </button>
              </li>
            ))}
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
              {holes.length === 0 ? (
                <p className="muted small">
                  No holes yet. Add the first one below.
                </p>
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
                nextNumber={(holes[holes.length - 1]?.number ?? 0) + 1}
                onAdd={addHole}
              />
            </>
          )}
        </div>
      )}
    </div>
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
    notes: string | null
  }) => void
}

function AddHoleForm({ nextNumber, onAdd }: AddHoleFormProps) {
  const [number, setNumber] = useState<string>(String(nextNumber))
  const [distance, setDistance] = useState<string>('')
  const [par, setPar] = useState<string>('3')
  const [direction, setDirection] = useState<HoleDirection>('straight')
  const [elevation, setElevation] = useState<Elevation>('flat')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    setNumber(String(nextNumber))
  }, [nextNumber])

  function submit() {
    const numN = Number(number)
    const distN = Number(distance)
    if (!Number.isFinite(numN) || numN <= 0) return
    if (!Number.isFinite(distN) || distN <= 0) return
    onAdd({
      number: numN,
      distance: distN,
      par: par.trim() === '' ? null : Number(par),
      direction,
      elevation,
      notes: notes.trim() || null,
    })
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
      <button
        type="button"
        className="btn-secondary"
        onClick={submit}
        disabled={!distance}
      >
        Add hole
      </button>
    </div>
  )
}
