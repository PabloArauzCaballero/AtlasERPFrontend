'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Icon } from '@/components/atlas/Icon';
import { useAuth } from '@/lib/authContext';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(searchParams.get('next') ?? '/operaciones');
    }
  }, [status, router, searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.replace(searchParams.get('next') ?? '/operaciones');
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
            <p className="mt-0.5 text-xs text-slate-400">Panel administrativo interno</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField
            label="Correo corporativo"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@atlas.internal"
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
