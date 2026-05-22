import { Hand, ThrowStyle } from '../types'
import { armSpeedFromMaxDistance, skillTier } from '../lib/armspeed'

export interface ProfileFieldsValue {
  displayName: string
  maxDistance: number
  dominantHand: Hand
  primaryThrow: ThrowStyle
}

interface Props {
  value: ProfileFieldsValue
  onChange: (next: ProfileFieldsValue) => void
  idPrefix?: string
}

export function SignupProfileFields({ value, onChange, idPrefix = 'profile' }: Props) {
  const armSpeed = armSpeedFromMaxDistance(value.maxDistance)
  const tier = skillTier(value.maxDistance)

  function patch(partial: Partial<ProfileFieldsValue>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="signup-profile-fields">
      <p className="auth-section-label">About you</p>

      <label htmlFor={`${idPrefix}-name`}>Display name</label>
      <input
        id={`${idPrefix}-name`}
        type="text"
        autoComplete="name"
        required
        minLength={2}
        maxLength={40}
        placeholder="How should we greet you?"
        value={value.displayName}
        onChange={e => patch({ displayName: e.target.value })}
      />

      <label htmlFor={`${idPrefix}-maxDist`}>Max distance with a driver</label>
      <div className="input-group">
        <input
          id={`${idPrefix}-maxDist`}
          type="number"
          min={100}
          max={700}
          step={10}
          required
          value={value.maxDistance}
          onChange={e => patch({ maxDistance: Number(e.target.value) || 0 })}
        />
        <span className="suffix">ft</span>
      </div>
      <div className="meta auth-meta">
        <span className="pill">{tier}</span>
        <span className="muted small">
          Est. arm speed: <strong>{armSpeed} mph</strong>
        </span>
      </div>

      <div className="setting-row auth-setting-row">
        <span className="setting-label">Dominant hand</span>
        <div className="segmented">
          <button
            type="button"
            className={value.dominantHand === 'right' ? 'segmented-on' : ''}
            onClick={() => patch({ dominantHand: 'right' })}
          >
            Right
          </button>
          <button
            type="button"
            className={value.dominantHand === 'left' ? 'segmented-on' : ''}
            onClick={() => patch({ dominantHand: 'left' })}
          >
            Left
          </button>
        </div>
      </div>

      <div className="setting-row auth-setting-row">
        <span className="setting-label">Primary throw</span>
        <div className="segmented">
          <button
            type="button"
            className={value.primaryThrow === 'backhand' ? 'segmented-on' : ''}
            onClick={() => patch({ primaryThrow: 'backhand' })}
          >
            Backhand
          </button>
          <button
            type="button"
            className={value.primaryThrow === 'forehand' ? 'segmented-on' : ''}
            onClick={() => patch({ primaryThrow: 'forehand' })}
          >
            Forehand
          </button>
        </div>
      </div>
      <p className="muted small">
        Powers your disc recommendations from day one. You can tweak these later
        in Settings.
      </p>
    </div>
  )
}

export const DEFAULT_PROFILE_FIELDS: ProfileFieldsValue = {
  displayName: '',
  maxDistance: 280,
  dominantHand: 'right',
  primaryThrow: 'backhand',
}
