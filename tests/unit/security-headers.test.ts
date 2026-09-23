import { beforeEach, expect, it, vi } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import nextConfig from '@/next.config';

vi.mock('next/server', () => ({ NextResponse: { next: vi.fn(() => ({ headers: new Headers() })) } }));

function responseForRequest() {
  return middleware({ headers: new Headers() } as NextRequest);
}

beforeEach(() => vi.mocked(NextResponse.next).mockClear());

it('emite un nonce nuevo por petición y lo comunica a Next', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const first = responseForRequest().headers.get('Content-Security-Policy')!;
  const forwarded = vi.mocked(NextResponse.next).mock.calls[0]?.[0]?.request?.headers;
  const nonce = first.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toMatch(/^[a-f0-9]{32}$/);
  expect(forwarded?.get('x-nonce')).toBe(nonce);
  expect(forwarded?.get('Content-Security-Policy')).toBe(first);
  expect(responseForRequest().headers.get('Content-Security-Policy')).not.toBe(first);
  vi.unstubAllEnvs();
});

it('limita scripts y conexiones en producción sin duplicar CSP en next.config', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const policy = responseForRequest().headers.get('Content-Security-Policy')!;
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain('https://fonts.googleapis.com');
  expect(policy).toContain('https://fonts.gstatic.com');
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy.match(/script-src ([^;]+)/)?.[1]).not.toContain("'unsafe-inline'");
  const staticHeaders = await nextConfig.headers?.();
  expect(staticHeaders?.[0]?.headers.some((header) => header.key === 'Content-Security-Policy')).toBe(false);
  expect(staticHeaders?.[0]?.headers.find((header) => header.key === 'X-Frame-Options')?.value).toBe('DENY');
  vi.unstubAllEnvs();
});
