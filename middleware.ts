import { NextResponse, type NextRequest } from 'next/server';

function apiOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL?.trim();
  if (!configured) return null;
  try { return new URL(configured).origin; } catch { return null; }
}

function uploadOrigins(): string[] {
  return (process.env.ATLAS_UPLOAD_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .flatMap((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.href === `${url.origin}/` ? [url.origin] : [];
      } catch {
        return [];
      }
    });
}

function policyFor(nonce: string): string {
  const development = process.env.NODE_ENV !== 'production';
  const connect = ["'self'", apiOrigin(), ...uploadOrigins(), ...(development ? ['ws:', 'wss:'] : [])]
    .filter(Boolean)
    .join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    // Los controles y Next inyectan estilos; los scripts nunca permiten unsafe-inline.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "frame-src 'self' blob: https://www.google.com",
    "media-src 'self' blob:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const policy = policyFor(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
};
