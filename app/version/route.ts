import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Identidad del proceso que está sirviendo tráfico, no la punta actual de GitHub. */
export function GET() {
  return NextResponse.json(
    {
      service: 'atlas-erp-frontend',
      version: process.env.APP_VERSION ?? 'unknown',
      commit: process.env.APP_COMMIT_SHA ?? 'unknown',
      environment: process.env.NODE_ENV ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
