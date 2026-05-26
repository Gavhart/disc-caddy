import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
}

export function PageHeader({ title, description, backTo, backLabel = 'Back' }: PageHeaderProps) {
  return (
    <header className="page-header">
      {backTo && (
        <Link to={backTo} className="page-back">
          ← {backLabel}
        </Link>
      )}
      <h1>{title}</h1>
      {description && <p className="page-header-desc muted">{description}</p>}
    </header>
  )
}
