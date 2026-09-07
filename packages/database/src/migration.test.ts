import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function readMigrations() {
  const names = [
    '0000_enable_postgis_and_create_trips.sql',
    '0001_create_trip_planning_schema.sql',
    '0004_add_authentication.sql',
    '0006_add_place_price_estimates.sql',
    '0007_add_password_authentication.sql',
  ];
  const migrations = await Promise.all(
    names.map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
    ),
  );
  return migrations.join('\n');
}

describe('database migration', () => {
  it('defines every trip-planning table and the PostGIS index', async () => {
    const migration = await readMigrations();

    for (const table of [
      'users',
      'trips',
      'memberships',
      'places',
      'trip_points',
      'categories',
      'routes',
      'route_legs',
      'social_imports',
      'passkey_credentials',
      'auth_challenges',
      'sessions',
      'apple_accounts',
      'place_price_estimates',
    ]) {
      expect(migration).toMatch(
        new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"${table}"`),
      );
    }

    expect(migration).toContain('geography(Point,4326)');
    expect(migration).toContain(
      'CREATE INDEX "places_coordinates_gist_idx" ON "places" USING gist',
    );
    expect(migration).toContain('ADD COLUMN "password_hash" text');
  });

  it('enables trip-scoped row-level security', async () => {
    const migration = await readMigrations();

    expect(migration).toContain('CREATE FUNCTION can_read_trip');
    expect(migration).toContain('CREATE FUNCTION can_edit_trip');
    expect(migration).toContain(
      'CREATE POLICY "trip_points_write" ON "trip_points"',
    );
    expect(migration).toContain(
      'CREATE POLICY "social_imports_read" ON "social_imports"',
    );
  });
});
