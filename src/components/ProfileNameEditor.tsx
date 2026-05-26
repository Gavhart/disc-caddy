import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updatePlayer } from '../lib/profile'

interface Props {
  /** Larger input on profile hero; compact in settings. */
  variant?: 'hero' | 'compact'
}

export function ProfileNameEditor({ variant = 'compact' }: Props) {
  const { user, me, refreshMe } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!me) return
    setName(me.displayName ?? '')
  }, [me])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter your name.')
      return
    }
    if (trimmed.length > 80) {
      setError('Name must be 80 characters or less.')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updatePlayer(user.id, { displayName: trimmed })
      await refreshMe()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save name')
    } finally {
      setSaving(false)
    }
  }

  if (!me) return null

  return (
    <form
      className={`profile-name-editor profile-name-editor-${variant}`}
      onSubmit={handleSubmit}
    >
      <label htmlFor="profile-display-name">Display name</label>
      <div className="profile-name-row">
        <input
          id="profile-display-name"
          type="text"
          value={name}
          onChange={e => {
            setName(e.target.value)
            setSaved(false)
          }}
          placeholder="Your name"
          maxLength={80}
          autoComplete="name"
          disabled={saving}
        />
        <button type="submit" className="btn-secondary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <div className="form-error small">{error}</div>}
      {saved && <div className="form-success small">Name saved.</div>}
    </form>
  )
}
