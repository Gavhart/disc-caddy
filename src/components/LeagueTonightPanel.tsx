import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { listCourses } from '../lib/courses'
import {
  checkInLeagueSession,
  checkOutLeagueSession,
  closeLeagueSession,
  fetchLeagueTonight,
  notifyLeagueSessionCards,
  openLeagueSession,
  shuffleLeagueSessionCards,
} from '../lib/leagues'
import { playModeLabel } from '../data/leagueFeatures'
import { League, LeagueMemberOption, LeagueSessionCard, LeagueTonight } from '../types'
import { LeagueSessionRoundModal } from './LeagueSessionRoundModal'

interface Props {
  league: League
  members: LeagueMemberOption[]
  isPro: boolean
  busy: boolean
  onBusy: (v: boolean) => void
  onError: (msg: string | null) => void
}

export function LeagueTonightPanel({
  league,
  members,
  isPro,
  busy,
  onBusy,
  onError,
}: Props) {
  const { user } = useAuth()
  const [tonight, setTonight] = useState<LeagueTonight | null>(null)
  const [loading, setLoading] = useState(true)
  const [courseId, setCourseId] = useState('')
  const [courses, setCourses] = useState<{ id: string; name: string; locality: string | null }[]>(
    [],
  )
  const [startRoundCard, setStartRoundCard] = useState<LeagueSessionCard | null>(null)
  const [notifyInfo, setNotifyInfo] = useState<string | null>(null)

  const checkedInIds = useMemo(
    () => new Set(tonight?.checkins.map(c => c.userId) ?? []),
    [tonight?.checkins],
  )

  const myCheckedIn = tonight?.checkins.some(c => c.isMe) ?? false
  const sessionOpen = tonight?.session?.status === 'open'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchLeagueTonight(league.id), listCourses()])
      .then(([data, courseList]) => {
        if (cancelled) return
        setTonight(data)
        setCourses(courseList.map(c => ({ id: c.id, name: c.name, locality: c.locality })))
        if (data.session?.courseId) {
          setCourseId(data.session.courseId)
        } else if (courseList[0]) {
          setCourseId(courseList[0].id)
        }
      })
      .catch(err => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Could not load league night')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [league.id, onError])

  async function handleOpenSession() {
    if (!league.isAdmin) return
    onBusy(true)
    onError(null)
    try {
      setTonight(await openLeagueSession(league.id, courseId || null))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not open league night')
    } finally {
      onBusy(false)
    }
  }

  async function handleCloseSession() {
    if (!league.isAdmin || !tonight?.session) return
    if (!window.confirm('Close tonight’s league night? Card assignments stay in history.')) return
    onBusy(true)
    onError(null)
    try {
      setTonight(await closeLeagueSession(tonight.session.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not close league night')
    } finally {
      onBusy(false)
    }
  }

  async function handleCheckIn(userId?: string) {
    if (!tonight?.session) return
    onBusy(true)
    onError(null)
    try {
      setTonight(await checkInLeagueSession(tonight.session.id, userId))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not check in')
    } finally {
      onBusy(false)
    }
  }

  async function handleCheckOut(userId: string) {
    if (!tonight?.session) return
    if (!league.isAdmin && userId !== user?.id) return
    onBusy(true)
    onError(null)
    try {
      setTonight(await checkOutLeagueSession(tonight.session.id, userId))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not remove check-in')
    } finally {
      onBusy(false)
    }
  }

  async function handleShuffleCards() {
    if (!league.isAdmin || !tonight?.session) return
    onBusy(true)
    onError(null)
    try {
      setTonight(await shuffleLeagueSessionCards(tonight.session.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not shuffle cards')
    } finally {
      onBusy(false)
    }
  }

  async function handleNotifyCards() {
    if (!league.isAdmin || !tonight?.session) return
    onBusy(true)
    onError(null)
    setNotifyInfo(null)
    try {
      const result = await notifyLeagueSessionCards(tonight.session.id)
      setTonight(result.tonight)
      setNotifyInfo(`Notified ${result.notified} player${result.notified === 1 ? '' : 's'}.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not notify players')
    } finally {
      onBusy(false)
    }
  }

  if (loading) {
    return <p className="muted">Loading league night…</p>
  }

  return (
    <div className="league-tonight-panel">
      <div className="league-tonight-head">
        <div>
          <h3>League night</h3>
          <p className="muted small">
            Check players in, shuffle cards, and push pairings — {playModeLabel(league.playMode)}{' '}
            league.
          </p>
        </div>
        {sessionOpen && (
          <span className="league-tonight-live-badge">Tonight open</span>
        )}
      </div>

      {!sessionOpen && (
        <div className="card league-tonight-empty">
          {league.isAdmin ? (
            <>
              <p className="muted small">
                Open tonight’s session so members can check in before you shuffle cards.
              </p>
              {courses.length > 0 && (
                <label className="league-tonight-course">
                  Course (optional)
                  <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                    <option value="">Pick later</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.locality ? ` · ${c.locality}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void handleOpenSession()}
              >
                Open league night
              </button>
            </>
          ) : (
            <p className="muted small">
              No league night open yet — your admin will open check-in when everyone arrives.
            </p>
          )}
        </div>
      )}

      {sessionOpen && tonight?.session && (
        <>
          <div className="league-tonight-stats muted small">
            <span>
              {tonight.checkedInCount} / {tonight.memberCount} checked in
            </span>
            {tonight.cards.length > 0 && (
              <span>{tonight.cards.length} card{tonight.cards.length === 1 ? '' : 's'}</span>
            )}
          </div>

          {!myCheckedIn && (
            <button
              type="button"
              className="btn-primary league-tonight-checkin-self"
              disabled={busy}
              onClick={() => void handleCheckIn()}
            >
              Check me in
            </button>
          )}

          <div className="league-tonight-checkins card">
            <h4>Check-in</h4>
            <ul className="league-tonight-member-list">
              {members.map(m => {
                const checkedIn = checkedInIds.has(m.userId)
                const canUndo = league.isAdmin || m.userId === user?.id
                return (
                  <li key={m.userId} className="league-tonight-member-row">
                    <span className="league-tonight-member-name">{m.displayName}</span>
                    {checkedIn ? (
                      <>
                        <span className="league-tonight-checked">Checked in</span>
                        {canUndo && (
                          <button
                            type="button"
                            className="link-button small"
                            disabled={busy}
                            onClick={() => void handleCheckOut(m.userId)}
                          >
                            Undo
                          </button>
                        )}
                      </>
                    ) : league.isAdmin ? (
                      <button
                        type="button"
                        className="btn-secondary small"
                        disabled={busy}
                        onClick={() => void handleCheckIn(m.userId)}
                      >
                        Check in
                      </button>
                    ) : (
                      <span className="muted small">Not here</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {league.isAdmin && (
            <div className="league-tonight-admin card">
              <h4>Card assignment</h4>
              <p className="muted small">
                Shuffle checked-in players into{' '}
                {league.playMode === 'doubles' ? 'doubles pairs' : 'groups of up to 4'}. Odd player
                out sits this round.
              </p>
              <div className="league-tonight-admin-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || tonight.checkedInCount < 2}
                  onClick={() => void handleShuffleCards()}
                >
                  Shuffle cards
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || tonight.cards.length === 0}
                  onClick={() => void handleNotifyCards()}
                >
                  Notify cards
                </button>
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() => void handleCloseSession()}
                >
                  Close league night
                </button>
              </div>
              {notifyInfo && <p className="muted small league-tonight-notify">{notifyInfo}</p>}
            </div>
          )}

          {tonight.sitOut && (
            <p className="league-tonight-sit-out muted small">
              Sitting out: <strong>{tonight.sitOut.displayName}</strong>
            </p>
          )}

          {tonight.cards.length > 0 && (
            <div className="league-tonight-cards">
              <h4>Cards</h4>
              <ul className="league-tonight-card-grid">
                {tonight.cards.map(card => {
                  const onMyCard = card.members.some(m => m.isMe)
                  return (
                    <li
                      key={card.id}
                      className={`card league-tonight-card${onMyCard ? ' league-tonight-card-mine' : ''}`}
                    >
                      <div className="league-tonight-card-head">
                        <strong>{card.label}</strong>
                        {onMyCard && <span className="league-tonight-you-badge">Your card</span>}
                      </div>
                      <ul className="league-tonight-card-roster">
                        {card.members.map(m => (
                          <li key={m.userId}>{m.displayName}</li>
                        ))}
                      </ul>
                      {onMyCard && (
                        <button
                          type="button"
                          className="btn-primary small"
                          disabled={busy}
                          onClick={() => setStartRoundCard(card)}
                        >
                          Start live round
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {startRoundCard && (
        <LeagueSessionRoundModal
          card={startRoundCard}
          isPro={isPro}
          onClose={() => setStartRoundCard(null)}
          onError={onError}
        />
      )}
    </div>
  )
}
