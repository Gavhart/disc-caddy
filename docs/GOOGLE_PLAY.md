# Google Play — ship Disc Caddy (Android)

**Unified checklist:** **[STORE_LAUNCH.md](./STORE_LAUNCH.md)** (Play + Apple + backend).

Disc Caddy is a **Capacitor** wrapper around the Vite/React web app. Package name: **`com.disccaddy.app`**.

Pro subscriptions are **web-only** (Stripe on **https://thedisccaddy.com**). The Android app syncs Pro status when the user signs in — no in-app purchase required for v1.

---

## Phase 0 — Accounts & hosting (do once)

| Step | Action |
|------|--------|
| 1 | [Google Play Console](https://play.google.com/console) — pay **$25** one-time developer fee |
| 2 | Deploy the web app on **Vercel** — see **[VERCEL.md](./VERCEL.md)** |
| 3 | Confirm **https://thedisccaddy.com/privacy** and **/terms** load |
| 4 | Supabase: apply migrations **003–032**, deploy **`delete-account`** |

```bash
supabase functions deploy delete-account
```

Support: **support@disccaddy.app**

---

## Phase 1 — Production mobile build

In `.env.local` before **`npm run build:mobile`**:

```env
VITE_SUPABASE_URL=https://cjozidvlqwifqascgihc.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_APP_URL=https://thedisccaddy.com
```

```bash
npm run store:icons      # requires public/logo.png
npm run build:mobile
npm run cap:android
```

**Before store submission:** no dev `server.url` in `capacitor.config.ts`.

Release version: **1.0.0** (versionCode **1**) in `android/app/build.gradle` — increment versionCode on every upload.

---

## Phase 2 — App icon (required for review)

```bash
npm run store:icons
```

Then Android Studio → **File → New → Image Asset** → import `store-assets/play-store-icon-512.png`.

Feature graphic: `store-assets/play-feature-graphic-1024x500.png`

---

## Phase 3 — Signed release bundle (.aab)

### Create keystore (first time only — back it up!)

```bash
keytool -genkey -v -keystore disccaddy-upload.keystore -alias disccaddy \
  -keyalg RSA -keysize 2048 -validity 10000
```

### Build signed AAB in Android Studio

1. **Build → Generate Signed Bundle / APK** → **Android App Bundle**
2. Keystore + alias, variant **release**
3. Output: `android/app/release/app-release.aab`

---

## Phase 4 — Play Console setup

### Store listing

| Field | Value |
|-------|--------|
| **Short description** | Pick the right disc for every hole — your bag, arm speed, and wind. |
| **Privacy policy URL** | https://thedisccaddy.com/privacy |
| **Contact email** | support@disccaddy.app |
| **Feature graphic** | `store-assets/play-feature-graphic-1024x500.png` |
| **App icon** | `store-assets/play-store-icon-512.png` |

### Data safety (summary)

| Data | Purpose |
|------|---------|
| Email | Account |
| Display name | Profile / social |
| Photos | Profile & disc bag |
| App activity | Bags, courses, rounds, messages |
| Approximate location | Wind + community (when you opt in) |

Users can delete data in-app (Settings → Delete account).

### Release

1. **Internal testing** → upload AAB → smoke test
2. **Production** when ready

Provide reviewer login under **App access**.

---

## Pre-upload checklist

- [ ] Migrations through **032** applied
- [ ] `delete-account` deployed
- [ ] Web live with `/privacy` and `/terms`
- [ ] `VITE_APP_URL` set for `build:mobile`
- [ ] `npm run store:icons` + Android launcher updated
- [ ] Real device test: sign up, community, delete account
- [ ] Signed AAB (versionCode incremented)
- [ ] Data safety + content rating complete

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen | Re-run `build:mobile`; check Supabase env at build time |
| Password reset broken | Set `VITE_APP_URL=https://thedisccaddy.com` before mobile build |
| Pro missing | Subscribe on website; same account on app |
| Billing rejection | Stripe hidden in native app (`isWebCheckoutAvailable()`) |

---

## Apple App Store next

Follow **[APP_STORE.md](./APP_STORE.md)** — same `build:mobile` bundle, Xcode archive, TestFlight.
