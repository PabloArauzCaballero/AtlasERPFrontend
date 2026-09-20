'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AmbientBackground } from '@/components/atlas/AmbientBackground';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { AuthPortada } from '@/components/atlas/AuthPortada';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { authService } from '@/services/authService';

/**
 * Recuperar el acceso del comercio afiliado.
 *
 * Hasta ahora, un comercio que perdía su contraseña no tenía ninguna salida por su cuenta: lo
 * único que existía era el cambio de contraseña DESDE DENTRO, que pide la contraseña actual. Quien
 * la había olvidado —justo el caso— quedaba fuera y dependía de que alguien se la volviera a
 * fabricar a mano.
 *
 * Dos pasos, como el acceso en dos factores que ya usa el personal interno: se pide un código al
 * correo del comercio y ese código, junto con la contraseña nueva, completa el cambio.
 *
 * Pantalla aparte y no un modo más dentro del login, por dos razones: tiene dirección propia
 * (soporte puede enviarla tal cual) y el login ya alterna entre formulario y segundo factor; un
 * tercer estado allí dentro haría ilegible cuál de los tres se está mirando.
 */
type Paso = 'pedir' | 'confirmar' | 'listo';

function RecuperarAcceso() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paso, setPaso] = useState<Paso>('pedir');
  // El correo llega prellenado desde el login para no teclearlo dos veces, pero sigue siendo
  // editable: quien se equivocó de cuenta al entrar se equivocaría igual aquí.
  const [email, setEmail] = useState(searchParams.get('correo') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pedirCodigo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.requestMerchantPasswordReset({ email: email.trim() });
      // Se avanza SIEMPRE, exista o no la cuenta: la respuesta es idéntica en los dos casos a
      // propósito, y quedarse aquí con un «ese correo no existe» convertiría esta pantalla en un
      // comprobador de qué correos pertenecen a un comercio afiliado.
      setPaso('confirmar');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible enviar el código. Inténtalo de nuevo en un momento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.confirmMerchantPasswordReset({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setPaso('listo');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible cambiar la contraseña.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.05fr_1fr]">
      <AuthPortada />

      <section className="relative flex items-center justify-center px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(2.5rem+env(safe-area-inset-top,0px))] sm:px-10">
        <AmbientBackground variant="auth" state={error ? 'error' : 'idle'} />
        <div className="relative z-10 w-full max-w-[380px]">
          {paso === 'listo' ? (
            <>
              <header className="mb-6">
                <p className="text-xs font-bold tracking-[0.02em] text-primary">Contraseña nueva</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Ya puedes entrar
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  Tu contraseña quedó cambiada. Por seguridad se cerraron las sesiones que tenías
                  abiertas en otros dispositivos.
                </p>
              </header>
              <AtlasButton className="w-full" onClick={() => router.replace('/login')}>
                Ir al acceso
              </AtlasButton>
            </>
          ) : null}

          {paso === 'pedir' ? (
            <>
              <header className="mb-6">
                <p className="text-xs font-bold tracking-[0.02em] text-primary">
                  Portal del comercio
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Recuperar el acceso
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  Escribe el correo de tu comercio y te enviamos un código para poner una
                  contraseña nueva.
                </p>
              </header>

              <form onSubmit={pedirCodigo} className="space-y-5">
                <FormField
                  tooltip="El correo con el que entras al portal de tu comercio. Ej.: usuario@micomercio.com."
                  label="Correo del comercio"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@micomercio.com"
                />
                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                <AtlasButton type="submit" className="w-full" loading={submitting}>
                  Enviarme el código
                </AtlasButton>
              </form>
            </>
          ) : null}

          {paso === 'confirmar' ? (
            <>
              <header className="mb-6">
                <p className="text-xs font-bold tracking-[0.02em] text-primary">Revisa tu correo</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Escribe el código
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  Si <strong>{email.trim()}</strong> corresponde a un comercio registrado, ahí llegó
                  un código de 6 dígitos. Sólo sirve una vez y caduca en pocos minutos.
                </p>
              </header>

              <form onSubmit={confirmar} className="space-y-5">
                <FormField
                  tooltip="Código de seis dígitos que te llegó al correo; caduca en pocos minutos."
                  label="Código del correo"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="000000"
                />
                <FormField
                  tooltip="Tu contraseña nueva del portal; distingue mayúsculas."
                  label="Contraseña nueva"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="••••••••"
                  hint="Al menos 10 caracteres. Nunca la compartas; soporte jamás te la pedirá."
                />
                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                <AtlasButton type="submit" className="w-full" loading={submitting}>
                  Cambiar mi contraseña
                </AtlasButton>
                <button
                  type="button"
                  className="w-full text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                  onClick={() => {
                    setPaso('pedir');
                    setCode('');
                    setNewPassword('');
                    setError(null);
                  }}
                >
                  No me llegó: pedir otro código
                </button>
              </form>
            </>
          ) : null}

          <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-5 text-slate-500">
            ¿Ya la recordaste?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Volver al acceso
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function RecuperarAccesoPage() {
  return (
    <Suspense>
      <RecuperarAcceso />
    </Suspense>
  );
}
