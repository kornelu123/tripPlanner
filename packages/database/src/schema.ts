import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('trips_created_at_idx').on(table.createdAt)],
);
