'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { rememberRecoveryEmail, takeRecoveryEmail } from '@/lib/recoveryEmail';
import { authService } from '@/services/authService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

/**
 * Lo que la persona puede hacer ante cada fallo. Nunca dice si el correo existe: el servidor
 * responde igual exista o no, y un código malo, vencido o pedido para un correo desconocido recibe
 * el mismo mensaje.
 */
function describeFailure(error: unknown, step: 'request' | 'confirm'): string {
  const message = error instanceof Error ? error.message : '';
  if (/too many|demasiad/i.test(message)) {
    return 'Hubo demasiados intentos seguidos. Espera un par de minutos y revisa tu correo antes de volver a intentar.';
  }
  if (/abort|failed to fetch|network/i.test(message)) {
    return 'No hay conexión con el servidor. Comprueba tu red o la VPN y vuelve a intentar.';
  }
  if (step === 'confirm' && /código|codigo|expirad/i.test(message)) {
    return 'El código no es válido o ya venció. Revisa que el correo sea el mismo con el que lo pediste, o pide uno nuevo.';
  }
  return step === 'request'
    ? 'No pudimos enviar el código en este momento. Vuelve a intentarlo en unos minutos; si persiste, avisa a Sistemas.'
    : 'No pudimos cambiar tu contraseña. Vuelve a intentarlo en unos minutos; si persiste, avisa a Sistemas.';
}

/**
 * «¿Olvidaste tu contraseña?» en dos pasos: pedir un código al correo y canjearlo por una
 * contraseña nueva. El primer paso dice lo mismo exista o no la cuenta.
 */
export default function RecoverPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const remembered = takeRecoveryEmail();
    if (remembered) setEmail(remembered);
  }, []);
  // Al cambiar de paso, el foco va al titular para que un lector de pantalla anuncie el cambio.
  useEffect(() => heading.current?.focus(), [step]);

  const cleanEmail = email.trim();
  const emailError = submitted && !EMAIL_PATTERN.test(cleanEmail) ? 'Escribe un correo con el formato usuario@empresa.com.' : undefined;
  const codeError = submitted && step === 'confirm' && !/^\d{6}$/.test(code) ? 'El código son exactamente 6 números.' : undefined;
  const passwordError = submitted && step === 'confirm' && password.length < MIN_PASSWORD ? `Usa al menos ${MIN_PASSWORD} caracteres.` : undefined;
  const repeatError = submitted && step === 'confirm' && !passwordError && repeat !== password ? 'Las dos contraseñas no coinciden.' : undefined;

  async function sendCode(resend: boolean) {
    setError(null);
    setBusy(true);
    try {
      await authService.requestPasswordReset(cleanEmail);
      setSubmitted(false);
      setResent(resend);
      setStep('confirm');
    } catch (caught) {
      setError(describeFailure(caught, 'request'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (busy || !EMAIL_PATTERN.test(cleanEmail)) return;
    if (step === 'request') return sendCode(false);
    if (!/^\d{6}$/.test(code) || password.length < MIN_PASSWORD || repeat !== password) return;

    setError(null);
    setBusy(true);
    try {
      await authService.confirmPasswordReset({ email: cleanEmail, code, newPassword: password });
      rememberRecoveryEmail(cleanEmail);
      router.replace('/login?recuperada=1');
    } catch (caught) {
      // Se conserva lo escrito: un código mal tipeado no obliga a repetir la contraseña.
      setError(describeFailure(caught, 'confirm'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[340px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#031636] text-white"><Icon name="lock_reset" className="text-[20px]" /></span>
          <div>
            <h1 ref={heading} tabIndex={-1} className="text-base font-bold tracking-tight text-slate-900 outline-none">
              {step === 'request' ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
            </h1>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {step === 'request'
                ? 'Escribe tu correo corporativo y te enviaremos un código de 6 dígitos para crear una contraseña nueva.'
                : `Si ${cleanEmail} pertenece a una cuenta activa, te enviamos un código. Puede tardar un par de minutos; revisa también spam.`}
            </p>
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
          {step === 'request' ? (
            <FormField label="Correo corporativo" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(emailError)} hint={emailError} />
          ) : (
            <>
              <FormField label="Código de 6 dígitos" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(codeError)} hint={codeError} />
              <FormField label="Contraseña nueva" name="newPassword" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(passwordError)} hint={passwordError ?? `Mínimo ${MIN_PASSWORD} caracteres. Al cambiarla se cierran tus sesiones abiertas.`} />
              <FormField label="Repite la contraseña nueva" name="repeatPassword" type="password" autoComplete="new-password" required value={repeat} onChange={(event) => setRepeat(event.target.value)} aria-invalid={Boolean(repeatError)} hint={repeatError} />
            </>
          )}
          {resent && !error ? <InlineNotice tone="info">Te enviamos un código nuevo. Usa el más reciente: el anterior deja de funcionar.</InlineNotice> : null}
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <AtlasButton type="submit" className="w-full" loading={busy}>
            {step === 'request' ? 'Enviar código' : 'Cambiar contraseña'}
          </AtlasButton>
        </form>
        <div className="mt-5 flex items-center justify-between text-xs font-bold text-[#031636]">
          <Link href="/login" className="hover:underline focus-visible:underline focus-visible:outline-none">← Volver al inicio de sesión</Link>
          {step === 'confirm' ? (
            <button type="button" disabled={busy} onClick={() => void sendCode(true)} className="hover:underline focus-visible:underline focus-visible:outline-none disabled:text-slate-400">
              Enviar otro código
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
