# Vessel — Inventory & Sales

A generic small-business inventory + sales web app. Multi-tenant: each
signed-up business gets its own isolated data (products, stock, sales,
settings). First real deployment is **Fragrenz**, a perfume decanting
business — the data model itself is domain-agnostic and works for any small
retail/inventory business.

Full project plan, data model, and decision log: **[CLAUDE.md](./CLAUDE.md)**.

## Stack

Next.js (App Router) + Prisma + SQLite (dev) / Turso (prod, planned) +
Tailwind, deployed on Vercel. Hand-rolled cookie-based auth (no NextAuth).
See CLAUDE.md §7 and §9 for the full rationale.

## Features

- **Products / Inventory / Sales / Dashboard** — CRUD, stock tracking with
  price history + audit trail, atomic sale entry (blocks oversell), and an
  analytics dashboard (sales trend, top products, category breakdown,
  low-stock alerts).
- **Multi-tenant auth** — email/password login, one user can belong to
  multiple businesses, admin-approval gating for new accounts and new
  businesses, plus a live read/write demo account.
- **Search, filtering, and pagination** on Products/Inventory (name search)
  and Sales (date-range presets + custom range).
- **Per-business currency** — PHP/USD/EUR/GBP, chosen at signup, purely a
  display label (no forex conversion).

## Getting started (local dev)

```bash
npm install
```

Copy `.env` (already present in this repo for local dev) — `DATABASE_URL`
points at a local SQLite file. **Must be an absolute path** — see CLAUDE.md
§7 for why relative paths break between the Prisma CLI and the Next.js dev
server.

Run migrations and seed the database:

```bash
npx prisma migrate dev
npx prisma db seed
```

This creates:
- The **Fragrenz** business + admin login (`admin@fragrenz.local` /
  `changeme123` — change the password after first login), seeded from
  `SALES AND INVENTORY.xlsx` via `scripts/extract_excel.py` →
  `prisma/seed_data/seed.json` → `prisma/seed.ts`.
- The **demo** business + login (`demo@vessel.app` / `demodemo`), a small
  mock candle-shop dataset. Reset it any time with:
  ```bash
  npx tsx prisma/seed-demo.ts
  ```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on
`/login` — log in as the Fragrenz admin, or click **Try the demo**.

## Useful commands

| Command | What it does |
|---|---|
| `npx prisma studio` | GUI to browse/edit database rows |
| `npx prisma migrate dev` | Apply schema changes to the local DB |
| `npx prisma db seed` | Re-run the Fragrenz Excel import (idempotent) |
| `npx tsx prisma/seed-demo.ts` | Reset the demo business to its mock data |
| `python scripts/extract_excel.py` | Re-extract `seed_data/seed.json` from the Excel source |

## Project structure

- `src/app/` — pages and server actions, one folder per route (`products/`,
  `inventory/`, `sales/`, `admin/`, `(auth)/`, etc.)
- `src/lib/` — shared server-side logic: `auth.ts` (sessions, approval
  gating), `prisma.ts` (client singleton), `currency.ts`, `dashboard-data.ts`
- `src/components/` — shared UI (search box, pagination, date filter, charts)
- `prisma/schema.prisma` — the full data model (11 domain tables + 4 auth
  tables — see CLAUDE.md §4 and §9)
- `prisma/seed.ts` / `prisma/seed-demo.ts` — the two seed paths described above

## Status / what's not done yet

Turso + Vercel deploy is the next step — see CLAUDE.md §7 and §9 for the
plan. Everything else (auth, multi-tenancy, admin approval, dashboards,
search/pagination) is built and verified locally.

## Learn more about the stack

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turso Documentation](https://docs.turso.tech)
