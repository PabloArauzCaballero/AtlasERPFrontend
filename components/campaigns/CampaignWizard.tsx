'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { toast } from '@/lib/toast';
import {
  newIdempotencyKey,
  notificationCampaignsService,
  type AudienceDefinition,
  type AudienceEstimate,
  type Campaign,
  type CampaignChannel,
  type CampaignInput,
  type CampaignPurpose,
} from '@/services/notificationCampaignsService';
import { AudienceBuilder } from './AudienceBuilder';
import {
  CHANNEL_META,
  DEEP_LINK_OPTIONS,
  PURPOSE_OPTIONS,
  RATE_OPTIONS,
  describeRule,
  errorMessage,
  formatCount,
  formatDateTime,
  fromLocalInput,
  toLocalInput,
} from './campaignCatalog';

/**
 * Asistente de campaña en cuatro pasos: Contenido → Audiencia → Programación → Revisión.
 *
 * Es el orden en que se toman las decisiones en cualquier herramienta de anuncios: qué se dice, a
 * quién, cuándo y durante cuánto, y un último vistazo con el tamaño real de la audiencia antes de
 * comprometerse. «Programar» no se ofrece hasta la revisión, y se bloquea con una audiencia vacía.
 */

const STEPS = ['Contenido', 'Audiencia', 'Programación', 'Revisión'] as const;
const CHANNELS: CampaignChannel[] = ['in_app', 'push', 'email'];

interface CampaignWizardProps {
  campaign?: Campaign | null | undefined;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
}

interface FormState {
  name: string;
  purpose: CampaignPurpose;
  title: string;
  body: string;
  channels: CampaignChannel[];
  deepLink: string;
  audienceMode: 'custom' | 'segment';
  segmentId: string;
  audience: AudienceDefinition;
  startMode: 'now' | 'date';
  startsAt: string;
  endsAt: string;
  ratePerMinute: string;
  maxRecipients: string;
}

function initialState(campaign: Campaign | null | undefined): FormState {
  return {
    name: campaign?.name ?? '',
    purpose: campaign?.purpose ?? 'marketing',
    title: campaign?.title ?? '',
    body: campaign?.body ?? '',
    channels: campaign?.channels ?? ['in_app', 'push'],
    deepLink: campaign?.deepLink ?? '',
    audienceMode: campaign?.audienceSegmentId ? 'segment' : 'custom',
    segmentId: campaign?.audienceSegmentId ?? '',
    audience: campaign?.audience ?? { match: 'all', rules: [] },
    startMode: campaign?.startsAt ? 'date' : 'now',
    startsAt: toLocalInput(campaign?.startsAt),
    endsAt: toLocalInput(campaign?.endsAt),
    ratePerMinute: String(campaign?.ratePerMinute ?? 600),
    maxRecipients: campaign?.maxRecipients ? String(campaign.maxRecipients) : '',
  };
}

function stepErrors(step: number, form: FormState): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (form.name.trim().length < 3) errors.push('El nombre interno necesita al menos 3 caracteres.');
    if (!form.title.trim()) errors.push('Falta el título del aviso.');
    if (form.title.length > 120) errors.push('El título no puede pasar de 120 caracteres.');
    if (!form.body.trim()) errors.push('Falta el mensaje.');
    if (form.body.length > 1000) errors.push('El mensaje no puede pasar de 1.000 caracteres.');
    if (form.channels.length === 0) errors.push('Elige al menos un canal.');
  }
  if (step === 1 && form.audienceMode === 'segment' && !form.segmentId) errors.push('Elige un segmento guardado.');
  if (step === 2) {
    const start = form.startMode === 'date' ? fromLocalInput(form.startsAt) : new Date().toISOString();
    if (form.startMode === 'date' && !start) errors.push('Indica la fecha y hora de inicio.');
    if (form.startMode === 'date' && start && new Date(start).getTime() < Date.now() - 60_000) errors.push('La fecha de inicio ya pasó.');
    const end = fromLocalInput(form.endsAt);
    if (end && start && new Date(end).getTime() <= new Date(start).getTime()) errors.push('La fecha de fin tiene que ser posterior al inicio.');
    if (form.maxRecipients && (!/^[1-9][0-9]*$/.test(form.maxRecipients) || Number(form.maxRecipients) > 1_000_000)) {
      errors.push('El tope de destinatarios tiene que ser un número entre 1 y 1.000.000.');
    }
  }
  return errors;
}

