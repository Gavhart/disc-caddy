import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

export function TermsPage() {
  return (
    <div className="auth-shell legal-shell">
      <div className="auth-card auth-card-wide legal-card">
        <div className="auth-brand">
          <Logo height={64} />
        </div>
        <h2>Terms of Service</h2>
        <div className="legal-body">
          <p className="muted small legal-updated">Last updated: May 2026</p>
          <p>
            By using Disc Caddy you agree to these terms. If you disagree, do not
            use the app.
          </p>
          <h3>The service</h3>
          <p>
            Disc Caddy provides disc golf recommendations based on your bag, player
            profile, and hole conditions. Recommendations are guidance only — you
            are responsible for your throws and safety on the course.
          </p>
          <h3>Accounts</h3>
          <p>
            You must provide accurate signup information and keep your credentials
            secure. You may delete your account at any time in Settings.
          </p>
          <h3>Subscriptions</h3>
          <p>
            Pro features may be offered via a paid subscription on the Disc Caddy
            website. Mobile app store versions do not sell subscriptions in-app;
            existing Pro status syncs when you sign in with the same account.
          </p>
          <h3>User content</h3>
          <p>
            Course data and disc photos you add may be stored to support your use of
            the app. Shared course catalog entries may be visible to other users.
          </p>
          <h3>Disclaimer</h3>
          <p>
            The app is provided &quot;as is&quot; without warranties. Disc names in
            the catalog are for identification; trademarks belong to their respective
            owners.
          </p>
          <h3>Contact</h3>
          <p>
            <a href="mailto:support@disccaddy.app">support@disccaddy.app</a>.
          </p>
        </div>
        <Link to="/" className="btn-secondary legal-back">
          Back to app
        </Link>
      </div>
    </div>
  )
}
