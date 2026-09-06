import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

export interface SavedPriceEstimate {
  placeId: string;
  priceLevel: string;
  minimumAmount?: number;
  maximumAmount?: number;
  currency: string;
  unit: string;
  sources: schema.StoredPriceSource[];
  admissionPrices?: unknown[];
  originalAmounts?: unknown;
  confidence: number;
  lastCheckedAt: Date;
}

export function createPriceRepository(database: Database) {
  return {
    async save(input: SavedPriceEstimate) {
      const values = {
        ...input,
        minimumAmount: input.minimumAmount?.toFixed(2),
        maximumAmount: input.maximumAmount?.toFixed(2),
        confidence: input.confidence.toFixed(3),
      };
      const [estimate] = await database
        .insert(schema.placePriceEstimates)
        .values(values)
        .onConflictDoUpdate({
          target: schema.placePriceEstimates.placeId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      return estimate;
    },
    async get(placeId: string) {
      const [estimate] = await database
        .select()
        .from(schema.placePriceEstimates)
        .where(eq(schema.placePriceEstimates.placeId, placeId))
        .limit(1);
      return estimate;
    },
    async delete(placeId: string) {
      const [estimate] = await database
        .delete(schema.placePriceEstimates)
        .where(eq(schema.placePriceEstimates.placeId, placeId))
        .returning();
      return estimate;
    },
  };
}
