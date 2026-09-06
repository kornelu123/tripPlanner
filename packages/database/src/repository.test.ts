import { readFile } from 'node:fs/promises';

import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTripRepository } from './repository';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_TEST_URL;
const integration = databaseUrl ? describe : describe.skip;
const namespace = `trip_planner_test_${process.pid}`;
let pool: Pool;
let database: NodePgDatabase<typeof schema>;

integration('trip repository', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`CREATE SCHEMA "${namespace}"`);
    await pool.query(`SET search_path TO "${namespace}", public`);
    for (const name of [
      '0000_enable_postgis_and_create_trips.sql',
      '0001_create_trip_planning_schema.sql',
    ]) {
      const migration = await readFile(
        new URL(`../migrations/${name}`, import.meta.url),
        'utf8',
      );
      await pool.query(migration.replaceAll('--> statement-breakpoint', ''));
    }
    database = drizzle(pool, { schema });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await pool.end();
  });

  it('orders trip points by position and preserves coordinates', async () => {
    const [owner] = await database
      .insert(schema.users)
      .values({ email: 'owner@example.com', displayName: 'Owner' })
      .returning();
    const [trip] = await database
      .insert(schema.trips)
      .values({ ownerId: owner!.id, name: 'Lisbon' })
      .returning();
    const insertedPlaces = await database
      .insert(schema.places)
      .values([
        {
          normalizedAddress: 'praca do comercio lisboa portugal',
          displayName: 'Praça do Comércio',
          coordinates: { latitude: 38.70775, longitude: -9.13659 },
        },
        {
          normalizedAddress: 'castelo de sao jorge lisboa portugal',
          displayName: 'Castelo de São Jorge',
          coordinates: { latitude: 38.71391, longitude: -9.13348 },
        },
      ])
      .returning();
    await database.insert(schema.tripPoints).values([
      { tripId: trip!.id, placeId: insertedPlaces[0]!.id, position: 2 },
      { tripId: trip!.id, placeId: insertedPlaces[1]!.id, position: 1 },
    ]);

    const points = await createTripRepository(database).listTripPoints(
      owner!.id,
      trip!.id,
    );
    expect(points.map(({ tripPoint }) => tripPoint.position)).toEqual([1, 2]);

    const coordinates = await pool.query<{
      latitude: number;
      longitude: number;
    }>(
      `SELECT ST_Y(coordinates::geometry) AS latitude,
              ST_X(coordinates::geometry) AS longitude
       FROM "${namespace}".places WHERE id = $1`,
      [insertedPlaces[0]!.id],
    );
    expect(Number(coordinates.rows[0]!.latitude)).toBeCloseTo(38.70775, 5);
    expect(Number(coordinates.rows[0]!.longitude)).toBeCloseTo(-9.13659, 5);
  });

  it('enforces owner, editor, viewer, and unrelated-user permissions', async () => {
    const people = await database
      .insert(schema.users)
      .values([
        { email: 'owner2@example.com', displayName: 'Owner' },
        { email: 'editor@example.com', displayName: 'Editor' },
        { email: 'viewer@example.com', displayName: 'Viewer' },
        { email: 'stranger@example.com', displayName: 'Stranger' },
      ])
      .returning();
    const [owner, editor, viewer, stranger] = people;
    const [trip] = await database
      .insert(schema.trips)
      .values({ ownerId: owner!.id, name: 'Private trip' })
      .returning();
    const repository = createTripRepository(database);
    await repository.addMember(owner!.id, trip!.id, editor!.id, 'editor');
    await repository.addMember(owner!.id, trip!.id, viewer!.id, 'viewer');

    expect(await repository.getTrip(editor!.id, trip!.id)).toBeDefined();
    expect(await repository.getTrip(viewer!.id, trip!.id)).toBeDefined();
    expect(await repository.getTrip(stranger!.id, trip!.id)).toBeUndefined();
    expect(
      await repository.renameTrip(editor!.id, trip!.id, 'Edited trip'),
    ).toBeDefined();
    expect(
      await repository.renameTrip(viewer!.id, trip!.id, 'Forbidden'),
    ).toBeUndefined();
    expect(await repository.deleteTrip(editor!.id, trip!.id)).toBeUndefined();
  });

  it('cascades trip data, nulls deleted categories, and retains places', async () => {
    const [owner] = await database
      .insert(schema.users)
      .values({ email: 'delete@example.com', displayName: 'Owner' })
      .returning();
    const [trip] = await database
      .insert(schema.trips)
      .values({ ownerId: owner!.id, name: 'Delete me' })
      .returning();
    const [place] = await database
      .insert(schema.places)
      .values({
        normalizedAddress: 'test address',
        displayName: 'Test place',
        coordinates: { latitude: 1, longitude: 2 },
      })
      .returning();
    const [category] = await database
      .insert(schema.categories)
      .values({ tripId: trip!.id, name: 'Food', color: '#fff', icon: 'food' })
      .returning();
    const [point] = await database
      .insert(schema.tripPoints)
      .values({
        tripId: trip!.id,
        placeId: place!.id,
        categoryId: category!.id,
        position: 0,
      })
      .returning();

    await database.delete(schema.categories);
    const categoryResult = await pool.query(
      `SELECT category_id FROM "${namespace}".trip_points WHERE id = $1`,
      [point!.id],
    );
    expect(categoryResult.rows[0].category_id).toBeNull();

    await createTripRepository(database).deleteTrip(owner!.id, trip!.id);
    const pointCount = await pool.query(
      `SELECT count(*)::int AS count FROM "${namespace}".trip_points WHERE trip_id = $1`,
      [trip!.id],
    );
    const placeCount = await pool.query(
      `SELECT count(*)::int AS count FROM "${namespace}".places WHERE id = $1`,
      [place!.id],
    );
    expect(pointCount.rows[0].count).toBe(0);
    expect(placeCount.rows[0].count).toBe(1);
  });
});
