# Shared Expenses App

A shared expense tracker for a household with changing membership over time,
built as an assignment submission. See `SCOPE.md` for the data anomaly log
and schema, `DECISIONS.md` for the engineering decision log, and
`AI_USAGE.md` for how AI tools were used during development.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Express + TypeScript + Prisma + PostgreSQL
- **Auth:** JWT (httpOnly cookies)
- **Monorepo:** npm workspaces (`/frontend`, `/backend`, `/shared`)

## Project Structure

```
shared-expenses-app/
├── frontend/        Next.js app (UI)
├── backend/         Express API + Prisma schema + migrations
├── shared/          TypeScript enums/types shared by both
├── SCOPE.md         Anomaly log + database schema overview
├── DECISIONS.md     Engineering decision log
├── AI_USAGE.md      AI tools, prompts, and corrections made
└── README.md        (this file)
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a connection string to a hosted instance)
- npm 9+ (for workspaces support)

## Setup

1. Install dependencies (run from repo root — installs all workspaces):
   ```
   npm install
   ```

2. Configure the backend environment:
   ```
   cd backend
   cp .env.example .env
   ```
   Edit `.env` and set `DATABASE_URL` to your Postgres connection string,
   and `JWT_SECRET` to a random string.

3. Run database migrations:
   ```
   npm run prisma:migrate --workspace=backend
   ```

4. Start the backend (from repo root):
   ```
   npm run dev:backend
   ```
   This runs on `http://localhost:4000`. Verify with:
   ```
   curl http://localhost:4000/health
   ```

5. Start the frontend (in a separate terminal, from repo root):
   ```
   npm run dev:frontend
   ```
   This runs on `http://localhost:3000`.

## Importing the CSV

(Documented fully once Module 5 — Import Engine — is built.) The import
feature is accessed from the app UI after logging in and creating/selecting
a group. The provided `Expenses_Export.csv` is ingested as-is — no manual
edits to the file are required or supported.

## AI Tools Used

See `AI_USAGE.md` for the full log. In summary: [Claude / ChatGPT — to be
filled in as development proceeds].

## Status

- [x] Module 1: Project scaffolding + Prisma schema (core entities)
- [x] Module 2: Authentication
- [ ] Module 3: Groups + dynamic membership
- [ ] Module 4: Expenses + splits
- [ ] Module 5: CSV import engine
- [ ] Module 6: Balance calculation engine
- [ ] Module 7: Settlements
- [ ] Module 8: Audit log

## Authentication

- Registration: open (any email can register), email + password (min 8
  chars) + display name.
- Sessions: JWT signed with `JWT_SECRET`, stored in an httpOnly cookie
  (`token`), 7-day expiry. The frontend never reads the token directly —
  it calls `GET /api/auth/me` to determine the current user.
- Endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
  `POST /api/auth/logout`, `GET /api/auth/me`.
