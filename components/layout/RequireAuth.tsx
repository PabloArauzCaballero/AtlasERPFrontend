'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

/** Dónde vive cada población cuando su sesión no corresponde a la sección que pidió. */
const HOME_FOR_AUDIENCE = { internal: '/operaciones', merchant: '/portal-comercio/planes' } as const;

export type AuthAudience = keyof typeof HOME_FOR_AUDIENCE;

/**
 * Exige sesión y, opcionalmente, que sea de la población correcta.
 *
 * Lo segundo importa: el portal del comercio y la consola interna comparten esta aplicación, y sin
 * separarlas un comercio autenticado podía navegar a `/operaciones` y encontrarse una consola que
 * sólo falla endpoint por endpoint. El backend no se lo permitiría, pero una pantalla llena de
 * errores 403 no es una negativa, es una avería aparente.
 */
export function RequireAuth({ children, audience }: Readonly<{ children: React.ReactNode; audience?: AuthAudience }>) {
  const { status, isMerchant } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const sessionAudience: AuthAudience = isMerchant ? 'merchant' : 'internal';
  const audienceMismatch = status === 'authenticated' && audience !== undefined && audience !== sessionAudience;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (audienceMismatch) {
      router.replace(HOME_FOR_AUDIENCE[sessionAudience]);
    }
  }, [status, audienceMismatch, sessionAudience, router, pathname]);

  if (status !== 'authenticated' || audienceMismatch) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#031636]" />
      </div>
    );
  }

  return <>{children}</>;
}
