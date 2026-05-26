import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCoursesNearMe, mapsUrl } from '../lib/courseDiscovery'
import { NearbyCourse } from '../types'
import { CourseDiscoveryMap } from './CourseDiscoveryMap'

export function CourseDiscoveryPanel() {
  const [courses, setCourses] = useState<NearbyCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    listCoursesNearMe(75)
      .then(list => {
        const near = list.filter(c => c.distanceMiles != null)
        setCourses(near)
        if (near[0]) setSelectedId(near[0].id)
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false))
  }, [])

  const mappable = courses.filter(c => c.lat != null && c.lon != null)

  if (loading) return null
  if (courses.length === 0) {
    return (
      <div className="card course-discovery">
        <h2>Courses near you</h2>
        <p className="muted small">
          Save your home area on{' '}
          <Link to="/community">Community</Link> — nearby courses import automatically
          from DiscGolfAPI.
        </p>
      </div>
    )
  }

  return (
    <div className="card course-discovery">
      <h2>Courses near you</h2>
      {mappable.length > 0 && (
        <CourseDiscoveryMap
          courses={courses}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      <ul className="course-discovery-list">
        {courses.slice(0, 12).map(c => (
          <li
            key={c.id}
            className={`course-discovery-item${selectedId === c.id ? ' course-discovery-item-selected' : ''}`}
          >
            <button
              type="button"
              className="course-discovery-select"
              onClick={() => setSelectedId(c.id)}
            >
              <strong>{c.name}</strong>
              {c.locality && <span className="muted small"> · {c.locality}</span>}
              <div className="muted small">
                ~{c.distanceMiles?.toFixed(1)} mi · {c.roundsLogged} rounds logged
              </div>
            </button>
            {c.lat != null && c.lon != null && (
              <a
                href={mapsUrl(c.lat, c.lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Directions
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
