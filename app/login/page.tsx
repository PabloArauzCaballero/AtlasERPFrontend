'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { audienciaRecordada, resolverLogin } from '@/lib/accesoAudiencia';
import { rutaInternaSegura } from '@/lib/rutaInterna';

/**
 * `/login` no es una pantalla: reparte entre el acceso del comercio y el del personal de Atlas
 * (la regla está en `resolverLogin`). Se conserva porque es la dirección a la que mandan los
 * guards, el cierre de sesión y los marcadores de siempre.
 */
function Repartir() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // El `next` se valida aquí y viaja ya limpio: la pantalla de acceso lo vuelve a validar.
    const destinoPedido = rutaInternaSegura(searchParams.get('next'));
    router.replace(resolverLogin(destinoPedido, audienciaRecordada()));
  }, [router, searchParams]);

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background" role="status" aria-label="Abriendo el acceso">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Repartir />
    </Suspense>
  );
}
