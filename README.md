# DinnerSeats

A mobile-first seat booking app for a one-off dinner event. Payment happens offline; this app handles seat selection once a guest's payment is confirmed by an admin.

- **Client**: React (Vite + TypeScript) + React Router + Tailwind CSS
- **Server**: Node.js + Express (TypeScript) REST API
- **DB**: PostgreSQL via Prisma
- **QR codes**: generated server-side with the `qrcode` package
- **Auth**: no external auth service — a single admin password (`ADMIN_PASSWORD`) protects `/admin`, with a signed httpOnly cookie session

The Express app (`server/src/app.ts`) is shared by two entrypoints:
- `server/src/index.ts` — a traditional long-running Node process (serves the built client from `client/dist` too). Use this for VPS/Railway/Fly.io.
- `api/index.ts` — a thin wrapper exporting the same app for Vercel's Node.js serverless runtime. On Vercel, `vercel.json` serves `client/dist` as static output and routes `/api/*` to this function.

## How it works

1. Admin confirms a guest paid (offline), then creates a **booking** in `/admin`: guest name, optional phone, and number of seats they're entitled to.
2. The app generates a short code (e.g. `DNR-4X7K`, no ambiguous `0/O`/`1/I` characters) and a QR code encoding `https://<host>/b/<CODE>`.
3. The guest scans the QR (or types the code on the home page) and lands on `/b/<CODE>`.
4. They see the live seating map, pick exactly the number of seats they're allowed, and confirm.
5. Confirmed seats are locked (enforced by a DB-level unique constraint + transaction — see [Concurrency](#concurrency) below). Revisiting the same link shows their assigned seats read-only.

## Project layout

```
DinnerSeats/
├── api/        Vercel serverless entrypoint (re-exports the Express app)
├── client/     React app (Vite + TS + Tailwind + React Router)
└── server/     Express API + Prisma (PostgreSQL)
```

## Setup

Requires Node 20+ and a PostgreSQL database. For local dev without a cloud DB, run one in Docker:

```bash
docker run -d --name nox-dinner-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=dinnerseats \
  -p 55432:5432 -v nox-dinner-pgdata:/var/lib/postgresql/data --restart unless-stopped postgres:16-alpine
```

```bash
npm install                # installs both client and server workspaces, generates the Prisma client
cp server/.env.example server/.env
# edit server/.env: set DATABASE_URL (e.g. postgresql://postgres:devpass@localhost:55432/dinnerseats),
# a real ADMIN_PASSWORD, EVENT_NAME, etc.
npm run migrate            # applies the committed migrations
npm run seed                # optional: demo layout + sample bookings
```

### Environment variables (`server/.env`)

| Var | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | *(required)* |
| `ADMIN_PASSWORD` | Password for `/admin` | *(required)* |
| `EVENT_NAME` | Shown in the header on every page | `Dinner Event` |
| `PORT` | Express port (ignored on Vercel) | `3001` |
| `COOKIE_SECRET` | Signs the admin session cookie | falls back to `ADMIN_PASSWORD` |

## Running locally

```bash
npm run dev
```

This runs the Express API (`localhost:3001`) and the Vite dev server (`localhost:5173`) together via `concurrently`. Vite proxies `/api/*` to Express, so open **http://localhost:5173**.

- Guest home: `http://localhost:5173/`
- A guest booking link: `http://localhost:5173/b/<CODE>` (see codes printed by the seed script)
- Admin: `http://localhost:5173/admin` (password = your `ADMIN_PASSWORD`)

## Building for production

```bash
npm run build     # builds client to client/dist, then compiles server to server/dist
NODE_ENV=production npm start
```

In production, Express serves the built client from `client/dist` and the API from the same process/port — deploy as a single Node app. Set `NODE_ENV=production` so Express serves static files and marks the session cookie `secure`.

## Concurrency & data integrity

Seat confirmation is the one place double-booking could happen, so it's handled carefully:

- `SeatAssignment.seatId` has a **UNIQUE constraint** — this is the actual double-booking guard, not application logic.
- Confirming seats runs inside a single Prisma `$transaction`: the booking's status is flipped from `pending` → `confirmed` with a conditional `updateMany` (so two concurrent confirms on the same booking can't both succeed), then the seat assignments are inserted. If any seat was already taken, the unique constraint throws, the whole transaction rolls back, and the API responds `409` with exactly which seats were lost so the client can re-fetch the map and prompt the guest to pick again.
- The server **never trusts the client's `seatsAllowed`** — it always re-reads the booking from the DB and validates the submitted seat count against it.

## Admin panel

- **Layout builder** (`/admin/tables`): create/edit/delete tables or rows; seats auto-generate labels like `T5-3`. Shrinking a table is blocked if it would delete an already-booked seat; deleting a table is blocked if any of its seats are booked.
- **Bookings** (`/admin/bookings`): create a booking → immediately see its code + downloadable QR. Search by name/code/phone. Edit name/phone/seat count (seat count only while pending), revoke (frees seats), clear a confirmed booking's seats back to pending, or manually assign specific seats to a guest.
- **Live seat map** (`/admin/seatmap`): every seat colored free/taken, tap a seat to see who's in it, auto-refreshes every 5s.
- **Export CSV** (`/admin/bookings` → "Export CSV"): guest name, phone, code, seat labels, table names for all confirmed bookings.
- **Bulk QR print** (`/admin/print`): print-friendly page of every pending booking's QR + name + code, for handing out slips.

## Guest flow

- **Home** (`/`): type a code, or just scan the QR handed out (phone camera → `/b/<code>` directly, no in-app scanner).
- **Booking page** (`/b/:code`):
  - Invalid/revoked code → friendly error.
  - Pending → greeting, seating map (tables horizontally scrollable, ~42px tap targets), sticky bottom bar showing "`n` of `seatsAllowed` selected — Confirm seats". Picking beyond the allowance swaps out the oldest pick with a hint toast. Polls the map every 4s so availability stays live.
  - Confirmed → read-only "Your seats" card with seat labels + table names, big and clear. No seat changes after confirmation (admin can clear/reassign from the panel).

## Deployment notes

The app now uses PostgreSQL, so it's fine to run on stateless/serverless hosting as well as traditional single-process hosting:

- **Vercel**: import the repo, set `DATABASE_URL`, `ADMIN_PASSWORD`, `EVENT_NAME`, `COOKIE_SECRET` as project env vars. `vercel.json` builds the client to `client/dist` (served as static output) and routes `/api/*` to `api/index.ts`, a serverless function wrapping the same Express app. `postinstall: prisma generate` in `server/package.json` runs automatically during Vercel's build. Use a pooled Postgres connection string (e.g. Neon's `-pooler` host) since each function invocation can open its own connection. Run `npm run migrate` against production `DATABASE_URL` once (locally or via a one-off script) before/after the first deploy — Vercel doesn't run migrations for you.
- **VPS**: `npm run build`, run `NODE_ENV=production node server/dist/index.js` behind a process manager (pm2/systemd) and reverse proxy (nginx/caddy) for TLS.
- **Railway / Render / Fly.io**: deploy as a single Node service, set env vars (including `DATABASE_URL` pointing at a managed Postgres instance), run `npm run build` then `npm start`.
