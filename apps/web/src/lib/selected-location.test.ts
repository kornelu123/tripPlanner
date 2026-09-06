import { describe, expect, it } from 'vitest';
import { selectLocation } from './selected-location';

describe('selected location state', () => {
  it('keeps exactly one selection as interfaces replace one another', () => {
    const first = selectLocation(
      { id: null, source: null },
      'one',
      'itinerary',
    );
    expect(selectLocation(first, 'two', 'marker')).toEqual({
      id: 'two',
      source: 'marker',
    });
  });
});
