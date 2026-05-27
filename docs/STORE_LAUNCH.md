# Store launch — get Disc Caddy sailing

One checklist for **Google Play** and **Apple App Store**. The website (**thedisccaddy.com**) keeps running in parallel — stores are an extra install option, not a replacement.

| Channel | Package / bundle | Billing |
|---------|------------------|---------|
| Web | thedisccaddy.com | Stripe Pro checkout |
| Android | `com.disccaddy.app` | Web-only Pro (sync on sign-in) |
| iOS | `com.disccaddy.app` | Web-only Pro (sync on sign-in) |

Deep dives: **[GOOGLE_PLAY.md](./GOOGLE_PLAY.md)** · **[APP_STORE.md](./APP_STORE.md)** · **[VERCEL.md](./VERCEL.md)**

---

## Phase 1 — Backend & legal (do first)

### Supabase

- [ ] Apply all SQL migrations through **032** in the SQL Editor
- [ ] Deploy edge functions (minimum):

```bash
supabase functions deploy delete-account
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy sync-subscription
```

- [ ] **Authentication → URL Configuration**
  - Site URL: `https://thedisccaddy.com`
  - Redirect URLs: `https://thedisccaddy.com/**` and `http://localhost:5173/**`

### Web (Vercel)

- [ ] Production deploy live at **https://thedisccaddy.com**
- [ ] Env vars set (see `.env.example`) — especially `VITE_APP_URL=https://thedisccaddy.com`
- [ ] Confirm these load in a browser:
  - https://thedisccaddy.com/privacy
  - https://thedisccaddy.com/terms
- [ ] `support@disccaddy.app` inbox works

### Stripe (web Pro)

- [ ] Live prices configured (`VITE_STRIPE_PRICE_ID_MONTHLY` + `_ANNUAL`)
- [ ] Live webhook + Supabase secrets (see **STRIPE_LIVE.md**)

---

## Phase 2 — Mobile build prep

### Local env (`.env.local`)

Required before **`npm run build:mobile`**:

```env
VITE_SUPABASE_URL=https://cjozidvlqwifqascgihc.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_APP_URL=https://thedisccaddy.com
```

`VITE_APP_URL` ensures password-reset emails link to your **website**, not `capacitor://localhost` (fixed in code — must be set at build time).

### Icons

1. Ensure **`public/logo.png`** exists (your brand mark)
2. Generate store assets:

```bash
npm run store:icons
```

This writes:

- iOS App Store icon → `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Play Store 512 icon + feature graphic → `store-assets/`

For Android launcher icons, open Android Studio → **Image Asset** and import `store-assets/play-store-icon-512.png`.

### Production mobile bundle

```bash
npm run build:mobile
```

Verify **`capacitor.config.ts`** does **not** have a dev `server.url` uncommented.

**Version numbers (first store release):**

| Platform | Marketing version | Build |
|----------|-------------------|-------|
| iOS (Xcode) | 1.0.0 | 1 |
| Android (`build.gradle`) | 1.0.0 | versionCode 1 |

Bump build number on every resubmission.

---

## Phase 3 — Device testing (both platforms)

Test on **real hardware**, not just simulators:

- [ ] Sign up / sign in / sign out
- [ ] Password reset email opens **thedisccaddy.com** reset page
- [ ] Recommendations + bag CRUD
- [ ] Community home area save → nearby courses import
- [ ] Events, notifications bell, messages (Pro)
- [ ] Location prompt (wind + community)
- [ ] Profile / disc photo upload
- [ ] Settings → **Delete account** (Apple requirement)
- [ ] **No Stripe checkout** visible in native app
- [ ] Subscribe on **website**, sign in on app → Pro features unlock

---

## Phase 4 — Google Play ($25 one-time)

1. [Play Console](https://play.google.com/console) → create app **Disc Caddy**
2. Store listing + **Data safety** + content rating (see GOOGLE_PLAY.md)
3. Privacy URL: `https://thedisccaddy.com/privacy`
4. Create upload keystore (back it up!)
5. Android Studio → signed **AAB** → **Internal testing** first
6. Provide reviewer test login under **App access**

```bash
npm run cap:android
# Build → Generate Signed Bundle / APK → release AAB
```

---

## Phase 5 — Apple App Store ($99/year)

1. [App Store Connect](https://appstoreconnect.apple.com) → new app, bundle **`com.disccaddy.app`**
2. Category **Sports**, privacy URL above
3. **App Privacy** labels — match Privacy policy (email, photos, location, user content)
4. Xcode:

```bash
npm run cap:ios
```

5. Open **`ios/App/App.xcworkspace`** → Signing (your team) → **Archive** → TestFlight
6. Reviewer notes + test account
7. Submit for review

Repo already includes:

- Location + photo library usage strings (`Info.plist`)
- `ITSAppUsesNonExemptEncryption = false` (standard HTTPS-only app)
- Account deletion in Settings
- Stripe hidden in native shell

---

## Store listing copy (starter)

**Subtitle:** Disc golf disc recommendations  
**Short:** Pick the right disc for every hole — your bag, arm speed, and wind.

**Screenshots:** Home recommendation · Bag · Social/Community · Courses map · Settings (show delete account exists)

Do **not** show Stripe checkout in mobile screenshots.

---

## Reviewer test account

Create a dedicated user and add credentials in both consoles:

```sql
update public.profiles
set subscription_tier = 'pro', subscription_status = 'active'
where email = 'reviewer@yourdomain.com';
```

---

## After launch

| Update type | What to do |
|-------------|------------|
| Web feature | `npm run build` → Vercel deploy (instant for web users) |
| Mobile feature | `npm run build:mobile` → new store build + review |
| Backend only | Supabase migrations / functions (all clients pick up) |

---

## Quick commands

```bash
# Web deploy
npm run build

# Store builds (production .env.local first!)
npm run store:icons
npm run build:mobile
npm run cap:ios      # or cap:android
```

Good luck — ship Android first if you want the faster feedback loop, then iOS with the same bundle.
