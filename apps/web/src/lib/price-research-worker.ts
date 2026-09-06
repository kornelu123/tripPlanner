import type { PriceResearchProvider } from '@trip-planner/domain';
import { PriceResearchService } from '@trip-planner/domain';

import { findTripPoint, getTripEditorData } from './trip-editor-store';

let providers: PriceResearchProvider[] = [];

export function setPriceResearchProviders(value: PriceResearchProvider[]) {
  providers = value;
}

export function enqueuePriceResearch(tripId: string, pointId: string) {
  const point = findTripPoint(tripId, pointId);
  if (!point) return false;
  point.price = { status: 'loading' };
  queueMicrotask(async () => {
    const current = findTripPoint(tripId, pointId);
    if (!current) return;
    try {
      const category =
        getTripEditorData(tripId).categories.find(
          ({ id }) => id === current.categoryId,
        )?.name ?? 'Uncategorized';
      const value = await new PriceResearchService(providers).research({
        placeName: current.name,
        category,
        coordinates: {
          latitude: current.latitude,
          longitude: current.longitude,
        },
        formattedAddress: current.address,
        currency: 'EUR',
        country: 'PT',
      });
      current.price = value
        ? {
            status: 'success',
            priceLevel: value.priceLevel,
            minimumAmount: value.minimumAmount,
            maximumAmount: value.maximumAmount,
            currency: value.currency,
            unit: value.unit,
            sources: (
              value.sources ?? [
                {
                  url: value.sourceUrl,
                  type: value.sourceType,
                  retrievedAt: value.retrievedAt,
                },
              ]
            ).map(({ url, type }) => ({ url, type })),
            confidence: value.confidence,
            lastCheckedAt: value.retrievedAt.toISOString(),
          }
        : { status: 'unavailable', lastCheckedAt: new Date().toISOString() };
    } catch {
      current.price = {
        status: 'unavailable',
        lastCheckedAt: new Date().toISOString(),
      };
    }
  });
  return true;
}
