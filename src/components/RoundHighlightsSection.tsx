import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  addRoundHighlightRecord,
  deleteRoundHighlight,
  listRoundHighlights,
} from '../lib/highlights'
import { deleteDiscPhoto, getDiscPhotoUrl, uploadRoundHighlight } from '../lib/photos'
import { RoundHighlight } from '../types'

function HighlightImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    getDiscPhotoUrl(path).then(setUrl)
  }, [path])

  if (!url) return <div className="round-highlight-placeholder muted small">Loading…</div>

  return <img src={url} alt="" className="round-highlight-img" />
}

export function RoundHighlightsSection({
  roundId,
  canEdit,
}: {
  roundId: string
  canEdit: boolean
}) {
  const { user } = useAuth()
  const [highlights, setHighlights] = useState<RoundHighlight[]>([])
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    listRoundHighlights(roundId)
      .then(setHighlights)
      .catch(() => setHighlights([]))
  }

  useEffect(() => {
    reload()
  }, [roundId])

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !canEdit) return
    const input = e.currentTarget.elements.namedItem('photo') as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      setError('Pick a photo first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const path = await uploadRoundHighlight(user.id, roundId, file)
      await addRoundHighlightRecord(roundId, path, caption.trim() || undefined)
      setCaption('')
      input.value = ''
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload highlight')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(h: RoundHighlight) {
    if (!user || h.userId !== user.id) return
    if (!window.confirm('Remove this highlight?')) return
    setBusy(true)
    setError(null)
    try {
      await deleteRoundHighlight(h.id)
      await deleteDiscPhoto(h.storagePath).catch(() => {})
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete highlight')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card round-highlights">
      <h3>Highlights</h3>
      <p className="muted small">
        Share ace runs, sunset aces, or card photos — friends see them in activity.
      </p>

      {error && <div className="form-error small">{error}</div>}

      {highlights.length > 0 && (
        <ul className="round-highlight-grid">
          {highlights.map(h => (
            <li key={h.id} className="round-highlight-item">
              <HighlightImage path={h.storagePath} />
              {h.caption && <p className="round-highlight-caption">{h.caption}</p>}
              {canEdit && user?.id === h.userId && (
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() => handleDelete(h)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && highlights.length < 4 && (
        <form onSubmit={handleUpload} className="round-highlight-form">
          <label>
            Add photo
            <input name="photo" type="file" accept="image/*" required />
          </label>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            maxLength={200}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            Upload highlight
          </button>
        </form>
      )}
    </div>
  )
}
