import { describe, expect, it } from 'vitest';

import RootLayout from './layout';

describe('RootLayout', () => {
  it('tolerates browser extensions adding attributes to the root element', () => {
    const layout = RootLayout({ children: <main /> });

    expect(layout.props).toMatchObject({
      lang: 'en',
      suppressHydrationWarning: true,
    });
  });
});
