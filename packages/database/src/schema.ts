import { sql } from 'drizzle-orm';
import {
  check,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
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

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
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
    passwordHash: text('password_hash'),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const passkeyCredentials = pgTable(
  'passkey_credentials',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: bytea('public_key').notNull(),
    counter: integer('counter').default(0).notNull(),
    transports: jsonb('transports').$type<string[]>().default([]).notNull(),
    deviceType: varchar('device_type', { length: 32 }).notNull(),
    backedUp: boolean('backed_up').default(false).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('passkeys_user_id_idx').on(table.userId)],
);

export const authChallenges = pgTable('auth_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 32 }).notNull(),
  challengeHash: varchar('challenge_hash', { length: 64 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamps.createdAt,
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

export const appleAccounts = pgTable(
  'apple_accounts',
  {
    subject: varchar('subject', { length: 255 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }),
    isPrivateRelay: boolean('is_private_relay').default(false).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex('apple_accounts_user_id_idx').on(table.userId)],
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

export interface StoredPriceSource {
  url: string;
  type: string;
  retrievedAt: string;
}

export const placePriceEstimates = pgTable('place_price_estimates', {
  placeId: uuid('place_id')
    .primaryKey()
    .references(() => places.id, { onDelete: 'cascade' }),
  priceLevel: varchar('price_level', { length: 20 }).notNull(),
  minimumAmount: numeric('minimum_amount', { precision: 12, scale: 2 }),
  maximumAmount: numeric('maximum_amount', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull(),
  unit: varchar('unit', { length: 30 }).notNull(),
  sources: jsonb('sources').$type<StoredPriceSource[]>().default([]).notNull(),
  admissionPrices: jsonb('admission_prices').default([]).notNull(),
  originalAmounts: jsonb('original_amounts'),
  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }).notNull(),
  updatedAt: timestamps.updatedAt,
});

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
    roundTrip: boolean('round_trip').default(false).notNull(),
    fixedStartTripPointId: uuid('fixed_start_trip_point_id').references(
      () => tripPoints.id,
      { onDelete: 'set null' },
    ),
    fixedEndTripPointId: uuid('fixed_end_trip_point_id').references(
      () => tripPoints.id,
      { onDelete: 'set null' },
    ),
    pointOrder: jsonb('point_order').$type<string[]>().default([]).notNull(),
    optimizationMethod: varchar('optimization_method', { length: 20 })
      .default('manual')
      .notNull(),
    providerMetadata: jsonb('provider_metadata')
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    distanceMeters: integer('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    ...timestamps,
  },
  (table) => [
    index('routes_trip_id_idx').on(table.tripId),
    check('routes_mode_check', sql`${table.mode} IN ('driving', 'walking')`),
    check(
      'routes_optimization_method_check',
      sql`${table.optimizationMethod} IN ('exact', 'heuristic', 'manual')`,
    ),
  ],
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

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    subjectId: uuid('subject_id'),
    action: varchar('action', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('audit_events_created_at_idx').on(table.createdAt)],
);
