import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyHomeCities } from '../lib/community'
import { listCourses } from '../lib/courses'
import {
  cancelScheduledRound,
  createScheduledRound,
  listScheduledRoundAttendees,
  listScheduledRounds,
  rsvpScheduledRound,
} from '../lib/scheduledRounds'
import {
  COMMUNITY_EVENT_RADIUS_MILES,
  CommunityEventPostType,
  Course,
  ScheduledRound,
  ScheduledRoundAttendee,
} from '../types'

type FilterTab = 'all' | CommunityEventPostType

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function postTypeLabel(type: CommunityEventPostType): string {
  return type === 'pickup' ? 'Looking for a group' : 'Event'
}

export function EventsPage() {
  const { me } = useAuth()
  const [rounds, setRounds] = useState<ScheduledRound[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [hasHomeCoords, setHasHomeCoords] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [postType, setPostType] = useState<CommunityEventPostType>('event')
  const [courseId, setCourseId] = useState('')
  const [when, setWhen] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attendees, setAttendees] = useState<Record<string, ScheduledRoundAttendee[]>>({})

  const reload = useCallback(async () => {
    const postTypeFilter = filter === 'all' ? undefined : filter
    const [loaded, homeCities] = await Promise.all([
      listScheduledRounds(40, postTypeFilter).catch(() => [] as ScheduledRound[]),
      fetchMyHomeCities().catch(() => []),
    ])
    setRounds(loaded)
    setHasHomeCoords(
      homeCities.some(c => c.latitude != null && c.longitude != null),
    )
  }, [filter])

  useEffect(() => {
    reload()
    listCourses().then(setCourses).catch(() => setCourses([]))
  }, [reload])

  const myHostedIds = useMemo(
    () => new Set(rounds.filter(r => r.hostId === me?.id).map(r => r.id)),
    [rounds, me?.id],
  )

  async function loadAttendees(id: string) {
    if (attendees[id]) return
    try {
      const list = await listScheduledRoundAttendees(id)
      setAttendees(prev => ({ ...prev, [id]: list }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load attendees')
    }
  }

  async function toggleAttendees(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    await loadAttendees(id)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!courseId || !when) return
    setBusy(true)
    setError(null)
    try {
      await createScheduledRound({
        courseId,
        scheduledAt: new Date(when).toISOString(),
        maxPlayers,
        notes,
        postType,
        visibility: 'community',
      })
      setNotes('')
      setWhen('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create post')
    } finally {
      setBusy(false)
    }
  }

  async function handleRsvp(id: string, status: 'going' | 'maybe' | 'declined') {
    setBusy(true)
    setError(null)
    try {
      await rsvpScheduledRound(id, status)
      setAttendees(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await reload()
      if (expandedId === id && myHostedIds.has(id)) await loadAttendees(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RSVP failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm('Cancel this post? Attendees will no longer see it.')) return
    setBusy(true)
    setError(null)
    try {
      await cancelScheduledRound(id)
      setExpandedId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container events-page">
      <p className="settings-back">
        <Link to="/community">← Back to Community</Link>
      </p>

      <header className="events-header">
        <h1>Events &amp; pickup rounds</h1>
        <p className="muted">
          Post an event or say you want people to play with you. Players within{' '}
          {COMMUNITY_EVENT_RADIUS_MILES} miles of your home areas can see and join.
        </p>
      </header>

      {!hasHomeCoords && (
        <div className="card events-setup-banner">
          <p className="small">
            Add a home area with location on{' '}
            <Link to="/community">Community settings</Link> to see nearby events. You can still
            post your own — others nearby will see it.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Create a post</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleCreate} className="events-form">
          <fieldset className="events-type-toggle">
            <legend className="sr-only">Post type</legend>
            <label className="events-type-option">
              <input
                type="radio"
                name="postType"
                checked={postType === 'event'}
                onChange={() => setPostType('event')}
              />
              <span>
                <strong>Event</strong>
                <span className="muted small">Tournament, league night, group outing…</span>
              </span>
            </label>
            <label className="events-type-option">
              <input
                type="radio"
                name="postType"
                checked={postType === 'pickup'}
                onChange={() => setPostType('pickup')}
              />
              <span>
                <strong>Looking for a group</strong>
                <span className="muted small">I&apos;m playing here — need people to join</span>
              </span>
            </label>
          </fieldset>

          <label>
            Course
            <select value={courseId} onChange={e => setCourseId(e.target.value)} required>
              <option value="">Pick course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.locality ? ` · ${c.locality}` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="events-form-row">
            <label>
              Date &amp; time
              <input
                type="datetime-local"
                value={when}
                onChange={e => setWhen(e.target.value)}
                required
              />
            </label>
            <label>
              Max players
              <input
                type="number"
                min={2}
                max={8}
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={
                postType === 'pickup'
                  ? 'Casual 9, need 2 more, all skill levels welcome…'
                  : 'Weekly doubles, $5 ace pot, bag tags…'
              }
            />
          </label>

          <button type="submit" className="btn-primary" disabled={busy}>
            {postType === 'pickup' ? 'Post pickup round' : 'Create event'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="events-list-header">
          <h2>Nearby ({COMMUNITY_EVENT_RADIUS_MILES} mi)</h2>
          <div className="events-filter-tabs" role="tablist">
            {(['all', 'event', 'pickup'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                className={'events-filter-tab' + (filter === tab ? ' active' : '')}
                onClick={() => setFilter(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'event' ? 'Events' : 'Pickup'}
              </button>
            ))}
          </div>
        </div>

        {rounds.length === 0 ? (
          <p className="muted">No upcoming posts in your area yet. Be the first to create one.</p>
        ) : (
          <ul className="events-list">
            {rounds.map(r => {
              const isHost = r.hostId === me?.id
              const isFull = r.status === 'full' || r.goingCount >= r.maxPlayers
              const showAttendees = isHost && expandedId === r.id

              return (
                <li key={r.id} className="events-item">
                  <div className="events-item-head">
                    <span className={'events-badge events-badge-' + r.postType}>
                      {postTypeLabel(r.postType)}
                    </span>
                    {isHost && <span className="events-host-badge">Your post</span>}
                    {isFull && r.myRsvp !== 'going' && !isHost && (
                      <span className="events-full-badge">Full</span>
                    )}
                  </div>

                  <strong>{r.hostName}</strong>
                  {r.courseName && (
                    <>
                      {' '}
                      at <strong>{r.courseName}</strong>
                      {r.courseLocality && (
                        <span className="muted"> · {r.courseLocality}</span>
                      )}
                    </>
                  )}

                  <p className="events-meta muted small">
                    {formatWhen(r.scheduledAt)}
                    {r.distanceMiles != null && <> · {Math.round(r.distanceMiles)} mi away</>}
                  </p>

                  <p className="events-attendance">
                    <strong>{r.goingCount}</strong>
                    <span className="muted"> / {r.maxPlayers} attending</span>
                    {r.myRsvp === 'going' && (
                      <span className="events-you-going"> · You&apos;re going</span>
                    )}
                    {r.myRsvp === 'maybe' && (
                      <span className="muted"> · You said maybe</span>
                    )}
                  </p>

                  {r.notes && <p className="events-notes small">{r.notes}</p>}

                  {!isHost && r.status !== 'cancelled' && (
                    <div className="events-rsvp">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy || (isFull && r.myRsvp !== 'going')}
                        onClick={() => handleRsvp(r.id, 'going')}
                      >
                        {r.myRsvp === 'going' ? 'Going ✓' : 'Join'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => handleRsvp(r.id, 'maybe')}
                      >
                        Maybe
                      </button>
                      {r.myRsvp && r.myRsvp !== 'declined' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={() => handleRsvp(r.id, 'declined')}
                        >
                          Can&apos;t make it
                        </button>
                      )}
                    </div>
                  )}

                  {isHost && (
                    <div className="events-host-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => toggleAttendees(r.id)}
                      >
                        {showAttendees ? 'Hide attendees' : 'View attendees'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => handleCancel(r.id)}
                      >
                        Cancel post
                      </button>
                    </div>
                  )}

                  {showAttendees && (
                    <ul className="events-attendees">
                      {(attendees[r.id] ?? []).length === 0 ? (
                        <li className="muted small">No RSVPs yet besides you.</li>
                      ) : (
                        attendees[r.id].map(a => (
                          <li key={a.userId}>
                            {a.displayName}
                            <span className="muted">
                              {' '}
                              · {a.status === 'going' ? 'Going' : 'Maybe'}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
