import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isWebCheckoutAvailable } from '../lib/platform'

interface Props {
  /** Short label for what Pro unlocks, e.g. "Live wind" */
  feature: string
  children?: ReactNode
}

/** Inline upsell shown when a Pro-only control is tapped while on free tier. */
export function ProGate({ feature, children }: Props) {
  return (
    <div className="pro-gate">
      <p className="pro-gate-text">
        <strong>{feature}</strong> is a Pro feature.
        {children}
      </p>
      {isWebCheckoutAvailable() && (
        <Link to="/upgrade" className="btn-secondary pro-gate-cta">
          Upgrade to Pro
        </Link>
      )}
    </div>
  )
}
