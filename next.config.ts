import type { NextConfig } from 'next';

function securityHeaders() {
  return [
    // CSP vive en middleware.ts: el nonce cambia por petición.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
  /**
   * Salida autónoma: `.next/standalone` trae su propio `server.js` con sólo las dependencias que el
   * servidor usa de verdad, así que la imagen no arrastra el `node_modules` de construcción ni el
   * código fuente. Es lo que permite servir este front desde un contenedor con `node server.js`.
   */
  output: 'standalone',
  poweredByHeader: false,
  /**
   * El front hace de proxy de la API del ERP: el navegador habla solo con este
   * origen y el salto al backend lo da el servidor de Next. Sin esto, exponer
   * el front por un túnel obliga a exponer también el backend.
   */
  /**
   * Las rutas que el portal del comercio dejó de tener (2026-09-18), apuntando a donde vive ahora
   * su contenido.
   *
   * No se dejan morir en un 404 porque las URLs viejas siguen existiendo fuera de aquí: en los
   * marcadores del comercio, en los enlaces que soporte le pasó por escrito y en los recorridos de
   * los tutoriales. `/planes` y `/campanas` no tienen sucesor —esas pantallas se retiraron— y
   * caen en la portada nueva en vez de dejar al comercio en una página de error.
   */
  async redirects() {
    return [
      { source: '/portal-comercio/planes', destination: '/portal-comercio/gestion-pos', permanent: false },
      { source: '/portal-comercio/campanas', destination: '/portal-comercio/gestion-pos', permanent: false },
      { source: '/portal-comercio/solicitudes', destination: '/portal-comercio/gestion-pos?tab=solicitudes', permanent: false },
      { source: '/portal-comercio/comprobantes', destination: '/portal-comercio/gestion-pos?tab=comprobantes', permanent: false },
      { source: '/portal-comercio/qr-cobro', destination: '/portal-comercio/expediente?tab=qr', permanent: false },
      { source: '/portal-comercio/sucursales-usuarios', destination: '/portal-comercio/expediente?tab=sucursales', permanent: false },
      { source: '/portal-comercio/formularios', destination: '/portal-comercio/expediente', permanent: false },
      { source: '/portal-comercio/tutoriales', destination: '/portal-comercio/soporte?tab=tutoriales', permanent: false },
      { source: '/operaciones/admin/formularios-papel', destination: '/operaciones/admin/mapa-sitio', permanent: false },
    ];
  },
  async rewrites() {
    const origin = process.env.ERP_API_ORIGIN ?? 'http://127.0.0.1:3020';
    return [{ source: '/api/v1/:path*', destination: `${origin}/api/v1/:path*` }];
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
