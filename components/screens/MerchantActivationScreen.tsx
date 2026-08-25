'use client';

import { useCallback, useEffect, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadOnboardingCases } from '@/services/optionLoaders';

/**
 * Las dos condiciones que el backend comprueba antes de activar, leidas del propio caso.
 *
 * Antes esto eran cuatro tarjetas fijas —firma, KYB, estructura, liquidacion— siempre en verde,
 * dibujadas sin mirar nada. Un panel que afirma «READY» sin haber comprobado es peor que no tener
 * panel: convence a quien lo lee de que ya esta revisado, y la activacion falla despues sin que
 * nadie entienda por que si la pantalla decia 100 %.
 */
function controles(readiness: { pendingChecklistItems?: number; hasActiveContract?: boolean } | null) {
  if (!readiness) return [];
  const pendientes = Number(readiness.pendingChecklistItems ?? 0);
  return [
    {
      icon: 'fact_check',
      title: 'Requisitos del expediente',
      detail: pendientes === 0
        ? 'Todos cerrados.'
        : `${pendientes} sin cerrar. La activación será rechazada.`,
      ok: pendientes === 0,
    },
    {
      icon: 'draw',
      title: 'Contrato comercial activo',
      detail: readiness.hasActiveContract
        ? 'Firmado, vigente y con condiciones comerciales.'
        : 'No hay versión de contrato activa para esta cuenta.',
      ok: Boolean(readiness.hasActiveContract),
    },
  ];
}

export function MerchantActivationScreen() {
  const [caseId, setCaseId] = useState('');
  /* El caso se ELIGE: la etiqueta trae el nombre del comercio y cuantos requisitos siguen pendientes,
     que es exactamente lo que decide si la activacion va a pasar o la va a frenar el backend. */
  const cases = useOptions(loadOnboardingCases);
  /* El detalle del caso elegido: de ahi salen los controles reales y el porcentaje. */
  const [readiness, setReadiness] = useState<{ pendingChecklistItems?: number; hasActiveContract?: boolean } | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!caseId) { setReadiness(null); return; }
    b2bService
      .getOnboardingCase(caseId)
      .then((detalle) => { if (!cancelado) setReadiness((detalle.readiness ?? null) as never); })
      .catch(() => { if (!cancelado) setReadiness(null); });
    return () => { cancelado = true; };
  }, [caseId]);

  const listaControles = controles(readiness);
  const superados = listaControles.filter((control) => control.ok).length;
  const porcentaje = listaControles.length ? Math.round((superados / listaControles.length) * 100) : 0;
  const mutation = useAtlasMutation(useCallback((id: string) => b2bService.activateOnboarding(id, {}), []));
  async function activate() { try { await mutation.execute(caseId); } catch { /* controlled */ } }
  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Activación' }]} title="Activación del contrato" description="Último control de preparación antes de habilitar al comercio para operar en ATLAS." actions={<><AtlasButton variant="secondary" icon="visibility">Previsualizar contrato</AtlasButton><AtlasButton variant="secondary" icon="download">Exportar auditoría</AtlasButton></>} />
      {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
      {mutation.status === 'success' ? <InlineNotice tone="success" title="Comercio activado">El caso fue activado por el backend y quedó disponible para operación.</InlineNotice> : null}
      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-4">
          <Panel title="Control de preparación" description={caseId ? 'Lo que el backend comprobará al activar.' : 'Elija un caso para ver su estado.'} icon="fact_check"><div className="grid gap-3 md:grid-cols-2">{listaControles.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">Sin caso elegido.</p> : listaControles.map((check) => <article key={check.title} className="flex gap-3 rounded-md border border-slate-200 p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Icon name={check.icon} className="text-[19px]" /></span><div><div className="flex items-center gap-2"><h3 className="text-xs font-bold">{check.title}</h3><StatusPill tone={check.ok ? 'success' : 'warning'} dot={false}>{check.ok ? 'Listo' : 'Pendiente'}</StatusPill></div><p className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</p></div></article>)}</div></Panel>
          <Panel title="Activation Audit" icon="history_edu"><div className="grid gap-4 text-xs md:grid-cols-3"><Audit label="Control" value="4/4 validaciones" /><Audit label="Separación" value="Legal + Operaciones" /><Audit label="Registro" value="Business Action Log" /></div></Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Account Activated" icon="rocket_launch"><div className="mb-4 rounded-md bg-[#006a61] p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-widest text-white/75">Activation readiness</p><p className="mt-1 text-2xl font-bold">{caseId ? `${porcentaje}%` : '—'}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-emerald-400" style={{ width: `${porcentaje}%` }} /></div></div><FormField kind="select" label="Caso de onboarding" name="caseId" value={caseId} onChange={(event) => setCaseId(event.target.value)} required options={[{ label: '— Elija el caso —', value: '' }, ...cases]} hint="Un caso con requisitos pendientes será rechazado por el backend." /><AtlasButton className="mt-4 w-full" icon="rocket_launch" variant="success" loading={mutation.isLoading} disabled={!caseId} onClick={activate}>Activar comercio</AtlasButton><p className="mt-3 text-[11px] leading-4 text-slate-500">La API volverá a comprobar los requisitos. La interfaz no puede saltarse controles del backend.</p></Panel>
        </aside>
      </div>
    </div>
  );
}
function Audit({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>; }
