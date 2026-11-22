# PIECE OF US

**A million pieces. One world.**
An independent global art project: 1,000,000 equal squares, $8 each, every person leaving a small piece of their world in one shared artwork.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL + Storage) · Canvas 2D mosaic renderer · Figtree / Instrument Serif / IBM Plex Mono (self-hosted).

---

## Run it in 60 seconds (demo mode)

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase credentials the app runs in **demo mode**:

- an in-memory database (resets on restart), seeded with the 7,430-piece Founding Collection;
- the built-in **test checkout** (no money moves, but it uses the same signed-webhook path as a real provider);
- moderation by the local checks only (allowed **only** in demo mode; see below);
- admin at `/admin`, username `owner`, password `admin` (dev only).

## Tests

```bash
npm run test:unit    # 21 moderation-engine tests (policy, multilingual text, evasion, QR, fail-closed)
npm run test:sql     # 31 tests: runs the real migration + SQL functions in Postgres (PGlite)
npm run dev & npm run test:e2e   # 20 end-to-end API tests against a running server
```

The e2e suite covers the full purchase path, double-booking, moderation outcomes, bypass attempts (forged webhooks, injected decisions, disguised files, missing tokens), appeals, admin auth, reports + rate limits, removals with refunds and EXIF/GPS stripping.

---

## Production setup

### 1. Supabase
1. Create a project. In the SQL editor run `supabase/migrations/0001_init.sql`, then `supabase/seed_founding.sql` (regenerate it with `npm run seed:sql`).
2. Both storage buckets are created by the migration: `submissions` (private) and `pieces` (public).
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is used **only on the server**. RLS is on for every table with no public policies, and functions are executable only by `service_role`.

### 2. Content moderation (required for production)
| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | **Primary.** Claude reads the image, including any text inside it in any language, together with the title, description, name and country, against a written policy. It returns per-category scores through a forced tool call. |
| `MODERATION_MODEL` | Default `claude-sonnet-5-5`. |
| `OPENAI_API_KEY` | Optional second opinion (`omni-moderation-latest`, a free endpoint) on core harm categories. |

**How decisions are made** (`src/lib/moderation/policy.ts`): local checks for links, QR codes, contact details, hidden characters, leetspeak and known hate codes, plus the AI scores, are combined per category. Thresholds send ambiguous cultural, religious, historical and political content to **human review** and never auto-reject it. Copyright is never auto-rejected. Any signal of sexualisation of minors is rejected.

**Fail closed.** If every AI provider is down or slow (`MODERATION_TIMEOUT_MS`), the piece goes to manual review. It is never approved and never published. Without an AI key in production, *every* piece goes to manual review.

The decision is computed on the server during upload. Checkout is only possible while the database status is `awaiting_payment`. Publication happens only inside `confirm_payment()` and only for approved pieces. Unapproved images live in a private bucket and are copied to the public bucket only at publication.

### 3. Payments
`PAYMENT_PROVIDER=mock|paypal`, behind the interface in `src/lib/payments/types.ts`. To add a provider, implement `createCheckout`, `completeReturn`, `parseWebhook` and `refund`.

**Research (November 2026), for an Israel-registered owner:**
- **Stripe** does not operate directly for Israeli businesses (no local clearing licence). It is hiring in Israel, so check again before launch. Today the only route is a foreign entity.
- **PayPal** (implemented, Orders v2): available in Israel, and buyers can pay by card without an account. The standard Israeli rate is 3.4% + a fixed fee. At $8 the fees are reasonable on the standard rate; also ask PayPal for its micropayment rate (domestic 5% + a smaller fixed fee, about 0.20 ILS; international 6% + fixed fee; both plus 18% VAT on the fee) and use whichever is cheaper for an $8 sale.
- **Paddle** (merchant of record) charges 5% + 50¢, about 11% of an $8 sale, and routes sub-$10 products to custom pricing. It also handles VAT/sales tax worldwide, so it is now a realistic option.
- **Israeli acquirers** (Cardcom, Tranzila, Grow/Meshulam, PayMe): low percentage rates and local methods such as Bit and Apple Pay, but they need an Israeli merchant terminal and usually monthly fees. They are a good second adapter for local buyers.
- Ask your accountant about **VAT** (18% on sales to Israeli consumers; foreign consumers are normally zero-rated) and about issuing receipts.

PayPal setup: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`. Create a webhook pointing to `https://YOUR_DOMAIN/api/payments/webhook/paypal` for `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`, and put its id in `PAYPAL_WEBHOOK_ID`. Switch to `PAYPAL_ENV=live` and `PAYMENT_TEST_MODE=false` only after the account is approved.

