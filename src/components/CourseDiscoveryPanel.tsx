import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCoursesNearMe, mapsUrl } from '../lib/courseDiscovery'
import { NearbyCourse } from '../types'

export function CourseDiscoveryPanel() {
  const [courses, setCourses] = useState<NearbyCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCoursesNearMe(75)
      .then(list => setCourses(list.filter(c => c.distanceMiles != null).slice(0, 12)))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (courses.length === 0) {
    return (
      <div className="card course-discovery">
        <h2>Courses near you</h2>
        <p className="muted small">
          Add a GPS home area on{' '}
          <Link to="/community">Community</Link> to see nearby courses with map pins.
        </p>
      </div>
    )
  }

  return (
    <div className="card course-discovery">
      <h2>Courses near you</h2>
      <ul className="course-discovery-list">
        {courses.map(c => (
          <li key={c.id} className="course-discovery-item">
            <div>
              <strong>{c.name}</strong>
              {c.locality && <span className="muted small"> · {c.locality}</span>}
              <div className="muted small">
                ~{c.distanceMiles?.toFixed(1)} mi · {c.roundsLogged} rounds logged
              </div>
            </div>
            {c.lat != null && c.lon != null && (
              <a
                href={mapsUrl(c.lat, c.lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Map
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
