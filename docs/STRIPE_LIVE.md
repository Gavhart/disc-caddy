# Switch Stripe from test mode to live

Disc Caddy uses Stripe in three places. **All three must use live keys together** — mixing test and live will fail.

| Where | Variable | Test → Live |
|-------|----------|-------------|
| Frontend (`.env.local`) | `VITE_STRIPE_PRICE_ID_MONTHLY` | Live **$2.99/mo** price ID |
| Frontend (`.env.local`) | `VITE_STRIPE_PRICE_ID_ANNUAL` | Live **$24.99/yr** price ID |
| Frontend (legacy) | `VITE_STRIPE_PRICE_ID` | Still works as monthly fallback |
| Supabase secrets | `STRIPE_SECRET_KEY` | `sk_live_...` |
| Supabase secrets | `STRIPE_WEBHOOK_SECRET` | `whsec_...` from **live** webhook |

---

## Step 1 — Activate your Stripe account

In [Stripe Dashboard](https://dashboard.stripe.com):

1. Complete **Settings → Business settings** (identity, bank account, business details).
2. Stripe must show your account as able to accept live payments before continuing.

---

## Step 2 — Create the live product & prices

1. Toggle the dashboard from **Test mode** to **Live mode** (top-right).
2. **Product catalog → Add product** (or open **Disc Caddy Pro** if it already exists)
   - Name: **Disc Caddy Pro**
3. Add **two recurring prices** on that product:
   - **$2.99 / month** (recurring, monthly)
   - **$24.99 / year** (recurring, yearly)
4. Copy both **Price IDs** (`price_...`) — they are **different** from test-mode IDs.

Stripe prices are immutable. To change an amount later, add a **new** price and update your env vars; don’t edit the old price row.

---

## Step 3 — Update `.env.local`

```env
VITE_STRIPE_PRICE_ID_MONTHLY=price_XXXXXXXXXXXXX
VITE_STRIPE_PRICE_ID_ANNUAL=price_YYYYYYYYYYYYY
```

Legacy fallback (monthly only — optional if you use `VITE_STRIPE_PRICE_ID_MONTHLY`):

```env
# VITE_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX
```

Restart the dev server after changing:

```bash
npm run dev
```

If you deploy the web app (Vercel, etc.), set the same variable in that host’s environment and redeploy.

---

## Step 4 — Update Supabase secrets

From your project directory (linked to `cjozidvlqwifqascgihc`):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXX
```

Get the live secret key from **Stripe Dashboard (Live) → Developers → API keys → Secret key**.

You do **not** need to redeploy edge functions after changing secrets — they read env at runtime.

---

## Step 5 — Create a live webhook

Test and live webhooks are separate.

1. Stripe Dashboard (**Live mode**) → **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:**
   ```
   https://cjozidvlqwifqascgihc.supabase.co/functions/v1/stripe-webhook
   ```
3. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Create the endpoint and copy the **Signing secret** (`whsec_...`).

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXX
```

---

## Step 6 — Detach test Stripe customers (keep existing Pro users)

Profiles store `stripe_customer_id` from test mode. Those IDs **do not exist in live mode** — checkout and billing portal will break if you leave them linked.

**Do not** reset `subscription_tier` / `subscription_status`. Existing Pro users keep Pro in the app; only the stale Stripe link is cleared.

Run in **Supabase SQL Editor** when you go live:

```sql
-- Drop test-mode Stripe customer links only. Pro access stays intact.
update public.profiles
set
  stripe_customer_id = null,
  updated_at = now()
where stripe_customer_id is not null;
```

Optional — preview who keeps Pro:

```sql
select email, subscription_tier, subscription_status, stripe_customer_id
from public.profiles
where subscription_tier = 'pro'
  and subscription_status in ('active', 'trialing');
```

Grandfathered Pro users (no live Stripe subscription yet):

- Keep full Pro features in the app
- **Manage billing** won’t work until they subscribe again on live Stripe
- **Sync status** in Settings will not strip their Pro access

New subscribers and anyone who re-subscribes get a fresh live `stripe_customer_id` via checkout.

---

## Step 7 — Verify live flow

1. Use a **real card** (you will be charged) or Stripe’s live test with a small amount you refund.
2. Sign in → **Upgrade** → complete Checkout.
3. Confirm in Supabase **Table Editor → profiles**:
   - `membership` = `pro`
   - `subscription_status` = `active`
   - `stripe_customer_id` starts with `cus_` (live customer)
4. If Pro doesn’t appear: **Settings → Sync status**, then check **Stripe → Webhooks → Live endpoint → Recent deliveries** for errors.

---

## Security notes

- Never commit `sk_live_...` or `whsec_...` to git. Only Supabase secrets + (for price ID) `.env.local` / host env.
- Remove any `supabase secrets set ...` lines from `.env.local` — that file is for `VITE_*` vars only.
- Rotate keys if test secrets were ever shared or committed.

---

## Quick reference

```bash
# 1. Live prices in .env.local (+ Vercel)
VITE_STRIPE_PRICE_ID_MONTHLY=price_live_monthly_...
VITE_STRIPE_PRICE_ID_ANNUAL=price_live_annual_...

# 2. Supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...

# 3. SQL: clear test stripe_customer_id only (Pro users keep access)

# 4. Restart dev server / redeploy web app
npm run dev
```

Test mode can stay enabled in parallel for development — use test keys in a separate `.env.local` or branch when experimenting.
