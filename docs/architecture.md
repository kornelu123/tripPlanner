# Architecture

## Workspace boundaries

- `apps/web` owns HTTP delivery, rendering, PWA metadata, and service-worker registration. It may compose domain contracts with infrastructure implementations, but domain behavior must not depend on Next.js.
- `packages/domain` contains provider-neutral types and interfaces for routing, geocoding, and social platforms. Application code depends on these ports rather than vendor SDKs.
- `packages/database` owns PostgreSQL/PostGIS and Redis clients, the Drizzle schema, and SQL migrations.
- `packages/config` validates server-side environment variables and is the only place that reads infrastructure configuration from `process.env`.

Dependencies point inward: the web and database packages may depend on domain or configuration packages; domain has no infrastructure dependency.

## Provider boundaries

`RoutingProvider`, `GeocodingProvider`, and `SocialPlatformProvider` describe the inputs and outputs the application needs. A provider integration should implement one of these interfaces in an outer package or the web application. This avoids leaking vendor response types, credentials, or SDK behavior into trip-planning logic and allows a provider to be replaced without changing consumers.

## Persistence

PostgreSQL is the source of truth. PostGIS is enabled by the first migration so future itinerary data can use geographic indexes and functions. Drizzle owns schema declarations and migration generation; committed SQL migrations are applied with `pnpm db:migrate`. Redis is reserved for ephemeral caching and coordination, not durable trip state.

Both clients are initialized lazily and cached for the Node.js process. This keeps builds independent of running services and prevents creating a connection per request.

## Health checks

`GET /api/health` checks PostgreSQL with `SELECT 1` and Redis with `PING`. It returns `200` with an `ok` status only when both dependencies respond, otherwise `503` with per-service status. Error details are intentionally omitted to avoid leaking connection information.

## PWA

The web app supplies a web manifest, scalable standard and maskable icons, responsive application-shell styling, and a small same-origin service worker. The text-based SVG icons keep repository patches portable while remaining resolution-independent. The service worker caches the shell after a successful request and falls back to it for offline navigation. API responses are never cached.
