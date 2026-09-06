import { describe, expect, it } from 'vitest';

import {
  addCategory,
  addTripPoint,
  deleteCategory,
  getTripEditorData,
  updateCategory,
} from './trip-editor-store';

describe('category lifecycle', () => {
  it('seeds defaults as records and creates, renames, orders, and deletes categories', () => {
    const tripId = crypto.randomUUID();
    const data = getTripEditorData(tripId);
    expect(data.categories.map(({ name }) => name)).toEqual([
      'Uncategorized',
      'Food',
      'Culture',
      'Outdoors',
      'Stay',
    ]);

    const category = addCategory(tripId, {
      name: 'Shopping',
      color: '#aabbcc',
      icon: 'pin',
    });
    const point = addTripPoint(tripId, {
      name: 'Market',
      address: 'Market street',
      latitude: 1,
      longitude: 2,
      categoryId: category.id,
    });
    expect(
      updateCategory(tripId, category.id, { name: 'Shops', position: 1 }),
    ).toMatchObject({ name: 'Shops', position: 1 });
    expect(deleteCategory(tripId, category.id)).toBe(true);
    expect(data.points.find(({ id }) => id === point.id)?.categoryId).toBe(
      `${tripId}-uncategorized`,
    );
    expect(data.categories.some(({ id }) => id === category.id)).toBe(false);
  });

  it('protects Uncategorized and rejects an invalid replacement', () => {
    const tripId = crypto.randomUUID();
    const category = addCategory(tripId, {
      name: 'Nightlife',
      color: '#112233',
      icon: 'pin',
    });
    expect(deleteCategory(tripId, `${tripId}-uncategorized`)).toBe(false);
    expect(deleteCategory(tripId, category.id, 'missing')).toBe(false);
  });
});
