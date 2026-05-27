# App Store & Google Play — publish checklist

**Start here:** **[STORE_LAUNCH.md](./STORE_LAUNCH.md)** — unified checklist for both stores.

Disc Caddy ships as a **Capacitor** app: your existing Vite + React web app wrapped in native iOS/Android shells. The free tier works fully in the stores; Pro billing stays on **https://thedisccaddy.com** (required by Apple/Google for digital subscriptions unless you implement In-App Purchase).

---

## What's already done in the repo

| Item | Status |
|------|--------|
| Capacitor iOS + Android projects | `ios/`, `android/` |
| Mobile build scripts | `npm run build:mobile`, `cap:ios`, `cap:android` |
| Store icon generator | `npm run store:icons` (needs `public/logo.png`) |
| Safe area / notch padding | CSS `env(safe-area-inset-*)` |
| Privacy Policy page | `/privacy` (updated for stores) |
| Terms of Service page | `/terms` |
| Account deletion in Settings | Calls `delete-account` edge function |
| Stripe hidden in native app | App Store billing compliance |
| Auth email links use `VITE_APP_URL` | Not `capacitor://` — set at mobile build time |
| iOS photo + location permission strings | `Info.plist` |
| iOS export compliance flag | `ITSAppUsesNonExemptEncryption = false` |
| Android photo permission | `READ_MEDIA_IMAGES` in manifest |
| App ID | `com.disccaddy.app` |
| Store version | **1.0.0** (iOS Xcode + Android `build.gradle`) |

---

## Before you submit

### 1. Deploy backend pieces

Apply migrations **003 through 032** in Supabase SQL Editor, then:

```bash
supabase functions deploy delete-account
```

See **STORE_LAUNCH.md** for the full function list.

### 2. Host public legal URLs

App Store Connect and Play Console need **public HTTPS links**:

- https://thedisccaddy.com/privacy
- https://thedisccaddy.com/terms

Support: **support@disccaddy.app**

### 3. App icons & splash screens

```bash
npm run store:icons
```

Then verify iOS AppIcon in Xcode and Android launcher via Image Asset wizard.

### 4. Production env in the native bundle

```bash
# .env.local must include production Supabase + VITE_APP_URL before:
npm run build:mobile
```

See **`.env.example`**. Do **not** ship with localhost URLs or dev `server.url` in `capacitor.config.ts`.

---

## Build & run locally

### Prerequisites

- **macOS + Xcode 15+** (for iOS)
- **Android Studio** + JDK 17 (for Android)
- Apple Developer account ($99/yr)
- Google Play Developer account ($25 one-time)

### Workflow

```bash
npm run store:icons       # once, after adding public/logo.png
npm run build:mobile      # vite build + cap sync
npm run cap:ios           # opens Xcode
npm run cap:android       # opens Android Studio
```

---

## Apple App Store

### App Store Connect setup

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** New App
2. Bundle ID: `com.disccaddy.app`
3. Category: **Sports**
4. **Privacy Policy URL:** https://thedisccaddy.com/privacy
5. **App Privacy:** email, user content, photos, location (when in use)

### Xcode archive

1. Open `ios/App/App.xcworkspace`
2. **Signing & Capabilities** → Team + automatic signing
3. Version **1.0.0**, build **1** (increment build each upload)
4. **Product → Archive** → **Distribute App** → TestFlight → App Review

### Apple-specific requirements (handled)

- ✅ Account deletion in-app
- ✅ No external payment for digital subscriptions in the app
- ✅ Privacy policy URL
- ✅ Photo library usage description
- ✅ Standard encryption declaration

---

## Google Play Store

See **[GOOGLE_PLAY.md](./GOOGLE_PLAY.md)** for signed AAB, Data safety, and internal testing track.

---

## Subscriptions strategy

| Channel | Pro purchase |
|---------|--------------|
| Website | Stripe Checkout |
| iOS / Android app | Not sold in-app — sync Pro when signed in |
| Future | Apple IAP / Google Play Billing |

---

## Useful links

- [STORE_LAUNCH.md](./STORE_LAUNCH.md)
- [Capacitor iOS docs](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/#payments)
