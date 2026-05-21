import { ChangeEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { deleteDiscPhoto, getDiscPhotoUrl, uploadDiscPhoto } from '../lib/photos'
import { updateBagDisc } from '../lib/bags'

interface Props {
  discId: string
  photoPath: string | null
  onChange: (newPath: string | null) => void
}

export function DiscPhotoUploader({ discId, photoPath, onChange }: Props) {
  const { user, me } = useAuth()
  const isPro = me?.isPro ?? false
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (photoPath) {
      getDiscPhotoUrl(photoPath).then(setUrl).catch(() => setUrl(null))
    } else {
      setUrl(null)
    }
  }, [photoPath])

  if (!isPro) {
    return (
      <div className="photo-paywall">
        <div className="photo-placeholder" aria-hidden>
          🥏
        </div>
        <Link to="/upgrade" className="upgrade-pill">
          Pro: add photo
        </Link>
      </div>
    )
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      // Replace existing photo if any.
      if (photoPath) {
        await deleteDiscPhoto(photoPath).catch(() => {})
      }
      const newPath = await uploadDiscPhoto(user.id, discId, file)
      await updateBagDisc(discId, { photoPath: newPath })
      onChange(newPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!photoPath) return
    setBusy(true)
    try {
      await deleteDiscPhoto(photoPath).catch(() => {})
      await updateBagDisc(discId, { photoPath: null })
      onChange(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo-uploader">
      {url ? (
        <img src={url} alt="Disc" className="photo-thumb" />
      ) : (
        <div className="photo-placeholder" aria-hidden>
          🥏
        </div>
      )}
      <div className="photo-actions">
        <label className="link-button">
          {photoPath ? 'Replace' : 'Add photo'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            disabled={busy}
            hidden
          />
        </label>
        {photoPath && (
          <button onClick={handleRemove} disabled={busy} className="link-button">
            Remove
          </button>
        )}
      </div>
      {busy && <span className="muted small">Working…</span>}
      {error && <span className="form-error small">{error}</span>}
    </div>
  )
}
