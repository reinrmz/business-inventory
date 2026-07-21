# Inventory & Sales System

Central plan doc. A **generic** small-business inventory + sales web app. First
deployment is a perfume decanting/reselling business (migrating off
`SALES AND INVENTORY.xlsx`), but the data model is domain-agnostic — perfume is
just one dataset in a model that fits any small retail/inventory business.

Status: **core screens + multi-tenant auth built and working locally**
(Products, Inventory, Sales, Dashboard, login/signup, admin approval, demo
account). Not yet done: Turso/Vercel deploy.

---

## 1. Product Goals

- **Generic, flexible core** — not hardcoded to perfume. Any business defines its
  own product categories and variant dimensions (size, color, concentration,
  flavor, etc.) without schema changes.
- **Easy inventory upkeep** — client can add / remove / edit products, prices,
  stock any time via simple web UI.
- **Sales tracking** — per-transaction log, auto-decrement stock, cost/profit,
  history.
- **Edits never rewrite the past** — changing a price/cost/stock today does not
  alter any already-recorded sale.

Currency configurable (first client: PHP ₱). Reinvestment goal setting
(first client: ₱15,000–20,000).

---

## 2. Core Feature List

1. **Product management (CRUD)** — client adds/removes/edits products anytime.
   Soft-delete via `active` flag so historical sales keep their product link.
2. **Editable pricing & stock** — price, cost, and stock on each SKU are editable
   anytime. Edits are **forward-only**: past sales are frozen (see §3, snapshots).
3. **Flexible variant dimensions** — each product can have variants along
   arbitrary attributes (size, concentration, …) defined per business, no schema
   change needed.
4. **Sales entry** — record a transaction (one or many line items), auto-decrement
   stock in one atomic operation.
5. **Cost & profit** — track unit cost; dashboard shows revenue, profit, stock
   value, progress vs goal.
6. **Price history** — every price/cost change is recorded with a timestamp.
7. **Stock audit trail** — non-sale stock changes (restock/correction) logged.
8. **Low-stock alerts** — optional per-SKU reorder level.

---

## 3. Design Principles

- **Generic first**: perfume specifics live in *data* (categories, attributes),
  not in the schema. Reusable for any business.
- **Forward-only edits**: `variant` holds current price/cost/stock (editable).
  `sale_item` snapshots price+cost at sale time → past sales never change.
  `price_history` additionally records the change timeline.
- **Normalized rows, not a matrix**: adding a product/attribute is a data insert,
  never a schema change (the Excel used columns per size — brittle).

---

## 4. Data Model (generic) — 11 tables

Core chain: `category` → `product` → `variant` (sellable SKU). A variant's
dimensions are described by flexible `attribute` / `variant_attribute` rows, so
any business defines its own axes. Sales are transactions that deduct stock.

### `category`
Arbitrary product grouping (replaces perfume-specific "product line").
- `id`
- `name` — e.g. "Main Decants", "Oil Concentration", or any business's categories
- `active` (bool)

### `attribute` — a dimension a business tracks
- `id`
- `name` — e.g. "Size", "Concentration", "Color"
- `unit` — nullable (e.g. "ML", "%")

### `attribute_value` — allowed values for an attribute
- `id`
- `attribute_id` → attribute
- `value` — e.g. "50 ML", "25", "Red"
- `sort_order`

### `product`
- `id`
- `category_id` → category
- `name`
- `active` (bool)  ← soft-delete; keeps historical sale links intact
- `notes` (nullable)

### `variant` — sellable SKU (a product in a specific attribute combination)
- `id`
- `product_id` → product
- `sku` — nullable human/auto code
- `price` — current selling price (editable)
- `cost` — current unit cost (editable, nullable)
- `stock_qty` — current on-hand (editable)
- `reorder_level` — nullable (low-stock alert)
- `active` (bool)

### `variant_attribute` — links a variant to its attribute values
- `variant_id` → variant
- `attribute_value_id` → attribute_value
- (a variant = a unique set of these; e.g. Size=50 ML + Concentration=25)

### `price_history` — timeline of price/cost changes
- `id`
- `variant_id` → variant
- `price` , `cost`
- `changed_at` — datetime
- `changed_by` — nullable
- Written whenever a variant's price or cost is edited.

### `sale` — transaction header
- `id`
- `sold_at` — datetime (default now)
- `customer` — nullable
- `total_amount` — stored sum of items
- `note` — nullable

