import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ambient.css';
import './tutorial.css';
import { AuthProvider } from '@/lib/authContext';
import { ToastHost } from '@/components/atlas/ToastHost';

export const metadata: Metadata = {
  title: { default: 'ATLAS ERP', template: '%s | ATLAS ERP' },
  description: 'Plataforma operacional y financiera ATLAS.',
};

/**
 * El App Router ya emite `width=device-width, initial-scale=1`; lo que se añade
 * aquí es `viewport-fit=cover`, para que las barras fija y lateral puedan
 * respetar las zonas seguras del móvil en lugar de quedar bajo el notch.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-BO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0,0&display=swap" rel="stylesheet" />
      </head>
      <body><AuthProvider>{children}</AuthProvider><ToastHost /></body>
    </html>
  );
}
