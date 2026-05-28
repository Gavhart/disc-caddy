import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { VENMO_INTEGRATION } from '../data/venmoIntegration'
import { updateLeaguePotSettings } from '../lib/leagues'
import {
  buildVenmoNote,
  formatVenmoHandle,
  isValidVenmoUsername,
  openVenmoPay,
  VENMO_PAY_TEMPLATES,
} from '../lib/venmo'
import type { LeaguePot } from '../types'
import { GreatForList } from './GreatForList'

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface Props {
  leagueId: string
  leagueName: string
  pot: LeaguePot | null
  isAdmin: boolean
  busy: boolean
  userVenmoUsername?: string | null
  onBusy: (v: boolean) => void
  onError: (msg: string | null) => void
  onPotUpdated: (pot: LeaguePot) => void
}

export function VenmoIntegrationPanel({
  leagueId,
  leagueName,
  pot,
  isAdmin,
  busy,
  userVenmoUsername,
  onBusy,
  onError,
  onPotUpdated,
}: Props) {
  const [adminVenmo, setAdminVenmo] = useState('')
  const [adminEntryFee, setAdminEntryFee] = useState('')
  const [customAmount, setCustomAmount] = useState('')

  useEffect(() => {
    setAdminVenmo(pot?.venmoUsername ?? '')
    setAdminEntryFee(
      pot && pot.entryFeeCents > 0 ? (pot.entryFeeCents / 100).toFixed(2) : '',
    )
    setCustomAmount(
      pot && pot.entryFeeCents > 0 ? (pot.entryFeeCents / 100).toFixed(2) : '',
    )
  }, [pot?.id, pot?.venmoUsername, pot?.entryFeeCents])

  const treasurerHandle = formatVenmoHandle(pot?.venmoUsername)

  const suggestedAmount =
    pot && pot.entryFeeCents > 0 ? pot.entryFeeCents / 100 : undefined

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin) return

    const venmo = adminVenmo.trim()
    if (venmo && !isValidVenmoUsername(venmo)) {
      onError('Venmo username can only use letters, numbers, hyphens, and underscores.')
      return
    }

    const entryRaw = adminEntryFee.trim()
    let entryFeeCents = 0
    if (entryRaw !== '') {
      const dollars = Number(entryRaw)
      if (!Number.isFinite(dollars) || dollars < 0) {
        onError('Enter a valid entry fee (or leave blank).')
        return
      }
      entryFeeCents = Math.round(dollars * 100)
    }

    onBusy(true)
    onError(null)
    try {
      const updated = await updateLeaguePotSettings(leagueId, {
        venmoUsername: venmo.length > 0 ? venmo : null,
        entryFeeCents,
      })
      onPotUpdated(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save Venmo settings')
    } finally {
      onBusy(false)
    }
  }

  function payViaVenmo(templateNote: string, amountDollars?: number) {
    if (!pot?.venmoUsername) {
      onError('League admin has not set a Venmo handle yet.')
      return
    }
    openVenmoPay({
      username: pot.venmoUsername,
      amountDollars,
      note: buildVenmoNote(leagueName, templateNote),
    })
  }

  function handleCustomPay(e: FormEvent) {
    e.preventDefault()
    const dollars = Number(customAmount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      onError('Enter a valid payment amount')
      return
    }
    payViaVenmo('League payment', dollars)
  }

  return (
    <div className="league-venmo-panel">
      <div className="league-venmo-head">
        <h4>{VENMO_INTEGRATION.title}</h4>
        <GreatForList items={VENMO_INTEGRATION.greatFor} />
      </div>

      {isAdmin && (
        <form onSubmit={handleSaveSettings} className="league-venmo-admin">
          <p className="muted small">
            Set the league treasurer Venmo and suggested buy-in. Members get one-tap pay links on
            this tab.
          </p>
          <label>
            Treasurer Venmo
            <input
              value={adminVenmo}
              onChange={e => setAdminVenmo(e.target.value)}
              placeholder="@LeagueTreasurer"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Suggested buy-in ($)
            <input
              type="number"
              min={0}
              step={0.01}
              value={adminEntryFee}
              onChange={e => setAdminEntryFee(e.target.value)}
              placeholder="5.00"
            />
          </label>
          <button type="submit" className="btn-secondary" disabled={busy}>
            Save Venmo settings
          </button>
        </form>
      )}

      {treasurerHandle ? (
        <>
          <p className="small">
            Pay <strong>{treasurerHandle}</strong>
            {pot && pot.entryFeeCents > 0 && (
              <>
                {' '}
                · suggested {formatMoney(pot.entryFeeCents)}
              </>
            )}
          </p>
          <div className="league-venmo-templates">
            {VENMO_PAY_TEMPLATES.map(template => (
              <button
                key={template.id}
                type="button"
                className="btn-secondary league-venmo-template-btn"
                disabled={busy}
                onClick={() => payViaVenmo(template.note, suggestedAmount)}
              >
                {template.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleCustomPay} className="league-venmo-custom">
            <label>
              Custom amount ($)
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="10.00"
                required
              />
            </label>
            <button type="submit" className="btn-primary" disabled={busy}>
              Pay via Venmo
            </button>
          </form>
          <p className="muted small">
            After paying in Venmo, log your contribution below so the pot balance stays accurate.
          </p>
        </>
      ) : (
        <p className="muted small">
          {isAdmin
            ? 'Add a treasurer Venmo above to enable buy-in links for ace pots, skins, dues, and mini buy-ins.'
            : 'Your league admin can add a treasurer Venmo handle here for one-tap buy-ins.'}
        </p>
      )}

      {userVenmoUsername && (
        <p className="muted small league-venmo-profile">
          Your Venmo for payouts: <strong>{formatVenmoHandle(userVenmoUsername)}</strong>
          {' · '}
          <Link to="/settings" className="small">
            Edit in Settings
          </Link>
        </p>
      )}
    </div>
  )
}