### `sale_item` — line in a sale (SNAPSHOT — the frozen past)
- `id`
- `sale_id` → sale
- `variant_id` → variant
- `qty`
- `unit_price` — captured at sale time (never changes when variant edited later)
- `unit_cost` — captured at sale time (profit at time of sale)
- `line_total` — qty × unit_price

On sale creation: insert sale + items **and decrement `variant.stock_qty`** in one
transaction. **Blocks** if qty requested > stock_qty (decided — see §6).

### `stock_adjustment` — audit trail for non-sale stock changes
- `id`, `variant_id`, `delta` (+/-), `reason` (enum: `restock`|`correction`|`initial`),
  `created_at`, `note`

### `setting` — k/v (per-deployment config)
- `key`, `value` — e.g. `currency=PHP`, `reinvestment_goal_min=15000`,
  `reinvestment_goal_max=20000`

### Derived (computed, not stored)
- Revenue = Σ `sale_item.line_total`
- Profit = Σ `(unit_price − unit_cost) × qty`
- Stock value = Σ `variant.stock_qty × price`
- Goal progress = revenue/profit vs `reinvestment_goal_*`

### How the two "history" mechanisms differ
- `sale_item` snapshot → guarantees a **past sale's** numbers never move.
- `price_history` → lets the client **see when prices changed** over time.
Both requested; they serve different questions.

---

## 5. First Dataset: Perfume Business (Excel decode)

The perfume business maps onto the generic model as **data**:

- Source: `C:\Users\Reinhard Ramirez BTG\Downloads\SALES AND INVENTORY.xlsx`.
  Two sheets (INVENTORY = on-hand, SALES = sold), matrix layout product × size.
- **Categories**: "Main Decants", "Oil Concentration".
- **Attributes**: `Size` (ML), `Concentration` (%).
- **Size values + default prices** (from Excel `qty*price` formulas):

  | Size | Price (₱) |
  |------|-----------|
  | 50 ML | 300 |
  | 30 ML | 200 |
  | 100 ML (type A) | 500 |
  | 100 ML (type B) | 450 |
  | Scraps | 200 |
  | 10 ML | 100 |
  | 10 ML (LP) | 80 |

  The two "100 ML" columns = **different bottle types** → two size values.
- **Main line**: 17 products × Size variants.
- **Oil line**: 5 products (Blooming Bouquet, Hawas Ice, Black Opium, SWYI, BDC),
  variants along Size + Concentration (20/25/30/35 %). **Own pricing scheme**,
  separate from the main-line size prices above (confirmed from `in PESO`
  formulas in both sheets, e.g. `INVENTORY!B29 =B28*220`):

  | Size | 20% | 25% | 30% | 35% |
  |------|-----|-----|-----|-----|
  | 50 ML | ₱220 | ₱270 | ₱300 | ₱350 |
  | 10 ML | *(blank — no price set)* | ₱100 | ₱135 | ₱175 |

  10 ML / 20% has no formula anywhere in the workbook — price is unset;
  client sets it manually in the Inventory screen after import.
- `in Pcs` / `in PESO` rows = derived rollups (not stored). `GOAL` → `setting`.
  `COSTS` row empty → cost now tracked per variant.

### Migration script (Python + openpyxl, available)
1. Seed `setting` (currency, goal), `category` rows, `attribute` + `attribute_value`
   rows (sizes with default prices, concentrations).
2. Main table rows 2–18 → products (Main); non-empty cells → variants with
   `stock_qty` from INVENTORY, `price` = size default, `variant_attribute`=size.
3. Oil sub-tables → products (Oil); cells → variants with Size + Concentration.
4. SALES-sheet totals → one **opening balance** `sale` (dated at import time),
   one `sale_item` per non-empty cell (`qty` from SALES sheet, `unit_price` =
   size default, `unit_cost` = null — no historical cost data exists).
5. Skip `in Pcs`/`in PESO`/`GOAL`/`COSTS` rows. Trim/normalize product names.

Verify:
- 17 main + 5 oil products; variant count = non-empty Excel cells.
- `stock_qty` per size totals match Excel `in Pcs` row.
- Σ `stock_qty × price` per size matches `in PESO` (50 ML: 64 → ₱19,200;
  grand total across both sheets → ₱38,865 stock value, ₱3,570 opening sale).
- Test sale decrements the right variant + writes snapshot `sale_item`;
  editing a variant price writes a `price_history` row and does not change the sale.
- Re-verified after adding opening-sale migration: extractor totals now match
  Excel exactly (revenue ₱3,570, stock value ₱38,865) — confirmed the oil-line
  pricing table above, not the main-line size price, applies to those variants.

---

## 6. Decisions Log (resolved)

