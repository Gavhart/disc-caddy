# Disc Caddy

Arm-speed-aware disc golf recommendation app — **free for everyone, no paid tier**.

Stack: Vite + React + TypeScript on the front, Supabase (Postgres + Auth + Storage) on the back. Capacitor wraps it for iOS and Android.

## What's in it

- **Account / login** — email + password, password reset (Supabase Auth)
- **Player profile** — display name, max distance, dominant hand, primary throw, per-disc-class distances
- **Multiple bags** — name them ("Tournament bag", "Wooded course bag", etc.), set a default, switch between them
- **Disc photos** — per-disc image upload so you can spot a disc visually
- **Recommendation engine** — picks the right disc from your bag based on arm speed, plastic, weight, wear, wind, and shot shape
- **Course library** — shared course catalog with per-hole layouts, mandos, tee bearings, and satellite GPS map of the tee + basket
- **Live rounds** — hole-by-hole scoring, throw logging, multi-player scorecards
- **Stats dashboard** — birdie rate, scoring trends, disc performance, throw-phase breakdown
- **Community** — find players nearby, send messages, post pickup rounds, run leagues with auto standings

Everything above is free. There is no Pro tier, no subscription, no upgrade screen.

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see Supabase setup below)
npm run dev
```

Open http://localhost:5173. If Supabase isn't configured, you'll see a friendly setup screen explaining what to do.

---

## Supabase setup (~5 min, required)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the schema:** In your project dashboard → **SQL Editor** → **New query** → paste the contents of `supabase/migrations/001_initial_schema.sql` and run it. Then run each subsequent numbered migration in order (`002_*.sql`, `003_*.sql`, …). The latest migration (`046_drop_subscription.sql`) removes the old subscription columns.
3. **Create the storage bucket:** **Storage** → **New bucket** → name: `disc-photos`, keep it **private**. The schema includes the storage RLS policies.
4. **Disable email confirmation for dev (optional):** **Authentication → Providers → Email** → toggle off "Confirm email" so signups work instantly without checking your inbox. Re-enable in production.
5. **Copy your env vars:** **Settings → API** → copy the **Project URL** and **anon key** into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
6. Restart `npm run dev`.

Signups collect player info (name, distance, hand, throw) on the welcome form.

---

## Project structure

```
disc-caddy/
├── supabase/
│   ├── migrations/                       Numbered SQL migrations — run in order
│   └── functions/
│       ├── delete-account/               Hard-deletes a user's data on request
│       ├── dispatch-notification/        Server-side push + email fanout
│       └── send-notification-email/      Email helper for the dispatcher
├── ios/                                  Capacitor iOS project
├── android/                              Capacitor Android project
└── src/
    ├── App.tsx                           Router + AuthProvider
    ├── main.tsx
    ├── index.css                         All styles (dark theme)
    ├── types.ts                          Shared TS types
    ├── contexts/AuthContext.tsx          Session + profile state
    ├── components/                       Layout, bag editor, hole input, satellite map, etc.
    ├── pages/                            Login, signup, home, bags, courses, stats, community, etc.
    └── lib/
        ├── supabase.ts                   Supabase client
        ├── auth.ts                       signIn / signUp / signOut / reset
        ├── profile.ts                    Player profile fetch + update
        ├── bags.ts                       Bag + bag-disc CRUD
        ├── photos.ts                     Disc photo upload / fetch / delete
        ├── courses.ts                    Course + hole CRUD (incl. tee/basket coords)
        ├── recommend.ts                  The recommendation engine (math)
        ├── armspeed.ts                   Arm-speed + design-distance + required-speed
        ├── modifiers.ts                  Plastic / weight / wear / shape lookups
        ├── discs.ts                      Seed disc database
        └── platform.ts                   Capacitor native-app detection
```

---

## The recommendation engine

The same model as the validated spreadsheet prototype, ported to TypeScript and verified end-to-end.

```
effective_turn  = base_turn + plastic_mod + weight_mod + wear_mod + arm_adj
effective_fade  = base_fade + plastic_mod + weight_mod + wear_mod + arm_adj

arm_adj:
  deficit  →  +0.35 turn / +0.25 fade  per mph deficit  (no cap)
  surplus  →  -0.15 turn / -0.10 fade  per mph surplus  (capped at 5 mph)

effective_distance = design_distance × efficiency
  efficiency = MIN(1.25, ratio^0.3)  when ratio ≥ 1
             = ratio^4               when ratio < 1

score = distance_error + shape_error × 30        (lower = better)
```

All coefficients live in `src/lib/recommend.ts` (exported as `MODEL`) and are easy to tune as you gather real-world data. The engine has no DOM dependencies — when you want server-side tuning, lift it into a Supabase Edge Function without rewriting it.

---

## Mobile apps (iOS & Android)

The repo includes a **Capacitor** wrapper so the same web build ships to the App Store and Google Play.

```bash
npm run store:icons     # generate icons from public/logo.png
npm run build:mobile    # production .env.local first
npm run cap:ios         # open Xcode
npm run cap:android     # open Android Studio
```

**App ID:** `com.disccaddy.app`

Detailed publish checklist (icons, signing, store listings, legal URLs, account deletion): **[docs/APP_STORE.md](docs/APP_STORE.md)** and **[docs/STORE_LAUNCH.md](docs/STORE_LAUNCH.md)**.

### Capacitor + Xcode Cloud notes

- `ios/App/ci_scripts/ci_post_clone.sh` installs Node 22 via Homebrew on Xcode Cloud's runner, then runs `npm ci`.
- `ios/App/ci_scripts/ci_pre_xcodebuild.sh` runs `npm run build && npx cap sync ios` using the env vars set in App Store Connect → Xcode Cloud workflow.
- `Info.plist` declares `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, and `NSLocationWhenInUseUsageDescription`. Missing any of these causes a TCC crash on first use.

---

## Known issues / future work

- **Email confirmation flow:** the schema works without it (auto sign-in after signup) but in production you should enable email confirmation. The `/reset-password` route handles the magic-link landing.
- **Photo compression:** the uploader sends the raw image. Add client-side resize (e.g., `browser-image-compression`) before uploading to save storage costs.
- **Disc database:** ~150 popular discs hardcoded in `src/lib/discs.ts`. Move to Supabase later so you can update without redeploying.
- **Hole-level GPS coverage:** the satellite hole map renders when a hole has `tee_lat`/`tee_lng`/`basket_lat`/`basket_lng`. Until users map a hole, it falls back to the schematic. Long-term, seed from OpenStreetMap and let users refine.

---

## Disclaimer

Disc names are manufacturer-trademarked. Don't ship commercially with the disc list as-is — get permission, use generic naming, or let users enter custom discs.
