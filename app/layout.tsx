import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import './tema.css';
import './globals.css';
import './tutorial.css';
import { AuthProvider } from '@/lib/authContext';
import { ToastHost } from '@/components/atlas/ToastHost';
import { CierrePorInactividad } from '@/components/layout/CierrePorInactividad';
import { SCRIPT_DE_TEMA } from '@/lib/tema';

// El CSP usa un nonce nuevo por petición; el HTML debe generarse con ese nonce.
export const dynamic = 'force-dynamic';

/*
 * Outfit, autoalojada con `next/font/local`: los archivos viven en `app/fuentes/` y se sirven desde
 * `/_next/static`, así que ni el navegador ni el constructor piden nada a Google por la tipografía
 * (con `next/font/google` el CI falló de forma intermitente al descargarla). El subconjunto latino cubre el español. Sólo 400,
 * 500 y 600 (la identidad no usa más peso). La monoespaciada es para identificadores y código.
 */
const outfit = localFont({ src: './fuentes/outfit-latin.woff2', weight: '400 600', display: 'swap', variable: '--font-sans' });
const mono = localFont({ src: './fuentes/jbmono-latin.woff2', weight: '400 500', display: 'swap', variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'Cuotea ERP', template: '%s | Cuotea ERP' },
  description: 'Plataforma operacional y financiera de Cuotea.',
  // El isotipo de Cuotea, servido desde `public/`.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
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
  themeColor: [
    // colores-ok: una etiqueta <meta> no puede leer variables CSS; es `canvas` del tema claro (app/tema.css)
    { media: '(prefers-color-scheme: light)', color: '#F6F6F1' },
    // colores-ok: una etiqueta <meta> no puede leer variables CSS; es `canvas` del tema oscuro (app/tema.css)
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El nonce lo fabrica `middleware.ts` en cada petición; sin él la CSP bloquea el script en línea.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // `suppressHydrationWarning`: el script de abajo escribe `data-theme` antes de que React hidrate.
    <html lang="es-BO" className={`${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Antes del primer pintado: decide el tema y lo escribe en <html>. Sin esto, destello claro. */}
        <script id="tema-inicial" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT_DE_TEMA }} />
        {/* Sólo quedan los iconos: la tipografía ya no se pide a Google. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0,0&display=swap" rel="stylesheet" />
      </head>
      <body><AuthProvider>{children}<CierrePorInactividad /></AuthProvider><ToastHost /></body>
    </html>
  );
}
