import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('web manifest', () => {
  it('provides standalone metadata and install icons', () => {
    const metadata = manifest();

    expect(metadata.display).toBe('standalone');
    expect(metadata.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        }),
        expect.objectContaining({
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
