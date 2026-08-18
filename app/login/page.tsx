'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Icon } from '@/components/atlas/Icon';
import { useAuth } from '@/lib/authContext';

/**
 * Dos poblaciones, dos canales. El personal interno se autentica contra el plano interno de
 * AtlasBackend; el comercio, contra el suyo (`/auth/merchant/login`). No es una preferencia de
 * interfaz: son tablas de identidad distintas, y hasta hace poco el comercio simplemente no tenía
 * dónde entrar — su rol se fabricaba desde un rol de empleado.
 */
type Audience = 'internal' | 'merchant';

const AUDIENCE_COPY: Record<Audience, { tab: string; subtitle: string; emailLabel: string; placeholder: string; home: string }> = {
  internal: {
    tab: 'Personal Atlas',
    subtitle: 'Panel administrativo interno',
    emailLabel: 'Correo corporativo',
    placeholder: 'usuario@atlas.internal',
    home: '/operaciones',
  },
  merchant: {
    tab: 'Comercio afiliado',
    subtitle: 'Portal del comercio',
    emailLabel: 'Correo del comercio',
    placeholder: 'usuario@micomercio.com',
    home: '/portal-comercio/planes',
  },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginMerchant, status, isMerchant } = useAuth();
  const [audience, setAudience] = useState<Audience>('internal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        await login({ email, password });
        router.replace(searchParams.get('next') ?? copy.home);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[340px]">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#031636] text-white"><Icon name="account_balance" className="text-[20px]" /></span>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">Atlas ERP</p>
            <p className="mt-0.5 text-xs text-slate-400">{copy.subtitle}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Tipo de acceso">
          {(Object.keys(AUDIENCE_COPY) as Audience[]).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={audience === option}
              onClick={() => { setAudience(option); setError(null); }}
              className={`rounded-md px-3 py-2 text-xs font-bold transition ${audience === option ? 'bg-white text-[#031636] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
          />
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <AtlasButton type="submit" className="w-full" loading={submitting}>Iniciar sesión</AtlasButton>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