- **Negative stock**: **block** the sale when qty > on-hand. Must restock first.
  Enforced atomically in the sale transaction (reject if any line oversells).
- **Historical sales**: **seeded as one lump "opening balance" sale** (revised
  from the original "skip" decision — client wants existing SALES totals
  reflected, not a ₱0 start). One `Sale` record per import run, dated at
  import time, one `SaleItem` per non-empty SALES-sheet cell (qty × default
  price). `unitCost` is `null` on these lines — Excel never tracked cost
  (`COSTS` row empty), so profit only accrues from cost-tracked sales going
  forward. Re-running the seed on updated Excel data replaces this opening
  sale (see migration script, §5).
- **Auth**: superseded — see §9. App is now **multi-tenant**: many businesses,
  a user can belong to several, one login per business (no in-business roles
  yet), both new users and new businesses need admin approval, plus a
  read/write demo account. `changed_by` fields stay nullable (no in-business
  roles = nothing meaningful to attribute yet).
- **Currency**: PHP (₱) for Fragrenz, USD for the demo business — both from
  `setting`, now scoped per business (see §9 schema changes).
- **Table count**: 11 domain tables (§4) + 4 auth tables (§9) = 15.

### Still open (not blocking build)
- Multi-user + roles (later, if staff added).

---

## 7. Tech Stack

**Next.js + Prisma + Turso, deployed on Vercel.** One language (TypeScript),
one repo, free hosting + free DB, no server to manage.

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js** (App Router, React) | UI + API in one repo; server actions for mutations |
| UI | React + **Tailwind** | Fast, simple CRUD screens |
| ORM | **Prisma** | Schema maps §4 model directly; migrations; type-safe |
| DB | **Turso** (hosted libSQL/SQLite) | Free, serverless-compatible, SQLite-simple, no provisioning |
| Host | **Vercel** | Free tier, native Next.js, git-push deploy |
| Auth | Single shared login | Simple credential/session; NextAuth or a minimal middleware |
| Migration | **Python + openpyxl** (one-off) | Reads Excel → seeds Turso; language already available |

**Notes / gotchas**
- Plain-file SQLite does NOT persist on Vercel (ephemeral FS). Turso =
  SQLite-over-network → works on serverless. Connect via Prisma libSQL adapter
  (`@prisma/adapter-libsql` + `@libsql/client`), env: `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN`.
- **Local dev does NOT need Turso.** Dev uses a plain local SQLite file
  (`prisma/dev.db`) — `npm run dev` → `http://localhost:3000`, hot-reload like
  Streamlit. Turso only matters at deploy time. Same Prisma schema, different
  connection string per environment (`.env` vs `.env.production`).
- If a switch to Postgres is ever needed (Neon/Vercel Postgres), Prisma makes it
  a provider swap — model unchanged.
- **`DATABASE_URL` must be an absolute path locally**, e.g.
  `file:E:/Files/projects/business-inventory/prisma/dev.db`. A relative
  `file:./dev.db` resolves differently depending on which tool reads it —
  Prisma CLI resolves relative to `prisma/schema.prisma`'s folder, but the
  Next.js dev server resolves relative to the project root — so the same
  string points at two different files and one side gets
  "Unable to open the database file". Absolute path avoids the ambiguity
  entirely. Not an issue in production (Turso URL is a network address, not
  a filesystem path).

### Build order
1. ~~`npx create-next-app` (TS + Tailwind), add Prisma + libSQL adapter.~~ done
2. ~~Define Prisma schema from §4; run first migration against local SQLite.~~ done
3. ~~Migration script: Excel → seed data; run §5 verification checks.~~ done
   — verified stock totals match Excel exactly (50 ML: 64 pcs, ₱19,200, etc.)
4. ~~Screens: Products CRUD → Inventory view/edit → Sale entry (atomic, block
   oversell) → Dashboard (revenue/profit/stock value/goal).~~ done — all 4
   pages built and smoke-tested locally (200 OK, correct data, oversell
   blocked, price edits don't rewrite past sales — verified end-to-end).
5. ~~UI design pass~~ done — "Vessel" visual identity (violet accent, gold for
   money, Space Grotesk display + Geist body, label-card motif, light/dark
   theme toggle). See §9 for what's still cosmetic-only (currency symbol is
   hardcoded ₱ regardless of business `setting`).
6. ~~Multi-tenant auth (users, businesses, admin approval, demo account)~~
   done — see §9. **← next: connect Turso; deploy to Vercel.**

---

## 8. For a Next.js / Prisma newcomer (client + dev context)

