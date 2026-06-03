import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBags } from '../lib/bags'
import { listCourses } from '../lib/courses'
import { startLeagueSessionRound } from '../lib/leagues'
import { Bag, Course, LeagueSessionCard } from '../types'

interface Props {
  card: LeagueSessionCard
  isPro: boolean
  onClose: () => void
  onError: (message: string) => void
}

export function LeagueSessionRoundModal({ card, isPro, onClose, onError }: Props) {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [bags, setBags] = useState<Bag[]>([])
  const [courseId, setCourseId] = useState('')
  const [bagId, setBagId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const roster = useMemo(
    () => card.members.map(m => m.displayName).join(', '),
    [card.members],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([listCourses(), listBags()])
      .then(([courseList, bagList]) => {
        if (cancelled) return
        setCourses(courseList)
        setBags(bagList)
        if (courseList[0]) setCourseId(courseList[0].id)
        if (bagList[0]) setBagId(bagList[0].id)
      })
      .catch(err => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Could not load courses or bags')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onError])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isPro) {
      onError('Live rounds require a Pro subscription.')
      return
    }
    if (!courseId || !bagId) {
      onError('Pick a course and bag to start.')
      return
    }
    setBusy(true)
    onError('')
    try {
      await startLeagueSessionRound({
        cardId: card.id,
        courseId,
        bagId,
      })
      onClose()
      navigate('/')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start card round')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card league-pair-round-modal"
        role="dialog"
        aria-labelledby="league-session-round-title"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="league-session-round-title">Start live card round</h3>
        <p className="muted small">
          <strong>{card.label}</strong> — {roster}. Everyone on this card gets the same live
          scorecard.
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <form onSubmit={e => void handleSubmit(e)} className="league-inline-form">
            <label>
              Course
              <select value={courseId} onChange={e => setCourseId(e.target.value)} required>
                {courses.length === 0 ? (
                  <option value="">No courses yet</option>
                ) : (
                  courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.locality ? ` · ${c.locality}` : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Your bag
              <select value={bagId} onChange={e => setBagId(e.target.value)} required>
                {bags.length === 0 ? (
                  <option value="">Create a bag first</option>
                ) : (
                  bags.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="league-pair-round-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !isPro || !courseId || !bagId}
              >
                {busy ? 'Starting…' : 'Start live round'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
