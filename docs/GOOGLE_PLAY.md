# Google Play — ship Disc Caddy (Android first)

Disc Caddy is a **Capacitor** wrapper around the Vite/React web app. Package name: **`com.disccaddy.app`**.

Pro subscriptions are **web-only** (Stripe on your website). The Android app syncs Pro status when the user signs in — no in-app purchase required for v1.

---

## Phase 0 — Accounts & hosting (do once)

| Step | Action |
|------|--------|
| 1 | [Google Play Console](https://play.google.com/console) — pay **$25** one-time developer fee |
| 2 | Deploy the web app on **Vercel** — see **[VERCEL.md](./VERCEL.md)** |
| 3 | Confirm **`https://YOUR-DOMAIN/privacy`** and **`/terms`** load in a browser |
| 4 | Supabase: apply migrations **003–013**, deploy **`delete-account`** edge function |

```bash
supabase functions deploy delete-account
```

Support contact in the app: **support@disccaddy.app** (update in `PrivacyPage.tsx` / `TermsPage.tsx` if different).

---

## Phase 1 — Production mobile build

Env vars are baked in at build time. In `.env.local` (production Supabase URL + anon key only — no Stripe secrets):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Build and sync into the Android project:

```bash
npm run build:mobile
```

This runs `vite build` + `cap sync`. Open Android Studio:

```bash
npm run cap:android
```

**Before store submission:** ensure `capacitor.config.ts` does **not** have a dev `server.url` uncommented.

---

## Phase 2 — App icon (required for review)

Default Capacitor icons are generic. Replace them before upload:

1. Android Studio → **File → New → Image Asset**
2. **Launcher Icons (Adaptive and Legacy)**
3. Use your Disc Caddy artwork (1024×1024 source PNG works well)
4. Background color: `#0f1f14` (matches splash)

Or use [appicon.co](https://www.appicon.co) and drop files into `android/app/src/main/res/mipmap-*`.

---

## Phase 3 — Signed release bundle (.aab)

Google Play requires an **Android App Bundle**, signed with your upload key.

### Create keystore (first time only — back it up!)

```bash
keytool -genkey -v -keystore disccaddy-upload.keystore -alias disccaddy \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore and passwords somewhere safe (1Password, etc.). **Losing the keystore means you cannot update the app.**

### Build signed AAB in Android Studio

1. **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle**
3. Select your keystore + alias
4. Build variant: **release**
5. Output: `android/app/release/app-release.aab`

Optional: add to `android/gradle.properties` (do **not** commit passwords):

```properties
MYAPP_UPLOAD_STORE_FILE=disccaddy-upload.keystore
MYAPP_UPLOAD_KEY_ALIAS=disccaddy
MYAPP_UPLOAD_STORE_PASSWORD=***
MYAPP_UPLOAD_KEY_PASSWORD=***
```

Then configure `signingConfigs` in `android/app/build.gradle` for CI later.

---

## Phase 4 — Play Console setup

### Create the app

1. Play Console → **Create app**
2. App name: **Disc Caddy**
3. Default language: English (US)
4. App or game: **App**
5. Free or paid: **Free**

### Store listing

| Field | Suggested copy |
|-------|----------------|
| **Short description** (80 chars) | Pick the right disc for every hole — your bag, arm speed, and wind. |
| **Full description** | Disc Caddy recommends discs from your bag based on distance, dogleg, elevation, trees, and live wind. Build bags, map courses hole-by-hole, and (with Pro on the web) track live rounds and scorecards. |
| **App icon** | 512×512 PNG |
| **Feature graphic** | 1024×500 PNG |
| **Screenshots** | Phone: at least 2 (see below) |
| **Privacy policy URL** | `https://YOUR-DOMAIN/privacy` |
| **Contact email** | support@disccaddy.app |

**Screenshots to capture on a phone or emulator:**

1. Home — recommendation + course stepper  
2. Bag page with discs  
3. Course hole editor or course picker  
4. Live round / scorecard (if Pro)  
5. Settings (show account deletion exists — reviewers like this)

Do **not** show Stripe checkout in mobile screenshots (billing is web-only).

### App content (compliance)

| Section | What to declare |
|---------|-----------------|
| **Privacy policy** | URL above |
| **Ads** | No ads |
| **App access** | All features need login → provide test credentials for reviewers |
| **Content rating** | Questionnaire → likely **Everyone** / PEGI 3 |
| **Target audience** | 13+ or 18+ (your choice; no kids-specific features) |
| **News app** | No |
| **COVID contact tracing** | No |
| **Data safety** | See below |

### Data safety form (summary)

Declare data collected/processed:

| Data | Purpose | Shared? |
|------|---------|---------|
| Email | Account | Supabase (hosting) |
| Name (display name) | Account / social scorecards | Supabase |
| Photos (optional disc photos) | User content | Supabase Storage |
| App activity (bags, courses, rounds) | App functionality | Supabase |
| Approximate location | Live wind (GPS) | Open-Meteo (weather only; no account) |

- Data encrypted in transit: **Yes**  
- Users can request deletion: **Yes** (in-app Settings → Delete account)  
- Optional: link to privacy policy for details  

### Release

1. **Testing → Internal testing** (recommended first)  
2. Create release → upload **`app-release.aab`**  
3. Add release notes: e.g. “Initial release — disc recommendations, bags, courses, live rounds (Pro).”  
4. Roll out to internal testers (your Gmail)  
5. After smoke test → **Production** (or closed/open testing first)

Review usually takes from a few hours to a few days.

---

## Phase 5 — Reviewer test account

Play Console may ask for login credentials. Create a dedicated test user:

1. Sign up in the app with a test email/password  
2. Optionally comp Pro in Supabase:

```sql
update public.profiles
set subscription_tier = 'pro',
    subscription_status = 'active'
where email = 'reviewer@yourdomain.com';
```

Provide email + password in **App access** notes.

---

## Pre-upload checklist

- [ ] Migrations 003–**013** applied in Supabase  
- [ ] `delete-account` edge function deployed  
- [ ] Web app live with `/privacy` and `/terms`  
- [ ] `npm run build:mobile` with **production** env vars  
- [ ] Custom app icon installed  
- [ ] Tested on a real Android device: sign up, bag, course, recommend, delete account  
- [ ] Signed **AAB** built (version **0.3.0**, versionCode **3**)  
- [ ] Store listing + Data safety + Content rating complete  
- [ ] Internal test track passed  

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen on launch | Re-run `npm run build:mobile`; check Supabase env vars were set at build time |
| Location / wind not working | Grant location permission; check manifest has `ACCESS_FINE_LOCATION` (already in repo) |
| Pro features missing | Pro is purchased on **website**; same account must sign in on app |
| Upload rejected for billing | Ensure Upgrade/Stripe links are hidden in native app (`isWebCheckoutAvailable()`) |

---

## Later: Apple App Store

When ready for iOS, follow **[APP_STORE.md](./APP_STORE.md)** — same web bundle, Xcode archive, TestFlight, then App Store Connect. Apple Developer Program is **$99/year**.

Useful links:

- [Capacitor Android docs](https://capacitorjs.com/docs/android)
- [Play Console help](https://support.google.com/googleplay/android-developer)
- [Data safety form help](https://support.google.com/googleplay/android-developer/answer/10787469)
