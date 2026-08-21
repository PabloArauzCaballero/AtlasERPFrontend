'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AmbientBackground } from '@/components/atlas/AmbientBackground';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Icon } from '@/components/atlas/Icon';
import { useAuth } from '@/lib/authContext';
import { isPinChallenge } from '@/services/authTypes';
import type { PinChallenge } from '@/services/authTypes';

/**
 * Dos poblaciones, dos canales. El personal interno se autentica contra el plano interno de
 * AtlasBackend; el comercio, contra el suyo (`/auth/merchant/login`). No es una preferencia de
 * interfaz: son tablas de identidad distintas, y hasta hace poco el comercio simplemente no tenía
 * dónde entrar — su rol se fabricaba desde un rol de empleado.
 *
 * ## La portada
 *
 * Es la anatomía del acceso del motor de decisión, traída aquí: portada de marca a la izquierda con
 * lo que el producto hace, tarjeta de acceso a la derecha. Antes esto era un formulario centrado de
 * 340 px sobre blanco — correcto y anónimo: nada decía a qué se está entrando ni por qué esa
 * pantalla pertenece a ATLAS.
 *
 * La portada se OCULTA por debajo de `lg`. En un móvil no hay sitio para dos columnas, y apilar el
 * discurso encima del formulario obliga a desplazarse para hacer lo único que se vino a hacer.
 */
type Audience = 'internal' | 'merchant';

const AUDIENCE_COPY: Record<
  Audience,
  { tab: string; subtitle: string; acceso: string; emailLabel: string; placeholder: string; home: string }
> = {
  internal: {
    tab: 'Personal Atlas',
    subtitle: 'Panel administrativo interno',
    acceso: 'al panel administrativo interno',
    emailLabel: 'Correo corporativo',
    placeholder: 'usuario@atlas.internal',
    home: '/operaciones',
  },
  merchant: {
    tab: 'Comercio afiliado',
    subtitle: 'Portal del comercio',
    acceso: 'al portal de tu comercio',
    emailLabel: 'Correo del comercio',
    placeholder: 'usuario@micomercio.com',
    home: '/portal-comercio/planes',
  },
};

