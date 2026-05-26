import { ChangeEvent, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deleteDiscPhoto, uploadProfilePhoto } from '../lib/photos'
import { updateProfileAvatar } from '../lib/profile'
import { ProfileAvatar } from './ProfileAvatar'

interface Props {
  avatarPath: string | null
  displayName: string | null
  onChange: (path: string | null) => void
}

export function ProfilePhotoUploader({ avatarPath, displayName, onChange }: Props) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      if (avatarPath) {
        await deleteDiscPhoto(avatarPath).catch(() => {})
      }
      const newPath = await uploadProfilePhoto(user.id, file)
      await updateProfileAvatar(user.id, newPath)
      onChange(newPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!avatarPath || !user) return
    setBusy(true)
    setError(null)
    try {
      await deleteDiscPhoto(avatarPath).catch(() => {})
      await updateProfileAvatar(user.id, null)
      onChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-photo-uploader">
      <button
        type="button"
        className="profile-photo-trigger"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={avatarPath ? 'Change profile photo' : 'Add profile photo'}
      >
        <ProfileAvatar
          displayName={displayName}
          avatarPath={avatarPath}
          size="lg"
        />
        <span className="profile-photo-badge" aria-hidden>
          {avatarPath ? '✎' : '+'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={busy}
        hidden
      />
      <p className="muted small profile-photo-hint">
        {busy ? 'Uploading…' : avatarPath ? 'Tap to change photo' : 'Tap to add a photo'}
      </p>
      {avatarPath && (
        <button
          type="button"
          className="link-button profile-photo-remove"
          onClick={handleRemove}
          disabled={busy}
        >
          Remove photo
        </button>
      )}
      {error && <div className="form-error small">{error}</div>}
    </div>
  )
}
