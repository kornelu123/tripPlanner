import type { Metadata, Viewport } from 'next';

import { ServiceWorkerRegistration } from '../components/service-worker-registration';

import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';

export const metadata: Metadata = {
  title: 'Roamly — Plan a day worth remembering',
  description: 'Build a thoughtful day trip around the places you love.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roamly',
  },
  icons: {
    icon: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#f7f3eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
