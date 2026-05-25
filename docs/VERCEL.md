# Deploy Disc Caddy on Vercel

The web app is a static Vite + React SPA. Vercel builds `dist/` and serves it with SPA routing for React Router.

---

## One-time setup

### 1. Push to GitHub

Vercel deploys from Git. If the repo isn’t on GitHub yet:

```bash
git remote add origin git@github.com:YOUR_USER/disc-caddy.git
git push -u origin main
```

### 2. Import in Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your **disc-caddy** repository
3. Framework preset: **Vite** (auto-detected)
4. Build command: `npm run build` (from `vercel.json`)
5. Output directory: `dist`

### 3. Environment variables

In Vercel → **Project → Settings → Environment Variables**, add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://cjozidvlqwifqascgihc.supabase.co` (your project URL) |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `VITE_STRIPE_PRICE_ID` | Stripe Dashboard → Products → Pro → Price ID (`price_...`) |

**Do not** add Stripe secret keys or webhook secrets here — those stay in Supabase Edge Function secrets only.

Redeploy after adding env vars (**Deployments → … → Redeploy**).

### 4. Supabase Auth URLs

Supabase Dashboard → **Authentication → URL Configuration**:

| Field | Example |
|-------|---------|
| **Site URL** | `https://disc-caddy.vercel.app` (or your custom domain) |
| **Redirect URLs** | Add: `https://disc-caddy.vercel.app/**` and `https://YOUR-CUSTOM-DOMAIN/**` |

Also add `http://localhost:5173/**` for local dev if not already there.

Password reset emails use `{origin}/reset-password` — the Site URL should match your production domain.

### 5. Custom domain (optional)

Vercel → **Project → Settings → Domains** → add e.g. `app.disccaddy.com`.

Update Supabase Auth URLs and use this domain for:

- Play Store privacy policy: `https://app.disccaddy.com/privacy`
- Play Store terms: `https://app.disccaddy.com/terms`

---

## Deploy

**Automatic:** push to `main` → Vercel builds and deploys.

**CLI (optional):**

```bash
npm i -g vercel
vercel login
vercel          # preview
vercel --prod   # production
```

---

## Verify after deploy

- [ ] `/` loads; sign up / log in works
- [ ] `/privacy` and `/terms` load (required for app stores)
- [ ] Bag + course + recommendations work
- [ ] **Upgrade** → Stripe Checkout → return to `/settings?upgraded=1`
- [ ] Settings → **Delete account** works (`delete-account` edge function deployed)
- [ ] Password reset email link opens `/reset-password` on your Vercel domain

---

## Mobile builds (unchanged)

Capacitor still uses a separate build with relative asset paths:

```bash
npm run build:mobile   # sets VITE_CAPACITOR=true internally
```

Do **not** use the Capacitor build for Vercel — use the normal `npm run build`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page, 404 on refresh | `vercel.json` rewrites should be committed; redeploy |
| “Missing VITE_SUPABASE…” | Add env vars in Vercel; redeploy |
| Login works locally, not on Vercel | Add Vercel URL to Supabase **Redirect URLs** |
| Stripe checkout fails | Deploy edge functions; set `STRIPE_SECRET_KEY` in Supabase secrets; `VITE_STRIPE_PRICE_ID` in Vercel |
| Wrong asset paths / broken CSS | Ensure you did **not** set `VITE_CAPACITOR=true` on Vercel |

---

## Related docs

- [GOOGLE_PLAY.md](./GOOGLE_PLAY.md) — Android store (use Vercel URLs for privacy policy)
- [APP_STORE.md](./APP_STORE.md) — iOS later
- [STRIPE_LIVE.md](./STRIPE_LIVE.md) — switching Stripe to live mode
