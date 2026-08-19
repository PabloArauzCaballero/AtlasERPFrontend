import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
