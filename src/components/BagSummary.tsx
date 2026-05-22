import { Link } from 'react-router-dom'

interface Props {
  bagName: string | null
  discCount: number
}

export function BagSummary({ bagName, discCount }: Props) {
  const label = bagName ?? 'No bag selected'
  const countLabel = `${discCount} disc${discCount === 1 ? '' : 's'}`

  return (
    <div className="bag-summary">
      <span className="bag-summary-text">
        <strong>{label}</strong>
        <span className="muted"> · {countLabel}</span>
      </span>
      <Link to="/bags" className="link-button bag-summary-link">
        Manage bag
      </Link>
    </div>
  )
}