Dev on this project has a Python (Streamlit) + AngularJS background, new to
Next.js. Quick orientation, kept here so it isn't re-explained every session:

- **Next.js** ≈ React with file-based routing + built-in backend (API routes /
  server actions) in the same project. No separate Express server needed.
- **`npm run dev`** starts a local server at `localhost:3000` with hot-reload
  (edit-and-see, like Streamlit's auto-rerun).
- **Prisma** = the ORM. `schema.prisma` defines tables (§4); `npx prisma migrate dev`
  applies changes to the local SQLite DB; `npx prisma studio` opens a GUI to
  browse/edit rows (handy instead of raw SQL).
- **Server actions** replace what would be a separate REST API — a function
  marked `"use server"` runs on the server but is called directly from a React
  component, no manual fetch/endpoint wiring needed for simple CRUD.

---

## 9. Multi-Tenant Auth (built)

Client decided (mid-build) to support **multiple businesses**, not just
Fragrenz — real login, data isolation per business, and controlled
onboarding (not open self-service) since the client wants personal oversight
of who gets in.

### Decisions
- **Multi-tenant**: `Business` is the data boundary. One `User` can belong to
  many businesses (`Membership` join table) — e.g. one owner running two
  shops, switchable via a dropdown in the header.
- **One login per business** — no owner/staff roles within a business yet.
- **Both new users AND new businesses need admin approval** before they're
  usable. Reviewed via a simple `/admin` page (pending lists, Approve/Reject).
  Exactly one admin — a plain `isAdmin` boolean on `User`, not a role system.
- **Standard email + password** login, not Google/OAuth — simplest to build,
  no external account dependency, composes cleanly with approval gating.
- **Demo account**: a "Try the demo" button on `/login`, backed by a real,
  read/write `Business` ("Demo Boutique") with mock candle-shop data.
  Resets nightly via Vercel Cron so it doesn't degrade.

### Auth mechanism
Hand-rolled **database-backed sessions** (not NextAuth, not JWT) — the
"Database Sessions" pattern from Next.js's own docs. An httpOnly cookie
holds an opaque random token; a `Session` row (storing only a SHA-256 hash
of the token) maps it to a `User`. Passwords hashed with `bcryptjs`.
Rejected NextAuth (unneeded OAuth/adapter complexity, a second framework to
learn) and stateless JWT (can't cleanly support revocation/re-validation
when a business's approval status or membership changes mid-session).

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) does only an
**optimistic cookie-presence check** — redirects to `/login` if the
`session` cookie is simply absent, no DB call. All real validation lives in
`src/lib/auth.ts`:
- `getCurrentUser()` — resolves session → user, checks `user.status`
  (`PENDING`/`REJECTED` block usage even though login itself succeeded).
- `getCurrentBusinessId(userId)` — reads the `activeBusinessId` cookie,
  re-validates a `Membership` exists **and** the business is `APPROVED` on
  every call (a user could edit the cookie to point at a business they
  don't belong to — never trusted blindly).
- `requireBusinessContext()` — convenience wrapper combining both, used at
  the top of every page/action; redirects to `/login`,
  `/pending-approval?reason=...`, or `/businesses/new` as appropriate.

### Schema additions (`prisma/schema.prisma`)
Four new models: `User`, `Business`, `Membership`, `Session`, plus
`UserStatus`/`BusinessStatus` enums (`PENDING | APPROVED | REJECTED`).
`businessId` (required `Int` FK) added directly to **all 11 existing domain
models** — not just "root" ones — so every scoped query is the same simple
`where: { businessId, ... }` shape, no nested relation-chain filters to get
right or forget. `Setting`'s primary key changed from `key @id` to
`id @id @default(autoincrement())` + `@@unique([businessId, key])`, since the
same key (e.g. `"currency"`) now exists once per business.

Scoping was done via **explicit `requireBusinessContext()` calls**, not a
Prisma Client Extension — an extension would need `AsyncLocalStorage`-based
request context to scope correctly against the shared `PrismaClient`
singleton, real complexity with a scary failure mode (cross-tenant leaks) if
ever wrong. An explicit helper call is greppable and matches the rest of the
codebase's style.

### Key files
- `src/lib/auth.ts` — session creation/validation, password hashing, the
  approval-aware `getCurrentUser`/`getCurrentBusinessId`/`requireBusinessContext`.
- `src/app/(auth)/actions.ts` — `signup`, `login`, `logout`, `loginAsDemo`,
  `createBusiness`, `switchBusiness`.
- `src/app/login/`, `src/app/signup/`, `src/app/pending-approval/`,
  `src/app/businesses/new/` — auth-facing pages.
- `src/app/admin/page.tsx` + `actions.ts` — pending-approval review UI.
- `src/app/header.tsx` — nav + business switcher + logout, replaces the old
  inline header in `layout.tsx`.
- `prisma/seed.ts` — now creates/reuses the Fragrenz business + a placeholder
  admin login (`admin@fragrenz.local` / `changeme123` — **change after first
  login**) before importing Excel data, all scoped to that business.
- `prisma/seed-demo.ts` — shared seed/reset function for the demo business
  (`demo@vessel.app` / `demodemo`); also the manual reset entry point
  (`npx tsx prisma/seed-demo.ts`).
- `src/app/api/cron/reset-demo/route.ts` + `vercel.json` — nightly demo reset
  via Vercel Cron, guarded by a `CRON_SECRET` env var.

### Dynamic currency (built)
`src/lib/currency.ts` maps a business's `Setting.currency` code (PHP/USD/
EUR/GBP) to a display symbol. `getCurrencySymbol(businessId)` for pages that
don't already have the settings loaded; `currencySymbolFor(code)` for pages
(like the dashboard) that already fetched `Setting` rows and just need the
mapping. All 4 pages (Dashboard, Inventory, Sales + its form) now render the
business's actual currency — verified Fragrenz shows ₱, demo shows $, no
cross-contamination.

A "+ New business…" option was added to the header's business-switcher
dropdown (`src/app/business-switcher-select.tsx`), navigating to
`/businesses/new` — previously that page existed but had no UI entry point.

### Known gaps (not blocking)
- No password-reset flow — v1 accepts "admin resets manually via Prisma
  Studio" for the rare case, given the small scale.
- Rejection (user or business) is terminal — no re-apply flow.

---

## 10. Dashboard Analytics (built)

Added beyond the original revenue/profit/stock-value/goal tiles, using the
`dataviz` skill's method (form chosen by the data's job, color validated
computationally, not eyeballed):

