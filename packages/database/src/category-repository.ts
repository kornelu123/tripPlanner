import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

const defaultCategories = [
  { name: 'Uncategorized', color: '#687c76', icon: 'pin' },
  { name: 'Food', color: '#dc6941', icon: 'fork-knife' },
  { name: 'Culture', color: '#735da5', icon: 'landmark' },
  { name: 'Outdoors', color: '#397a65', icon: 'tree' },
  { name: 'Stay', color: '#3573a5', icon: 'bed' },
] as const;

function canEditCategory(userId: string, categoryId: string) {
  return and(
    eq(schema.categories.id, categoryId),
    or(
      eq(schema.categories.userId, userId),
      sql`${schema.categories.tripId} IN (
        SELECT ${schema.trips.id} FROM ${schema.trips}
        WHERE ${schema.trips.ownerId} = ${userId} OR EXISTS (
          SELECT 1 FROM ${schema.memberships}
          WHERE ${schema.memberships.tripId} = ${schema.trips.id}
            AND ${schema.memberships.userId} = ${userId}
            AND ${schema.memberships.role} = 'editor'
        )
      )`,
    ),
  );
}

export function createCategoryRepository(database: Database) {
  return {
    async seedDefaults(userId: string) {
      const existing = await database
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.userId, userId))
        .limit(1);
      if (existing.length) return [];
      return database
        .insert(schema.categories)
        .values(
          defaultCategories.map((category, position) => ({
            ...category,
            userId,
            position,
          })),
        )
        .returning();
    },

    list(userId: string, tripId: string) {
      return database
        .select()
        .from(schema.categories)
        .where(
          or(
            eq(schema.categories.userId, userId),
            eq(schema.categories.tripId, tripId),
          ),
        )
        .orderBy(asc(schema.categories.position));
    },

    async create(
      userId: string,
      tripId: string,
      input: { name: string; color: string; icon: string },
    ) {
      const [trip] = await database
        .select({ id: schema.trips.id })
        .from(schema.trips)
        .where(
          and(
            eq(schema.trips.id, tripId),
            or(
              eq(schema.trips.ownerId, userId),
              sql`EXISTS (SELECT 1 FROM ${schema.memberships} WHERE ${schema.memberships.tripId} = ${tripId} AND ${schema.memberships.userId} = ${userId} AND ${schema.memberships.role} = 'editor')`,
            ),
          ),
        );
      if (!trip) return undefined;
      const positions = await database
        .select({
          next: sql<number>`coalesce(max(${schema.categories.position}), -1) + 1`,
        })
        .from(schema.categories)
        .where(eq(schema.categories.tripId, tripId));
      const [category] = await database
        .insert(schema.categories)
        .values({ ...input, tripId, position: Number(positions[0]?.next ?? 0) })
        .returning();
      return category;
    },

    async update(
      userId: string,
      categoryId: string,
      update: Partial<
        Pick<
          typeof schema.categories.$inferInsert,
          'name' | 'color' | 'icon' | 'position'
        >
      >,
    ) {
      const [category] = await database
        .update(schema.categories)
        .set({ ...update, updatedAt: new Date() })
        .where(canEditCategory(userId, categoryId))
        .returning();
      return category;
    },

    async delete(userId: string, categoryId: string, replacementId?: string) {
      return database.transaction(async (transaction) => {
        const [category] = await transaction
          .select()
          .from(schema.categories)
          .where(canEditCategory(userId, categoryId));
        if (!category || category.name === 'Uncategorized') return undefined;
        const [replacement] = replacementId
          ? await transaction
              .select()
              .from(schema.categories)
              .where(canEditCategory(userId, replacementId))
          : await transaction
              .select()
              .from(schema.categories)
              .where(
                and(
                  eq(schema.categories.userId, userId),
                  eq(schema.categories.name, 'Uncategorized'),
                ),
              );
        if (!replacement || replacement.id === categoryId) return undefined;
        await transaction
          .update(schema.tripPoints)
          .set({ categoryId: replacement.id, updatedAt: new Date() })
          .where(eq(schema.tripPoints.categoryId, categoryId));
        const [deleted] = await transaction
          .delete(schema.categories)
          .where(canEditCategory(userId, categoryId))
          .returning();
        return deleted;
      });
    },
  };
}
