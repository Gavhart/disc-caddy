import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPlayingToday } from '../lib/checkins'
import { CourseCheckin } from '../types'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

function groupByCourse(rows: CourseCheckin[]): Map<string, CourseCheckin[]> {
  const map = new Map<string, CourseCheckin[]>()
  for (const row of rows) {
    const key = row.courseId
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}

export function PlayingTodayPanel() {
  const [rows, setRows] = useState<CourseCheckin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPlayingToday()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const grouped = groupByCourse(rows)

  return (
    <div className="card playing-today">
      <h2>Playing today</h2>
      <p className="muted small">
        Players who checked in at a course in the last 14 hours (Community-visible
        only).{' '}
        <Link to="/community" className="link-button">
          Check in from Community
        </Link>
      </p>

      {loading ? (
        <p className="muted small">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted small">Nobody checked in yet — be the first.</p>
      ) : (
        <ul className="playing-today-list">
          {[...grouped.entries()].map(([courseId, players]) => {
            const first = players[0]
            const place = [first.courseName, first.courseLocality]
              .filter(Boolean)
              .join(', ')
            return (
              <li key={courseId} className="playing-today-course">
                <div className="playing-today-course-head">
                  <strong>{place}</strong>
                  <span className="pill small">{players.length} playing</span>
                </div>
                <ul className="playing-today-players">
                  {players.map(p => (
                    <li key={p.userId}>
                      <strong>{p.displayName}</strong>
                      <span className="muted small"> · {formatWhen(p.checkedInAt)}</span>
                      {p.note && <span className="muted small"> · {p.note}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
