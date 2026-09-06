import { readFile } from 'node:fs/promises';

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTripRepository } from './repository';
import { createCategoryRepository } from './category-repository';
import { createPriceRepository } from './price-repository';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_TEST_URL;
const integration = databaseUrl ? describe : describe.skip;
let pool: Pool;
let database: NodePgDatabase<typeof schema>;

integration('trip repository', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    for (const name of [
      '0000_enable_postgis_and_create_trips.sql',
      '0001_create_trip_planning_schema.sql',
      '0002_add_category_order.sql',
      '0003_persist_route_plans.sql',
      '0006_add_place_price_estimates.sql',
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
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
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
       FROM places WHERE id = $1`,
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
      .values({
        tripId: trip!.id,
        name: 'Food',
        color: '#ffffff',
        icon: 'food',
        position: 0,
      })
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
      'SELECT category_id FROM trip_points WHERE id = $1',
      [point!.id],
    );
    expect(categoryResult.rows[0].category_id).toBeNull();

    await createTripRepository(database).deleteTrip(owner!.id, trip!.id);
    const pointCount = await pool.query(
      'SELECT count(*)::int AS count FROM trip_points WHERE trip_id = $1',
      [trip!.id],
    );
    const placeCount = await pool.query(
      'SELECT count(*)::int AS count FROM places WHERE id = $1',
      [place!.id],
    );
    expect(pointCount.rows[0].count).toBe(0);
    expect(placeCount.rows[0].count).toBe(1);
  });

  it('seeds ordinary default rows once and enforces category mutation ownership', async () => {
    const [owner, stranger] = await database
      .insert(schema.users)
      .values([
        { email: 'category-owner@example.com', displayName: 'Category owner' },
        { email: 'category-stranger@example.com', displayName: 'Stranger' },
      ])
      .returning();
    const tripsRepository = createTripRepository(database);
    const firstTrip = await tripsRepository.createTrip(owner!.id, 'First');
    await tripsRepository.createTrip(owner!.id, 'Second');
    const repository = createCategoryRepository(database);
    const defaults = await repository.list(owner!.id, firstTrip!.id);
    expect(defaults.map(({ name }) => name)).toEqual([
      'Uncategorized',
      'Food',
      'Culture',
      'Outdoors',
      'Stay',
    ]);

    const category = await repository.create(owner!.id, firstTrip!.id, {
      name: 'Shopping',
      color: '#aabbcc',
      icon: 'pin',
    });
    expect(category).toBeDefined();
    expect(
      await repository.update(stranger!.id, category!.id, { name: 'Stolen' }),
    ).toBeUndefined();
    expect(
      await repository.update(owner!.id, category!.id, { name: 'Shops' }),
    ).toMatchObject({ name: 'Shops' });

    const [place] = await database
      .insert(schema.places)
      .values({
        normalizedAddress: 'market',
        displayName: 'Market',
        coordinates: { latitude: 1, longitude: 2 },
      })
      .returning();
    const [point] = await database
      .insert(schema.tripPoints)
      .values({
        tripId: firstTrip!.id,
        placeId: place!.id,
        categoryId: category!.id,
        position: 0,
      })
      .returning();
    expect(await repository.delete(owner!.id, category!.id)).toBeDefined();
    const [reassigned] = await database
      .select()
      .from(schema.tripPoints)
      .where(eq(schema.tripPoints.id, point!.id));
    expect(reassigned!.categoryId).toBe(defaults[0]!.id);
  });

  it('saves price provenance, timestamps, units, and cascades with its place', async () => {
    const [place] = await database
      .insert(schema.places)
      .values({
        normalizedAddress: 'price fixture',
        displayName: 'Price fixture',
        coordinates: { latitude: 1, longitude: 2 },
      })
      .returning();
    const repository = createPriceRepository(database);
    const checkedAt = new Date('2026-09-06T10:00:00Z');
    await repository.save({
      placeId: place!.id,
      priceLevel: 'moderate',
      minimumAmount: 12,
      maximumAmount: 25,
      currency: 'EUR',
      unit: 'typical_meal',
      sources: [
        {
          url: 'https://official.example/menu',
          type: 'official_structured_data',
          retrievedAt: checkedAt.toISOString(),
        },
      ],
      admissionPrices: [],
      confidence: 0.82,
      lastCheckedAt: checkedAt,
    });
    expect(await repository.get(place!.id)).toMatchObject({
      currency: 'EUR',
      unit: 'typical_meal',
      sources: [
        expect.objectContaining({ url: 'https://official.example/menu' }),
      ],
      lastCheckedAt: checkedAt,
    });
    await database.delete(schema.places).where(eq(schema.places.id, place!.id));
    expect(await repository.get(place!.id)).toBeUndefined();
  });
});
