# Switch Stripe from test mode to live

Disc Caddy uses Stripe in three places. **All three must use live keys together** — mixing test and live will fail.

| Where | Variable | Test → Live |
|-------|----------|-------------|
| Frontend (`.env.local`) | `VITE_STRIPE_PRICE_ID` | `price_...` from **live** product |
| Supabase secrets | `STRIPE_SECRET_KEY` | `sk_live_...` |
| Supabase secrets | `STRIPE_WEBHOOK_SECRET` | `whsec_...` from **live** webhook |

---

## Step 1 — Activate your Stripe account

In [Stripe Dashboard](https://dashboard.stripe.com):

1. Complete **Settings → Business settings** (identity, bank account, business details).
2. Stripe must show your account as able to accept live payments before continuing.

---

## Step 2 — Create the live product & price

1. Toggle the dashboard from **Test mode** to **Live mode** (top-right).
2. **Product catalog → Add product**
   - Name: **Disc Caddy Pro**
   - Price: **$4.99 / month** (recurring)
3. Copy the **Price ID** (`price_...`) — it is **different** from your test price ID.

---

## Step 3 — Update `.env.local`

```env
VITE_STRIPE_PRICE_ID=price_XXXXXXXXXXXXX   # live price ID
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

## Step 6 — Clear test customer links (important)

Profiles store `stripe_customer_id` from test mode. Those IDs **do not exist in live mode** — checkout and webhooks will break for those users.

Run in **Supabase SQL Editor** when you go live:

```sql
-- Reset subscription state tied to test-mode Stripe data.
-- Users re-subscribe via Upgrade after this.
update public.profiles
set
  stripe_customer_id = null,
  subscription_tier = 'free',
  subscription_status = 'free',
  subscription_period_end = null
where stripe_customer_id is not null;
```

If you only want to reset your own account during testing:

```sql
update public.profiles
set stripe_customer_id = null,
    subscription_tier = 'free',
    subscription_status = 'free',
    subscription_period_end = null
where email = 'your@email.com';
```

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
# 1. Live price in .env.local
VITE_STRIPE_PRICE_ID=price_live_...

# 2. Supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...

# 3. SQL: clear test stripe_customer_id rows

# 4. Restart dev server / redeploy web app
npm run dev
```

Test mode can stay enabled in parallel for development — use test keys in a separate `.env.local` or branch when experimenting.