export function CampaignWizard({ campaign, onClose, onSaved }: CampaignWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialState(campaign));
  const [estimate, setEstimate] = useState<AudienceEstimate | null>(campaign?.audienceEstimate ?? null);
  const [saving, setSaving] = useState<'draft' | 'schedule' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keys] = useState(() => ({ create: newIdempotencyKey(), schedule: newIdempotencyKey() }));
  const segments = useAsyncResource(useCallback(() => notificationCampaignsService.segments('active'), []));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const errors = useMemo(() => stepErrors(step, form), [step, form]);
  const segmentList = segments.data?.data ?? [];
  const selectedSegment = segmentList.find((segment) => segment.id === form.segmentId);

  useEffect(() => {
    if (form.audienceMode !== 'segment' || !form.segmentId) return;
    let cancelled = false;
    notificationCampaignsService
      .estimate({ purpose: form.purpose, audienceSegmentId: form.segmentId })
      .then((result) => !cancelled && setEstimate(result))
      .catch((failure: unknown) => !cancelled && setError(errorMessage(failure)));
    return () => {
      cancelled = true;
    };
  }, [form.audienceMode, form.segmentId, form.purpose]);

  function toInput(): CampaignInput {
    return {
      name: form.name.trim(),
      purpose: form.purpose,
      title: form.title.trim(),
      body: form.body.trim(),
      category: 'campaign',
      deepLink: form.deepLink || null,
      channels: form.channels,
      audienceSegmentId: form.audienceMode === 'segment' ? form.segmentId : null,
      ...(form.audienceMode === 'custom' ? { audience: form.audience } : {}),
      startsAt: form.startMode === 'date' ? fromLocalInput(form.startsAt) : null,
      endsAt: fromLocalInput(form.endsAt),
      ratePerMinute: Number(form.ratePerMinute),
      maxRecipients: form.maxRecipients ? Number(form.maxRecipients) : null,
    };
  }

  async function save(schedule: boolean) {
    setSaving(schedule ? 'schedule' : 'draft');
    setError(null);
    try {
      let saved = campaign ? await notificationCampaignsService.update(campaign.id, toInput()) : await notificationCampaignsService.create(toInput(), keys.create);
      if (schedule) saved = await notificationCampaignsService.action(saved.id, 'schedule', keys.schedule);
      toast.success(schedule ? 'Campaña programada' : 'Borrador guardado', schedule ? `Empieza ${form.startMode === 'now' ? 'en menos de un minuto' : formatDateTime(saved.startsAt)}.` : saved.name);
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(null);
    }
  }

  const toggleChannel = (channel: CampaignChannel) =>
    set('channels', form.channels.includes(channel) ? form.channels.filter((item) => item !== channel) : CHANNELS.filter((item) => item === channel || form.channels.includes(item)));
  const audienceEmpty = estimate !== null && estimate.total === 0;

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <AtlasButton variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>{step === 0 ? 'Cerrar' : 'Atrás'}</AtlasButton>
      <div className="flex flex-wrap gap-2">
        <AtlasButton variant="secondary" icon="save" loading={saving === 'draft'} disabled={saving !== null || stepErrors(0, form).length > 0} onClick={() => void save(false)}>
          Guardar borrador
        </AtlasButton>
        {step < STEPS.length - 1 ? (
          <AtlasButton icon="arrow_forward" disabled={errors.length > 0} onClick={() => setStep(step + 1)}>Siguiente</AtlasButton>
        ) : (
          <AtlasButton icon="schedule_send" loading={saving === 'schedule'} disabled={saving !== null || audienceEmpty || [0, 1, 2].some((index) => stepErrors(index, form).length > 0)} onClick={() => void save(true)}>
            Programar campaña
          </AtlasButton>
        )}
      </div>
    </div>
  );

  return (
    <Modal open title={campaign ? `Editar «${campaign.name}»` : 'Nueva campaña de notificación'} description="Qué se dice, a quién, cuándo y durante cuánto." icon="campaign" onClose={onClose} footer={footer}>
      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" disabled={index > step && stepErrors(step, form).length > 0} onClick={() => setStep(index)} className={`w-full rounded-md border px-3 py-2 text-left text-xs font-bold ${index === step ? 'border-slate-900 bg-slate-900 text-white' : index < step ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <FormField tooltip="Nombre interno de la campaña de avisos; sólo lo ve el equipo." label="Nombre interno" name="name" required hint="Sólo lo ve el equipo. Ej.: Recordatorio cuota septiembre." value={form.name} onChange={(event) => set('name', event.target.value)} />
            <FormField tooltip="Tipo de campaña; una comercial respeta a quien no quiere promociones." kind="select" label="Tipo de campaña" name="purpose" hint="Una comercial respeta a quien no quiere promociones." value={form.purpose} options={PURPOSE_OPTIONS} onChange={(event) => set('purpose', event.target.value as CampaignPurpose)} />
            <FormField tooltip="Primera línea del aviso; en la pantalla de bloqueo se corta a unos 45 caracteres." label={`Título (${form.title.length}/120)`} name="title" required maxLength={120} hint="La primera línea del aviso. Corto: en el bloqueo se corta a unos 45 caracteres." value={form.title} onChange={(event) => set('title', event.target.value)} />
            <FormField tooltip="Qué tiene que saber o hacer la persona al leer el aviso; corto y concreto." kind="textarea" label={`Mensaje (${form.body.length}/1000)`} name="body" required maxLength={1000} hint="Qué tiene que saber o hacer la persona." value={form.body} onChange={(event) => set('body', event.target.value)} />
            <FormField tooltip="Pantalla de la app que se abre al tocar el aviso." kind="select" label="Al tocar el aviso, abrir" name="deepLink" hint="La pantalla de la app a la que lleva." value={form.deepLink} options={DEEP_LINK_OPTIONS} onChange={(event) => set('deepLink', event.target.value)} />
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-slate-700">Canales<span className="ml-1 text-red-600">*</span></legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CHANNELS.map((channel) => (
                  <label key={channel} className={`flex cursor-pointer gap-2 rounded-md border p-2.5 text-xs ${form.channels.includes(channel) ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={form.channels.includes(channel)} onChange={() => toggleChannel(channel)} />
                    <span><span className="block font-bold text-slate-800">{CHANNEL_META[channel].label}</span><span className="text-slate-500">{CHANNEL_META[channel].hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="rounded-xl bg-slate-900 p-4 text-white" aria-label="Vista previa del aviso">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Vista previa en el teléfono</p>
            <div className="rounded-lg bg-white/95 p-3 text-slate-900 shadow">
              <div className="flex items-center gap-2 text-[10px] text-slate-500"><Icon name="notifications" className="text-[14px]" /> Atlas · ahora</div>
              <p className="mt-1 truncate text-sm font-bold">{form.title || 'Título del aviso'}</p>
              <p className="line-clamp-3 text-xs text-slate-700">{form.body || 'El mensaje aparece aquí.'}</p>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Al tocarlo: {DEEP_LINK_OPTIONS.find((option) => option.value === form.deepLink)?.label}</p>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <FormField tooltip="Si la audiencia sale de un segmento guardado o de condiciones nuevas."
            kind="select"
            label="Audiencia"
            name="audienceMode"
            hint="Un segmento guardado se reutiliza entre campañas; las condiciones sueltas sólo valen para ésta."
            value={form.audienceMode}
            options={[
              { value: 'custom', label: 'Definir condiciones para esta campaña' },
              { value: 'segment', label: 'Usar un segmento guardado' },
            ]}
            onChange={(event) => {
              set('audienceMode', event.target.value as FormState['audienceMode']);
              setEstimate(null);
            }}
          />
          {form.audienceMode === 'segment' ? (
            <div className="space-y-2">
              <FormField tooltip="Segmento guardado al que se envía; sólo activos." kind="select" label="Segmento" name="segmentId" hint="Sólo segmentos activos." value={form.segmentId} options={[{ value: '', label: 'Elige un segmento…' }, ...segmentList.map((segment) => ({ value: segment.id, label: segment.name }))]} onChange={(event) => set('segmentId', event.target.value)} />
              {selectedSegment ? (
                <InlineNotice tone="info" title={selectedSegment.name}>
                  {selectedSegment.definition.rules.length ? selectedSegment.definition.rules.map(describeRule).join(selectedSegment.definition.match === 'any' ? ' · o · ' : ' · y · ') : 'Todos los clientes activos.'}
                  {estimate ? ` — hoy son ${formatCount(estimate.total)} personas (${formatCount(estimate.withPushDevice)} con push).` : ''}
                </InlineNotice>
              ) : null}
            </div>
          ) : (
            <AudienceBuilder value={form.audience} purpose={form.purpose} onChange={(audience) => set('audience', audience)} onEstimate={setEstimate} />
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField tooltip="Si el envío empieza ahora o en una fecha programada." kind="select" label="Inicio" name="startMode" hint="«Ahora» empieza en menos de un minuto al programar." value={form.startMode} options={[{ value: 'now', label: 'Enviar en cuanto se programe' }, { value: 'date', label: 'Elegir fecha y hora' }]} onChange={(event) => set('startMode', event.target.value as FormState['startMode'])} />
          {form.startMode === 'date' ? (
            <FormField tooltip="Fecha y hora en que empieza la entrega; antes no se muestra nada." label="Fecha y hora de inicio" name="startsAt" type="datetime-local" required hint="Hora de Bolivia." value={form.startsAt} onChange={(event) => set('startsAt', event.target.value)} />
          ) : <div />}
          <FormField tooltip="Fecha y hora en que termina la entrega; vacío = hasta agotar presupuesto." label="Fin de la campaña (opcional)" name="endsAt" type="datetime-local" hint="Al llegar, deja de enviar y el aviso desaparece de la bandeja. Vacío = sin fecha de fin." value={form.endsAt} onChange={(event) => set('endsAt', event.target.value)} />
          <FormField tooltip="Avisos por minuto; repartir el envío evita picos de soporte." kind="select" label="Cadencia de envío" name="ratePerMinute" hint="Repartir el envío evita picos de soporte y de carga." value={form.ratePerMinute} options={RATE_OPTIONS} onChange={(event) => set('ratePerMinute', event.target.value)} />
          <FormField tooltip="Tope de personas que reciben el aviso; útil para una prueba parcial." label="Tope de destinatarios (opcional)" name="maxRecipients" inputMode="numeric" hint="Útil para una prueba con una parte de la audiencia. Vacío = toda." value={form.maxRecipients} onChange={(event) => set('maxRecipients', event.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-4 text-xs sm:grid-cols-2">
            {[
              ['Campaña', `${form.name} · ${PURPOSE_OPTIONS.find((option) => option.value === form.purpose)?.label.split(' (')[0]}`],
              ['Aviso', form.title],
              ['Canales', form.channels.map((channel) => CHANNEL_META[channel].label).join(', ')],
              ['Audiencia', form.audienceMode === 'segment' ? (selectedSegment?.name ?? '—') : form.audience.rules.length ? form.audience.rules.map(describeRule).join(form.audience.match === 'any' ? ' o ' : ' y ') : 'Todos los clientes activos'],
              ['Inicio', form.startMode === 'now' ? 'Al programar' : formatDateTime(fromLocalInput(form.startsAt))],
              ['Fin', form.endsAt ? formatDateTime(fromLocalInput(form.endsAt)) : 'Sin fecha de fin'],
              ['Cadencia', `${formatCount(Number(form.ratePerMinute))} por minuto${form.maxRecipients ? ` · tope ${formatCount(Number(form.maxRecipients))}` : ''}`],
              ['Personas hoy', estimate ? `${formatCount(estimate.total)} (${formatCount(estimate.withPushDevice)} con push, ${formatCount(estimate.withVerifiedEmail)} con correo)` : 'Calculando…'],
            ].map(([label, value]) => (
              <div key={label}><dt className="font-bold text-slate-500">{label}</dt><dd className="text-slate-900">{value}</dd></div>
            ))}
          </dl>
          {audienceEmpty ? <InlineNotice tone="danger" title="Nadie cumple la audiencia hoy">No se puede programar una campaña sin destinatarios. Ajusta las condiciones.</InlineNotice> : null}
          {estimate && form.channels.includes('push') && estimate.withPushDevice === 0 && estimate.total > 0 ? (
            <InlineNotice tone="warning" title="Nadie recibirá el push">Ninguna persona de la audiencia tiene la app con avisos activados. Sólo llegará por los otros canales.</InlineNotice>
          ) : null}
          {estimate && form.channels.includes('email') && estimate.withVerifiedEmail === 0 && estimate.total > 0 ? (
            <InlineNotice tone="warning" title="Nadie recibirá el correo">Ninguna persona de la audiencia tiene un correo verificado.</InlineNotice>
          ) : null}
          <InlineNotice tone="info">Tras programarla puedes pausarla o cancelarla. Cancelar anula los avisos que aún no salieron; los ya entregados no se retiran.</InlineNotice>
        </div>
      ) : null}

      {errors.length > 0 && step < 3 ? <ul className="mt-3 list-disc pl-5 text-xs text-amber-700">{errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {error ? <InlineNotice tone="danger" title="No se pudo guardar" className="mt-3">{error}</InlineNotice> : null}
    </Modal>
  );
}
