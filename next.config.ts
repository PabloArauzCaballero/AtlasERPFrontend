import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
