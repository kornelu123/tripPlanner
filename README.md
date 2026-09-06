# Trip Planner

A pnpm workspace for an installable trip-planning web application. The repository keeps the web delivery layer, infrastructure clients, provider-neutral domain contracts, and shared configuration separate.

## Prerequisites

- Node.js 22 or later
- pnpm 10
- PostgreSQL 16 with PostGIS 3.4
- Redis 7

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template and adjust values if your services use different credentials:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL/PostGIS and Redis:

   ```bash
   docker compose up -d
   ```

4. Apply database migrations and run the application:

   ```bash
   pnpm db:migrate
   pnpm dev
   ```

Open <http://localhost:3000>. The health endpoint is available at <http://localhost:3000/api/health> and returns HTTP 200 only when PostgreSQL and Redis respond.

## Environment variables

| Variable                                                                | Required   | Purpose                                                     | Example                                                              |
| ----------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                                                          | Yes        | PostgreSQL/PostGIS connection string                        | `postgresql://trip_planner:trip_planner@localhost:5432/trip_planner` |
| `REDIS_URL`                                                             | Yes        | Redis connection string                                     | `redis://localhost:6379`                                             |
| `APP_URL`                                                               | Production | Canonical HTTPS origin and WebAuthn origin                  | `https://trips.example.com`                                          |
| `WEBAUTHN_RP_ID`                                                        | Production | Passkey relying-party ID; must equal the `APP_URL` hostname | `trips.example.com`                                                  |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | For Apple  | Apple Services ID and signing credentials                   | —                                                                    |
| `SMTP_URL`, `EMAIL_FROM`                                                | Production | Magic-link SMTP transport and sender                        | —                                                                    |

Environment values are validated when an infrastructure client is first requested. Do not expose either variable through a `NEXT_PUBLIC_` prefix.
Authentication records, challenges, and sessions are stored in PostgreSQL. Set `APP_URL` to the canonical production origin: builds fail closed rather than allowing passkeys to bind to `localhost`, and the relying-party ID must match that origin's hostname.

## Commands

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Run the Next.js development server           |
| `pnpm build`        | Build all workspace packages and the web app |
| `pnpm lint`         | Run ESLint                                   |
| `pnpm typecheck`    | Type-check every workspace package           |
| `pnpm test`         | Run unit tests                               |
| `pnpm test:e2e`     | Run Playwright browser tests                 |
| `pnpm format`       | Format supported files with Prettier         |
| `pnpm format:check` | Check formatting without changing files      |
| `pnpm db:generate`  | Generate migrations from the Drizzle schema  |
| `pnpm db:migrate`   | Apply committed migrations                   |

See [docs/architecture.md](docs/architecture.md) for package boundaries and provider decisions.
