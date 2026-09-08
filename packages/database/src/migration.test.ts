import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function readMigrations() {
  const names = (await readdir(new URL('../migrations', import.meta.url)))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const migrations = await Promise.all(
    names.map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
    ),
  );
  return migrations.join('\n');
}

describe('database migration', () => {
  it('registers every SQL migration in the Drizzle journal', async () => {
    const names = (await readdir(new URL('../migrations', import.meta.url)))
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => name.replace(/\.sql$/, ''));
    const journal = JSON.parse(
      await readFile(
        new URL('../migrations/meta/_journal.json', import.meta.url),
        'utf8',
      ),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.map(({ tag }) => tag)).toEqual(names);
  });

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
