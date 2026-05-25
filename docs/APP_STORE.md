# App Store & Google Play — publish checklist

**Android first:** see **[GOOGLE_PLAY.md](./GOOGLE_PLAY.md)** for the full step-by-step Play Store walkthrough.

Disc Caddy ships as a **Capacitor** app: your existing Vite + React web app wrapped in native iOS/Android shells. The free tier works fully in the stores; Pro billing stays on the **website** (required by Apple/Google for digital subscriptions unless you implement In-App Purchase).

---

## What's already done in the repo

| Item | Status |
|------|--------|
| Capacitor iOS + Android projects | `ios/`, `android/` |
| Mobile build scripts | `npm run build:mobile`, `cap:ios`, `cap:android` |
| Safe area / notch padding | CSS `env(safe-area-inset-*)` |
| Privacy Policy page | `/privacy` |
| Terms of Service page | `/terms` |
| Account deletion in Settings | Calls `delete-account` edge function |
| Stripe hidden in native app | App Store billing compliance |
| App ID | `com.disccaddy.app` |

---

## Before you submit

### 1. Deploy backend pieces

```bash
# Apply any pending SQL migrations (003–013) in Supabase SQL Editor

# Deploy account deletion (required for Apple)
supabase functions deploy delete-account
```

### 2. Host public legal URLs

App Store Connect and Play Console need **public HTTPS links** to your privacy policy (and often terms).

Options:
- Deploy the web app (Vercel, Netlify, etc.) and use `https://yourdomain.com/privacy` and `/terms`
- Or host static copies of the legal pages on your marketing site

**Update** the support email in `src/pages/PrivacyPage.tsx` and `TermsPage.tsx` before publishing.

### 3. App icons & splash screens

Capacitor defaults are generic. Replace before submission:

**iOS** — `ios/App/App/Assets.xcassets/AppIcon.appiconset/`  
Use a 1024×1024 PNG (no transparency for App Store).

**Android** — `android/app/src/main/res/mipmap-*`  
Use Android Studio **Image Asset** wizard (Adaptive icon + legacy).

**Splash** — configure in `capacitor.config.ts` (`SplashScreen` plugin) or replace native splash assets in Xcode / Android Studio.

Tip: export from `public/logo.png` at required sizes using [appicon.co](https://www.appicon.co) or similar.

### 4. Production env in the native bundle

Capacitor ships your built `dist/` folder. Env vars are baked in at **build time**:

```bash
# .env.local must have production Supabase keys before:
npm run build:mobile
```

Do **not** ship with localhost URLs. Stripe price ID is optional (native app doesn't open checkout anyway).

---

## Build & run locally

### Prerequisites

- **macOS + Xcode 15+** (for iOS)
- **Android Studio** + JDK 17 (for Android)
- Apple Developer account ($99/yr)
- Google Play Developer account ($25 one-time)

### Workflow

```bash
npm run build:mobile    # vite build + cap sync
npm run cap:ios         # opens Xcode
npm run cap:android     # opens Android Studio
```

In Xcode: select a simulator or device → **Run**.  
In Android Studio: select emulator or device → **Run**.

### Live reload during development (optional)

Uncomment in `capacitor.config.ts`:

```ts
server: { url: 'http://YOUR_LAN_IP:5173' }
```

Run `npm run dev`, then rebuild/sync. Remove before store submission.

---

## Apple App Store

### App Store Connect setup

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** New App
2. Bundle ID: `com.disccaddy.app` (must match Xcode)
3. Category: **Sports**
4. Age rating: complete questionnaire (likely 4+)
5. **Privacy Policy URL:** your hosted `/privacy` link
6. **App Privacy** (“nutrition labels”): declare email, user content (bag/course data), photos if uploaded

### Xcode archive

1. Open `ios/App/App.xcworkspace` (not `.xcodeproj`)
2. **Signing & Capabilities** → Team + automatic signing
3. Version / build number in target settings
4. **Product → Archive** → **Distribute App** → App Store Connect

### Apple-specific requirements (handled)

- ✅ Account deletion in-app (Settings → Delete account)
- ✅ No external payment links for digital subscriptions in the app
- ✅ Privacy policy accessible

### Optional later: Apple In-App Purchase

To sell Pro **inside** the iOS app you need StoreKit + server validation (RevenueCat recommended). Until then, Pro is web-only; mobile app syncs Pro status via Supabase when signed in.

---

## Google Play Store

### Play Console setup

1. [Google Play Console](https://play.google.com/console) → Create app
2. Package name: `com.disccaddy.app`
3. **Store listing:** screenshots, short/full description, feature graphic
4. **Privacy policy URL:** same hosted `/privacy` link
5. **Data safety form:** align with Supabase/Stripe/Open-Meteo disclosures

### Release build

In Android Studio:

1. **Build → Generate Signed Bundle / APK** → **Android App Bundle (.aab)**
2. Create/upload keystore (keep backup — losing it blocks updates)
3. Upload AAB to **Production** or **Internal testing** track

---

## Store listing copy (starter)

**Subtitle (iOS):** Disc golf disc recommendations  
**Short description:** Pick the right disc for every hole based on your bag, arm speed, and conditions.

**Keywords:** disc golf, disc caddy, frisbee golf, bag builder, course guide

**Screenshots to capture:**
1. Home — recommendation for a hole
2. Bag editor with discs
3. Course stepper / hole picker
4. Player setup / settings
5. (Optional) Pro features on web — don't show Stripe checkout in mobile screenshots

---

## Subscriptions strategy

| Channel | Pro purchase | Notes |
|---------|--------------|-------|
| Website | Stripe Checkout | Full upgrade flow |
| iOS / Android app | Not sold in-app | Free tier + synced Pro if subscribed on web |
| Future | Apple IAP / Google Play Billing | Requires RevenueCat or custom StoreKit integration |

This matches common indie patterns and passes review when you **don't** link to external purchase from the app.

---

## Pre-submission checklist

- [ ] Migrations 003–**013** applied in Supabase
- [ ] `delete-account` edge function deployed
- [ ] Support email updated in Privacy/Terms pages
- [ ] Privacy policy hosted at public HTTPS URL
- [ ] App icons + splash screens replaced
- [ ] Production `npm run build:mobile` with correct env vars
- [ ] Tested sign up, recommendations, bag CRUD, course picker on real device
- [ ] Tested account deletion end-to-end
- [ ] iOS: Archive + upload to TestFlight
- [ ] Android: Signed AAB uploaded to internal test track
- [ ] Store screenshots + descriptions prepared

---

## Useful links

- [Capacitor iOS docs](https://capacitorjs.com/docs/ios)
- [Capacitor Android docs](https://capacitorjs.com/docs/android)
- [App Store Review Guidelines 3.1 (payments)](https://developer.apple.com/app-store/review/guidelines/#payments)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
