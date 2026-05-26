import { useEffect, useState } from 'react'
import { fetchHoleNote, saveHoleNote } from '../lib/holeNotes'

interface Props {
  courseId: string | null
  holeNumber: number | null
}

export function HoleNoteEditor({ courseId, holeNumber }: Props) {
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!courseId || holeNumber == null) {
      setNote('')
      setDraft('')
      setLoaded(false)
      return
    }
    setLoaded(false)
    fetchHoleNote(courseId, holeNumber)
      .then(existing => {
        setNote(existing ?? '')
        setDraft(existing ?? '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [courseId, holeNumber])

  if (!courseId || holeNumber == null || !loaded) return null

  async function handleSave() {
    if (!courseId || holeNumber == null) return
    setSaving(true)
    try {
      await saveHoleNote(courseId, holeNumber, draft)
      setNote(draft.trim())
      setOpen(false)
    } catch (err) {
      console.error('[holeNotes] save failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card hole-note-card">
      <div className="hole-note-header">
        <h3>Hole {holeNumber} note</h3>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setDraft(note)
            setOpen(v => !v)
          }}
        >
          {open ? 'Cancel' : note ? 'Edit' : 'Add note'}
        </button>
      </div>
      {!open && note && <p className="hole-note-text">{note}</p>}
      {!open && !note && (
        <p className="muted small">
          Optional map note for this hole (e.g. hyzer skip off the big pine).
        </p>
      )}
      {open && (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Hyzer skip off the big pine…"
            rows={3}
            disabled={saving}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </>
      )}
    </div>
  )
}
