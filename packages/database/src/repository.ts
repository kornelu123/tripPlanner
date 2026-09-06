import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';
import { createCategoryRepository } from './category-repository';

type Database = NodePgDatabase<typeof schema>;
type MembershipRole = 'editor' | 'viewer';

function canReadTrip(userId: string) {
  return or(
    eq(schema.trips.ownerId, userId),
    sql`exists (
          select 1 from ${schema.memberships}
          where ${schema.memberships.tripId} = ${schema.trips.id}
            and ${schema.memberships.userId} = ${userId}
        )`,
  );
}

function canEditTrip(userId: string) {
  return or(
    eq(schema.trips.ownerId, userId),
    sql`exists (
          select 1 from ${schema.memberships}
          where ${schema.memberships.tripId} = ${schema.trips.id}
            and ${schema.memberships.userId} = ${userId}
            and ${schema.memberships.role} = 'editor'
        )`,
  );
}

export function createTripRepository(database: Database) {
  return {
    async createTrip(userId: string, name: string) {
      return database.transaction(async (transaction) => {
        const [trip] = await transaction
          .insert(schema.trips)
          .values({ ownerId: userId, name })
          .returning();
        await createCategoryRepository(transaction).seedDefaults(userId);
        return trip;
      });
    },
    async getTrip(userId: string, tripId: string) {
      const [trip] = await database
        .select()
        .from(schema.trips)
        .where(and(eq(schema.trips.id, tripId), canReadTrip(userId)))
        .limit(1);
      return trip;
    },

    async listTripPoints(userId: string, tripId: string) {
      return database
        .select({ tripPoint: schema.tripPoints, place: schema.places })
        .from(schema.tripPoints)
        .innerJoin(schema.trips, eq(schema.trips.id, schema.tripPoints.tripId))
        .innerJoin(
          schema.places,
          eq(schema.places.id, schema.tripPoints.placeId),
        )
        .where(and(eq(schema.tripPoints.tripId, tripId), canReadTrip(userId)))
        .orderBy(asc(schema.tripPoints.position));
    },

    async renameTrip(userId: string, tripId: string, name: string) {
      const [trip] = await database
        .update(schema.trips)
        .set({ name, updatedAt: new Date() })
        .where(and(eq(schema.trips.id, tripId), canEditTrip(userId)))
        .returning();
      return trip;
    },

    async deleteTrip(userId: string, tripId: string) {
      const [trip] = await database
        .delete(schema.trips)
        .where(
          and(eq(schema.trips.id, tripId), eq(schema.trips.ownerId, userId)),
        )
        .returning();
      return trip;
    },

    async addMember(
      ownerId: string,
      tripId: string,
      userId: string,
      role: MembershipRole,
    ) {
      const [ownedTrip] = await database
        .select({ id: schema.trips.id })
        .from(schema.trips)
        .where(
          and(eq(schema.trips.id, tripId), eq(schema.trips.ownerId, ownerId)),
        )
        .limit(1);

      if (!ownedTrip) return undefined;

      const [membership] = await database
        .insert(schema.memberships)
        .values({ tripId, userId, role })
        .returning();
      return membership;
    },
  };
}
