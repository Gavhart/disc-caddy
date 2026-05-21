/**
 * Shown when Supabase env vars are missing. Walks the developer through the
 * minimum setup needed to boot the app.
 */
export function SetupScreen() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Disc Caddy</h1>
        <p className="muted">First-time setup needed</p>
      </header>
      <section className="card">
        <h2>Welcome — quick setup</h2>
        <p>
          The app needs a Supabase project to handle auth, your bags, and disc
          photos. Takes about 5 minutes.
        </p>
        <ol className="setup-steps">
          <li>
            Create a free account at{' '}
            <a href="https://supabase.com" target="_blank" rel="noreferrer">
              supabase.com
            </a>
            , then create a new project.
          </li>
          <li>
            In the Supabase dashboard go to <strong>SQL Editor → New query</strong>,
            paste the contents of <code>supabase/migrations/001_initial_schema.sql</code>,
            and click Run.
          </li>
          <li>
            Go to <strong>Storage → New bucket</strong>, name it{' '}
            <code>disc-photos</code>, leave it private.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in
            the two values from <strong>Settings → API</strong>:
            <pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}</pre>
          </li>
          <li>
            Restart the dev server (<code>npm run dev</code>) and reload this page.
          </li>
        </ol>
        <p className="muted small">
          Stripe / paywall setup comes later — see the README. The app boots and
          works without Stripe; the Upgrade button is just disabled.
        </p>
      </section>
    </div>
  )
}
