import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

function LegalShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="auth-shell legal-shell">
      <div className="auth-card auth-card-wide legal-card">
        <div className="auth-brand">
          <Logo height={64} />
        </div>
        <h2>{title}</h2>
        <div className="legal-body">{children}</div>
        <Link to="/" className="btn-secondary legal-back">
          Back to app
        </Link>
      </div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="muted small legal-updated">Last updated: May 2026</p>
      <p>
        Disc Caddy (&quot;we&quot;, &quot;the app&quot;) helps disc golfers choose
        discs for a given hole. This policy describes what we collect and why.
        It applies to the website at{' '}
        <a href="https://thedisccaddy.com">thedisccaddy.com</a> and the iOS and
        Android apps.
      </p>
      <h3>What we collect</h3>
      <ul>
        <li>
          <strong>Account info</strong> — email, display name, and player settings
          (distances, hand, throw preferences).
        </li>
        <li>
          <strong>Bag &amp; course data</strong> — discs in your bags, course/hole
          layouts you create, and optional round throw logs.
        </li>
        <li>
          <strong>Photos</strong> — profile and disc images you upload (stored in
          Supabase Storage).
        </li>
        <li>
          <strong>Community &amp; social</strong> — home areas you save, visibility
          preferences, direct messages, event RSVPs, league participation, and
          friend connections when you use those features.
        </li>
        <li>
          <strong>Approximate location</strong> — when you choose &quot;Use my
          location&quot; for wind, community matching, or nearby courses (not
          tracked in the background).
        </li>
        <li>
          <strong>Subscription status</strong> — if you subscribe to Pro on the
          website, we store your plan tier (Stripe handles payment details).
        </li>
      </ul>
      <h3>How we use it</h3>
      <p>
        To power recommendations, sync your data across devices, connect you with
        nearby players, and manage your subscription. We do not sell your personal
        data.
      </p>
      <h3>Third parties</h3>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication, database, and file storage.
        </li>
        <li>
          <strong>Stripe</strong> — subscription billing on the web (optional).
        </li>
        <li>
          <strong>Open-Meteo</strong> — weather and geocoding when you search
          cities or fetch wind (no account data sent).
        </li>
        <li>
          <strong>OpenStreetMap / Nominatim</strong> — map tiles and reverse
          geocoding for community home areas.
        </li>
        <li>
          <strong>DiscGolfAPI</strong> — public course metadata when you import or
          auto-discover nearby courses (see{' '}
          <a
            href="https://discgolfapi.com/licence/"
            target="_blank"
            rel="noopener noreferrer"
          >
            discgolfapi.com/licence
          </a>
          ).
        </li>
      </ul>
      <h3>Mobile apps</h3>
      <p>
        Pro subscriptions are purchased on the website, not inside the iOS or
        Android app. The mobile apps sync your account and Pro status when you
        sign in with the same email.
      </p>
      <h3>Your choices</h3>
      <p>
        You can delete your account anytime in Settings → Delete account. This
        permanently removes your profile, bags, messages, and associated data.
      </p>
      <h3>Contact</h3>
      <p>
        Questions? Email{' '}
        <a href="mailto:support@disccaddy.app">support@disccaddy.app</a>.
      </p>
    </LegalShell>
  )
}
