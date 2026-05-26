import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RoundInvite } from '../types'
import { respondRoundInvite } from '../lib/roundInvites'

interface Props {
  invites: RoundInvite[]
  onChange: () => void | Promise<void>
}

export function RoundInviteBanner({ invites, onChange }: Props) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  async function respond(invite: RoundInvite, accept: boolean) {
    setBusyId(invite.id)
    setError(null)
    try {
      await respondRoundInvite(invite.id, accept)
      await onChange()
      if (accept) navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not respond to invite')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card round-invite-banner">
      <h2>Scorecard invites</h2>
      {error && <div className="form-error small">{error}</div>}
      <ul className="round-invite-list">
        {invites.map(invite => {
          const place =
            invite.courseName?.trim() ||
            (invite.courseId ? 'their course' : 'a round')
          return (
            <li key={invite.id} className="round-invite-item">
              <p>
                <strong>{invite.inviterName}</strong> invited you to join their
                scorecard at <strong>{place}</strong>.
              </p>
              <div className="round-invite-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === invite.id}
                  onClick={() => respond(invite, true)}
                >
                  {busyId === invite.id ? 'Joining…' : 'Join scorecard'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === invite.id}
                  onClick={() => respond(invite, false)}
                >
                  Decline
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
