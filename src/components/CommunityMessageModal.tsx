import { FormEvent, useState } from 'react'
import { CommunityMember } from '../types'

interface Props {
  member: CommunityMember
  sending: boolean
  error: string | null
  onClose: () => void
  onSend: (body: string) => Promise<void>
}

export function CommunityMessageModal({
  member,
  sending,
  error,
  onClose,
  onSend,
}: Props) {
  const [body, setBody] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    await onSend(text)
  }

  return (
    <div className="community-modal-backdrop" onClick={onClose}>
      <form
        className="community-modal card"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="community-modal-header">
          <h3>Message {member.displayName}</h3>
          <button type="button" className="link-button" onClick={onClose} disabled={sending}>
            Close
          </button>
        </div>
        <p className="muted small">
          They&apos;ll see this in their Community inbox. Share when you usually
          play or ask to join a card.
        </p>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Hey — I'm looking for a Saturday morning round at…"
          rows={5}
          maxLength={2000}
          autoFocus
          disabled={sending}
        />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
