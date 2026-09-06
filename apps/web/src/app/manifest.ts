import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Roamly Trip Planner',
    short_name: 'Roamly',
    description: 'Build a thoughtful day trip around the places you love.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3eb',
    theme_color: '#f7f3eb',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
