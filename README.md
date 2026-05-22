# Disc Caddy

Arm-speed-aware disc golf recommendation app.

Stack: Vite + React + TypeScript on the front, Supabase (Postgres + Auth + Storage) on the back, Stripe for subscriptions.

## What's in it

- **Account / login** — email + password, password reset (Supabase Auth)
- **Player profile at signup** — display name, max distance, dominant hand, primary throw
- **Multiple bags** — name them ("Tournament bag", "Wooded course bag", etc.), set a default, switch between them
- **Disc photos** — upload an image per disc so you can spot it in your bag (Pro feature)
- **Recommendation engine** — picks the right disc from your bag based on arm speed, plastic, weight, wear, wind, and shot shape
- **Free + Pro tiers** — free gets 1 bag + the engine; Pro ($4.99/mo) gets unlimited bags + photos + future features

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
2. **Run the schema:** In your project dashboard → **SQL Editor** → **New query** → paste the contents of `supabase/migrations/001_initial_schema.sql` → **Run**. This creates the `profiles`, `bags`, `bag_discs` tables, RLS policies, and the trigger that auto-creates a profile when a user signs up.
3. **Create the storage bucket:** **Storage** → **New bucket** → name: `disc-photos`, keep it **private**. (The schema already includes the storage RLS policies.)
4. **Disable email confirmation for dev (optional):** **Authentication → Providers → Email** → toggle off "Confirm email" so signups work instantly without checking your inbox. Re-enable in production.
5. **Copy your env vars:** **Settings → API** → copy the **Project URL** and **anon key** into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
6. Restart `npm run dev`.

Signups collect player info (name, distance, hand, throw) on the signup form. You can now sign up, create bags, add discs, and see recommendations. Stripe is optional below.

---

## Stripe setup (optional — paywall stays disabled until done)

The app boots and works without Stripe. The Upgrade button shows "Coming soon" until you set this up.

### 1. Stripe dashboard

1. Create a Stripe account, switch to **test mode**.
2. **Products** → **Add product** → name "Disc Caddy Pro" → add a recurring price of $4.99/mo. Copy the **price ID** (`price_...`).
3. **Developers → API keys** → copy your secret key (`sk_test_...`).

### 2. Set frontend env var

Add to `.env.local`:
```
VITE_STRIPE_PRICE_ID=price_...
```

### 3. Deploy the Supabase Edge Functions

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm i -g supabase`), then:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# Set secrets for the functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Deploy
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 4. Configure the Stripe webhook

1. In Stripe dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret (`whsec_...`) and set it on Supabase:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 5. Test the flow

1. In the app, sign in and go to **Upgrade**.
2. Click "Upgrade — $4.99/mo" — you'll be redirected to Stripe Checkout.
3. Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. After checkout, the webhook fires, updates your `profiles` row, and the app shows you as Pro.

---

## Project structure

```
disc-caddy/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql      All DB tables + RLS + storage policies
│   └── functions/
│       ├── create-checkout-session/    Starts Stripe Checkout
│       ├── create-portal-session/      Opens billing portal
│       └── stripe-webhook/             Syncs subscription state back to Supabase
└── src/
    ├── App.tsx                         Router + AuthProvider
    ├── main.tsx
    ├── index.css                       All styles (dark theme)
    ├── types.ts                        Shared TS types
    ├── contexts/
    │   └── AuthContext.tsx             Session + profile state
    ├── components/
    │   ├── Navigation.tsx              Top nav bar (auth-aware)
    │   ├── ProtectedRoute.tsx          Redirects unauthed users to /login
    │   ├── SetupScreen.tsx             Shown when env vars are missing
    │   ├── PlayerSetup.tsx
    │   ├── MyBag.tsx                   Bag editor (per-disc rows)
    │   ├── BagPicker.tsx               Active-bag selector + create
    │   ├── DiscPhotoUploader.tsx       Per-disc image upload (Pro-gated)
    │   ├── HoleInput.tsx
    │   └── Recommendation.tsx
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── SignupPage.tsx
    │   ├── ResetPasswordPage.tsx
    │   ├── HomePage.tsx                Recommendation flow
    │   ├── BagsListPage.tsx            All bags, rename/delete/set-default
    │   ├── SettingsPage.tsx            Account + subscription
    │   └── UpgradePage.tsx             Pricing + Stripe checkout
    └── lib/
        ├── supabase.ts                 Supabase client
        ├── auth.ts                     signIn / signUp / signOut / reset
        ├── profile.ts                  Player profile fetch + update
        ├── bags.ts                     Bag + bag-disc CRUD
        ├── photos.ts                   Upload / fetch / delete disc photos
        ├── subscription.ts             Stripe checkout + billing portal
        ├── storage.ts                  Local-only storage (hole state)
        ├── discs.ts                    Seed disc database
        ├── modifiers.ts                Plastic / weight / wear / shape lookups
        ├── armspeed.ts                 Arm-speed + design-distance + required-speed
        └── recommend.ts                The recommendation engine (math)
```

---

## The recommendation engine

The same model as the validated spreadsheet prototype. Direct port to TypeScript, fully tested.

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

All coefficients live in `src/lib/recommend.ts` (exported as `MODEL`) and are easy to tune as you gather real-world data. Because the engine is server-runnable (no DOM), you can later move it behind a Supabase Edge Function and tune it without app updates.

---

## Free vs Pro

| Feature | Free | Pro ($4.99/mo) |
|---|---|---|
| Recommendation engine | ✓ | ✓ |
| Discs per bag | Unlimited | Unlimited |
| Number of bags | 1 | Unlimited |
| Photo upload | — | ✓ |
| Sync across devices | ✓ | ✓ |
| Future: course DB, weather, stats | — | ✓ |

Free-tier limits are enforced both in the UI (Add-bag button disabled) and at the database level (you can add a `before insert` trigger on `bags` if you want hard server-side enforcement).

---

## Porting to iOS / Android

When you're ready for native, spin up an Expo project and copy:

- **`src/lib/`** — all of it. Plain TypeScript, no DOM dependencies. The engine, the disc DB, the Supabase helpers, all port directly.
- **`src/types.ts`** — direct copy.
- **`src/contexts/AuthContext.tsx`** — works as-is (the Supabase JS client has React Native support).

You'll rewrite `src/components/` and `src/pages/` using React Native primitives (`View` / `Text` / `Pressable` / `TextInput`) and React Navigation instead of React Router. The Supabase Storage upload helper needs a small tweak (use `expo-image-picker` to get the file, then upload via base64).

For payments on mobile, you'll need In-App Purchases (Apple/Google take 30%) — that's a v2 problem.

---

## Known issues / future work

- **Email confirmation flow:** the schema works without it (auto sign-in after signup) but in production you should enable email confirmation. The `/reset-password` route handles the magic-link landing.
- **Photo compression:** the current uploader sends the raw image. Add client-side resize (something like `browser-image-compression`) before uploading to save storage costs.
- **Disc database:** 25 popular discs hardcoded in `src/lib/discs.ts`. Move to Supabase later so you can update without redeploying.
- **Course-level features:** not in v1. Plan: pull OpenStreetMap seed for course locations, let users add hole-level data, build the database crowdsourced.
- **Hard server-side paywall:** UI enforces the 1-bag limit, but a determined user could hit the API directly. Add a Postgres trigger before going to production.

---

## Disclaimer

Disc names are manufacturer-trademarked. Don't ship this commercially with the disc list as-is — get permission, use generic naming, or let users enter custom discs.