Payment safety: the database primary key on `tile_claims` makes double-selling impossible. Confirmation is idempotent (webhook *and* return URL). Webhook events are de-duplicated. Amount and currency are verified. A payment that can't be published (square lost, amount mismatch, no longer approved) is **refunded automatically**.

### 4. Admin accounts (role-based)
```bash
npm run hash-password -- alice admin  'a-long-passphrase'
npm run hash-password -- ben moderator 'another-long-passphrase'
```
Put the output in `ADMIN_ACCOUNTS` (comma-separated). Set a long random `ADMIN_SESSION_SECRET`.
- **moderator**: queue, approve/reject/override/remove, notes, appeals, reports.
- **admin**: everything, plus revenue, manual refunds, CSV export and Founding Collection management.

Every action is written to the append-only `moderation_events` table; a database trigger blocks edits.

### 5. Notifications (optional)
`RESEND_API_KEY` + `NOTIFY_FROM`. Contributors who leave an e-mail are told when their piece is in review, approved (with a pay link), rejected, published, refunded or removed. Without a key, notices are logged as a dry run. Everyone also gets a private status link.

### 6. Scheduled job
`vercel.json` calls `/api/cron` once a day (Vercel Hobby limit; use every 15 minutes on Pro) (set `CRON_SECRET`). It expires unpaid holds and applies data retention: images of rejected, expired and removed pieces are deleted after 30 days, e-mails 30 days after a decision, IP hashes after 90 days, and report details after 1 year.

---

## How it fits together

```
src/
  app/                      pages + API routes
    page.tsx                homepage (hero → mosaic → counter → about → how it works)
    explore/                full-screen mosaic, go-to-number, “show me a piece”
    add/                    contribution flow (square → artwork + crop → details → review)
    status/[id]/            private status page: approved / in review / rejected+appeal / published
    piece/[number]/         permanent public page for every piece (Open Graph image)
    guidelines, faq, terms, privacy, contact
    admin/                  studio: overview, moderation queue + detail, reports, activity log, founding
    api/                    mosaic, reserve, submissions, checkout, payments (return/webhook), reports, admin, cron
  components/mosaic/        engine.ts (canvas renderer), Mosaic.tsx (interaction), data.ts (binary state)
  lib/
    founding/               deterministic Founding Collection: layout, palettes, 20 procedural renderers (textiles, patterns, painting, typography, 3D, mosaic, graphic design…)
    moderation/             local checks, Claude, OpenAI, decision policy
    payments/               provider interface, mock, PayPal
    repo/                   storage interface, in-memory (demo) and Supabase implementations
    service.ts              checkout, confirmation, refunds, moderator actions
supabase/
  migrations/0001_init.sql  tables, RLS, atomic SQL functions, retention
  seed_founding.sql         15,454 founding pieces
```

**The mosaic never renders a million DOM nodes.** `/api/mosaic/overview` sends one compact binary snapshot (12 bytes per non-empty square). Far out, a 1000×1000 overview bitmap draws one pixel per square. Closer in, visible chunks are rendered once per level of detail (16/48/128 px) into cached offscreen canvases. At the closest zoom, squares render individually at full resolution. Thumbnails load lazily. It supports drag, inertia, wheel and pinch zoom, double-click, and keyboard. On the homepage, scrolling the page still works: use ⌘/Ctrl + scroll or two fingers to move the mosaic. At very high volumes, replace the overview JSON with a pre-rendered overview image and per-chunk endpoints; the engine is already chunked.

**Founding Collection.** The pieces are generated deterministically, so server and browser agree without storing images. They include textiles (strip-weave, ikat, plaid, quilts, cross-stitch), tessellations, symbols of many faiths, the word “home” handwritten in 34 languages, architecture, food, landscapes, folk motifs, vessels, the sky and abstract compositions. They are labelled everywhere as the Founding Collection. They are not purchases and are not attributed to anyone. Admins can remove any of them to free its square.

## Before launch: checklist
- [ ] Legal review of Terms and Privacy (drafts are marked in the pages).
- [ ] PayPal micropayment rate approved; live credentials; webhook id; `PAYMENT_TEST_MODE=false`.
- [ ] `ANTHROPIC_API_KEY` set (and optionally `OPENAI_API_KEY`); test with real images in staging.
- [ ] A procedure for reporting child-exploitation material to the authorities (the system blocks it, but it doesn't file the legal report).
- [ ] Real contact addresses on `/contact`.
- [ ] `NEXT_PUBLIC_SITE_URL`, all secrets, and `ADMIN_ACCOUNTS` set; `ADMIN_PASSWORD` removed.
