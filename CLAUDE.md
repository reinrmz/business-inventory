# Inventory & Sales System

Central plan doc. A **generic** small-business inventory + sales web app. First
deployment is a perfume decanting/reselling business (migrating off
`SALES AND INVENTORY.xlsx`), but the data model is domain-agnostic — perfume is
just one dataset in a model that fits any small retail/inventory business.

Status: **core screens built and working locally** (Products, Inventory, Sales,
Dashboard). Not yet done: auth, Turso/Vercel deploy.

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
  variants along Size + Concentration (20/25/30/35 %).
- `in Pcs` / `in PESO` rows = derived rollups (not stored). `GOAL` → `setting`.
  `COSTS` row empty → cost now tracked per variant.

### Migration script (Python + openpyxl, available)
1. Seed `setting` (currency, goal), `category` rows, `attribute` + `attribute_value`
   rows (sizes with default prices, concentrations).
2. Main table rows 2–18 → products (Main); non-empty cells → variants with
   `stock_qty` from INVENTORY, `price` = size default, `variant_attribute`=size.
3. Oil sub-tables → products (Oil); cells → variants with Size + Concentration.
4. **Skip** SALES-sheet totals — no historical sales seeded; sales log starts
   clean at go-live (decided).
5. Skip `in Pcs`/`in PESO`/`GOAL`/`COSTS` rows. Trim/normalize product names.

Verify:
- 17 main + 5 oil products; variant count = non-empty Excel cells.
- `stock_qty` per size totals match Excel `in Pcs` row.
- Σ `stock_qty × default_price` per size matches `in PESO` (50 ML: 64 → ₱19,200).
- Test sale decrements the right variant + writes snapshot `sale_item`;
  editing a variant price writes a `price_history` row and does not change the sale.

---

## 6. Decisions Log (resolved)

- **Negative stock**: **block** the sale when qty > on-hand. Must restock first.
  Enforced atomically in the sale transaction (reject if any line oversells).
- **Historical sales**: **not seeded**. Import stock only; sales log starts clean.
- **Auth**: **single shared login** (one owner account) for v1. Multi-user/roles
  deferred. `changed_by` fields stay nullable until then.
- **Currency**: PHP (₱), from `setting`.
- **Table count**: **fully generic, 11 tables** (confirmed over a simpler
  flat-column alternative) — see §4.

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
   Currently bare-bones Tailwind (tables + plain forms), no design pass yet.
5. **UI design pass** — client requested this before Turso/deploy. Take the 4
   functional screens and give them real visual design (layout, hierarchy,
   color, empty/loading states) rather than default utility styling. **← next**
6. Single-login auth; connect Turso; deploy to Vercel.

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
