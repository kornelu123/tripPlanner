import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const geographyPoint = customType<{
  data: Coordinates;
  driverData: string;
}>({
  dataType() {
    return 'geography(Point,4326)';
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('trips_owner_id_idx').on(table.ownerId),
    index('trips_created_at_idx').on(table.createdAt),
  ],
);

export const memberships = pgTable(
  'memberships',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    index('memberships_user_id_idx').on(table.userId),
    check('memberships_role_check', sql`${table.role} IN ('editor', 'viewer')`),
  ],
);

export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    normalizedAddress: text('normalized_address').notNull(),
    providerId: varchar('provider_id', { length: 255 }),
    displayName: varchar('display_name', { length: 300 }).notNull(),
    coordinates: geographyPoint('coordinates').notNull(),
    sourcePlatform: varchar('source_platform', { length: 50 }),
    sourceUrl: text('source_url'),
    ...timestamps,
  },
  (table) => [
    index('places_coordinates_gist_idx').using('gist', table.coordinates),
    uniqueIndex('places_provider_id_idx')
      .on(table.sourcePlatform, table.providerId)
      .where(sql`${table.providerId} IS NOT NULL`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 32 }).notNull(),
    icon: varchar('icon', { length: 100 }).notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [
    index('categories_user_id_idx').on(table.userId),
    index('categories_trip_id_idx').on(table.tripId),
    check(
      'categories_one_owner_check',
      sql`(${table.userId} IS NOT NULL) <> (${table.tripId} IS NOT NULL)`,
    ),
    check('categories_position_check', sql`${table.position} >= 0`),
  ],
);

export const tripPoints = pgTable(
  'trip_points',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    plannedArrival: timestamp('planned_arrival', { withTimezone: true }),
    durationMinutes: integer('duration_minutes'),
    status: varchar('status', { length: 20 }).default('planned').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('trip_points_trip_position_idx').on(
      table.tripId,
      table.position,
    ),
    index('trip_points_category_id_idx').on(table.categoryId),
    check('trip_points_position_check', sql`${table.position} >= 0`),
    check(
      'trip_points_duration_check',
      sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} >= 0`,
    ),
    check(
      'trip_points_status_check',
      sql`${table.status} IN ('planned', 'visited', 'skipped')`,
    ),
  ],
);

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 255 }),
    mode: varchar('mode', { length: 20 }).notNull(),
    distanceMeters: integer('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    ...timestamps,
  },
  (table) => [index('routes_trip_id_idx').on(table.tripId)],
);

export const routeLegs = pgTable(
  'route_legs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    fromTripPointId: uuid('from_trip_point_id').references(
      () => tripPoints.id,
      { onDelete: 'set null' },
    ),
    toTripPointId: uuid('to_trip_point_id').references(() => tripPoints.id, {
      onDelete: 'set null',
    }),
    position: integer('position').notNull(),
    distanceMeters: integer('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    geometry: jsonb('geometry'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('route_legs_route_position_idx').on(
      table.routeId,
      table.position,
    ),
  ],
);

export const socialImports = pgTable(
  'social_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    importedByUserId: uuid('imported_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    platform: varchar('platform', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    sourceUrl: text('source_url').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('social_imports_platform_external_id_idx').on(
      table.platform,
      table.externalId,
    ),
    index('social_imports_trip_id_idx').on(table.tripId),
  ],
);
