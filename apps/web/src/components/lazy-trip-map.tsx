'use client';

import dynamic from 'next/dynamic';

export const LazyTripMap = dynamic(() => import('./trip-map'), {
  ssr: false,
  loading: () => <div className="map-loading">Loading interactive map…</div>,
});