/** Lo que el ERP hace, en la voz del producto y no en la del catálogo de módulos. */
const CAPACIDADES = [
  { icon: 'account_balance', text: 'Contabilidad y cierres con doble partida' },
  { icon: 'handshake', text: 'Cartera B2B, propuestas y aprobaciones' },
  { icon: 'campaign', text: 'Campañas segmentadas y su desempeño' },
  { icon: 'verified_user', text: 'Cada acción, auditada y atribuible' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, verifyLoginPin, loginMerchant, status, isMerchant } = useAuth();
  const [audience, setAudience] = useState<Audience>('internal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Desafío del segundo factor pendiente: la contraseña ya se validó, pero todavía no hay sesión.
  // Sólo el canal interno lo produce; el del comercio no exige PIN.
  const [challenge, setChallenge] = useState<PinChallenge | null>(null);
  const [pin, setPin] = useState('');

  const copy = AUDIENCE_COPY[audience];

  useEffect(() => {
    if (status === 'authenticated') {
      // El destino lo manda la sesión REAL, no la pestaña elegida: si alguien llega con sesión de
      // comercio y `next=/operaciones`, mandarlo allí sólo produciría un rebote del guard.
      const home = AUDIENCE_COPY[isMerchant ? 'merchant' : 'internal'].home;
      const next = searchParams.get('next');
      router.replace(next && !isMerchant ? next : home);
    }
  }, [status, isMerchant, router, searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (audience === 'merchant') {
        await loginMerchant({ email, password });
        router.replace(copy.home);
      } else {
        const outcome = await login({ email, password });
        if (isPinChallenge(outcome)) {
          setChallenge(outcome);
          return;
        }
        router.replace(searchParams.get('next') ?? copy.home);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyLoginPin({ challengeToken: challenge.challengeToken, pin });
      router.replace(searchParams.get('next') ?? AUDIENCE_COPY.internal.home);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible verificar el código.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <Portada />

      {/*
       * La columna del formulario lleva el fondo ambiental —el mismo del motor de
       * decisión— y la portada no: allí ya hay un degradado propio, y dos capas de
       * atmósfera compitiendo se leen como ruido. Aquí, en cambio, había un plano
       * liso, y es la superficie a la que se mira mientras se teclea.
       */}
      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <AmbientBackground variant="auth" state={error ? 'error' : 'idle'} />
        <div className="relative z-10 w-full max-w-[380px]">
          {challenge ? (
            <PasoDelCodigo
              expiresInMinutes={challenge.expiresInMinutes}
              pin={pin}
              onPin={setPin}
              error={error}
              submitting={submitting}
              onSubmit={handleVerifyPin}
              onCancel={() => {
                setChallenge(null);
                setPin('');
                setError(null);
              }}
            />
          ) : (
            <>
              <header className="mb-6">
                <p className="text-xs font-bold tracking-[0.02em] text-primary">Acceso corporativo</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Bienvenido nuevamente
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  Ingresa tus credenciales para acceder {copy.acceso}.
                </p>
              </header>

              <div
                className="mb-6 grid grid-cols-2 gap-1 rounded-sm bg-slate-100 p-1"
                role="tablist"
                aria-label="Tipo de acceso"
              >
                {(Object.keys(AUDIENCE_COPY) as Audience[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={audience === option}
                    onClick={() => {
                      setAudience(option);
                      setError(null);
                    }}
                    className={`rounded-xs px-3 py-2 text-xs font-bold transition ${
                      audience === option
                        ? 'bg-surface text-primary shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {AUDIENCE_COPY[option].tab}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <FormField
                  label={copy.emailLabel}
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={copy.placeholder}
                />
                <FormField
                  label="Contraseña"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  hint="Nunca compartas tu contraseña; el equipo de soporte jamás te la pedirá."
                />
                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                <AtlasButton type="submit" className="w-full" loading={submitting}>
                  Iniciar sesión
                </AtlasButton>
              </form>

              <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-5 text-slate-500">
                El token de refresco viaja en una cookie <strong>HttpOnly</strong> y las acciones
                quedan auditadas.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * La portada.
 *
 * Fondo oscuro y una sola idea grande. El degradado es adorno —no señal—, así que va en tonos del
 * propio acento en vez de traer un color nuevo que compita con los estados del producto.
 */
function Portada() {
  return (
    <aside className="relative hidden overflow-hidden bg-slate-900 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(60rem 40rem at 15% 0%, rgba(0,106,97,0.5), transparent 60%), radial-gradient(45rem 35rem at 100% 100%, rgba(0,84,77,0.45), transparent 55%)',
        }}
      />

      <div className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-white/10 text-sm font-black backdrop-blur">
          A
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">ATLAS</p>
          <p className="text-xs text-white/60">Enterprise Hub</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-[2rem] font-bold leading-[1.15] tracking-tight">
          La operación de tu negocio, con cada número explicable.
        </h2>
        <p className="mt-4 text-sm leading-6 text-white/70">
          Contabilidad, cartera y publicidad sobre una sola fuente de verdad.
        </p>

        <ul className="mt-9 space-y-3.5">
          {CAPACIDADES.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm text-white/85">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-white/10">
                <Icon name={item.icon} className="text-[16px]" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/45">
        Acceso únicamente para personal autorizado · Todas las acciones son auditadas
      </p>
    </aside>
  );
}

/** Segundo paso del acceso interno: el código de 6 dígitos que llega al correo de la cuenta. */
function PasoDelCodigo({
  expiresInMinutes,
  pin,
  onPin,
  error,
  submitting,
  onSubmit,
  onCancel,
}: Readonly<{
  expiresInMinutes: number;
  pin: string;
  onPin: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}>) {
  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.02em] text-primary">Verificación en dos pasos</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Revisa tu correo</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          Enviamos un código de 6 dígitos al correo de tu cuenta. Vence en {expiresInMinutes} minutos
          y sólo puede usarse una vez.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          label="Código de verificación"
          name="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={pin}
          onChange={(event) => onPin(event.target.value)}
          placeholder="000000"
        />
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        <AtlasButton type="submit" className="w-full" loading={submitting}>
          Confirmar y entrar
        </AtlasButton>
        <button
          type="button"
          className="w-full text-xs font-semibold text-slate-500 transition hover:text-slate-700"
          onClick={onCancel}
        >
          Usar otra cuenta
        </button>
      </form>

      <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-5 text-slate-500">
        Nadie de soporte te pedirá este código. Si no pediste entrar, ignóralo y cambia tu
        contraseña.
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