- **Sales trend** — line chart, daily (30d) / weekly (12wk) toggle, hover
  crosshair + tooltip. `src/components/sales-trend-chart.tsx`.
- **Top products** — horizontal bar, top 5 by revenue, qty sold direct-labeled.
  `src/components/top-products-chart.tsx`.
- **Revenue by category** — horizontal **stacked bar**, not a donut. The skill
  flags a 2-slice pie as usually the wrong call for part-to-whole; a stacked
  bar reads faster and labels more precisely for Fragrenz's 2 categories.
  `src/components/category-breakdown-chart.tsx`.
- **Low stock panel** — variants at/below `reorderLevel`, **or simply at zero
  stock even with no reorder level configured** (fixed bug: Fragrenz's Excel
  import never populated `reorderLevel` on any variant, so the original
  `reorderLevel: { not: null }` filter silently hid every out-of-stock item).
  Status-red count badge (icon+label, not color-alone per the skill's
  status-color rule). `src/components/low-stock-panel.tsx`.
- **Avg order value** — new 4th stat tile.

**Currency picker on business creation** (fixed gap: currency was previously
only ever set by seed scripts, no UI existed — a signed-up business silently
fell back to PHP regardless of the owner's actual currency). Both `signup`
and `createBusiness` (`/businesses/new`) now include a currency dropdown
(PHP/USD/EUR/GBP), writing the `Setting` row at creation time. This is a
**display label only** — no forex/conversion, every stored number is a plain
integer in whatever currency the business operates in. Changing currency
after creation still requires Prisma Studio (no Settings page yet — scoped
out for this pass, along with the reinvestment goal which has the same gap).

Data layer: `src/lib/dashboard-data.ts` (`getSalesTrend`, `getTopProducts`,
`getCategoryBreakdown`, `getLowStockVariants`, `getAverageOrderValue`) — all
businessId-scoped, verified to sum consistently against raw `sale_item` totals
for both Fragrenz and the demo business.

**Categorical chart palette** — 5 hues, added to `globals.css` as
`--chart-1`..`--chart-5` (+ `--chart-grid`/`--chart-axis`), validated with the
dataviz skill's `validate_palette.js` against this app's own surfaces
(`#ffffff` light / `#1c1b22` dark), adjacent-pairs mode (correct for bar/stack
charts where marks sit in a fixed sequence, not scatter/map's all-pairs case):
light passes with one CVD WARN (6–8 floor band, mitigated by the mandatory
direct labels already used); dark passes clean. Fixed order, never cycled;
past 5 series, fold into "Other" rather than generating a 6th hue.
