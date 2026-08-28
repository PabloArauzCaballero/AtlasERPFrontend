'use client';

import { useCallback, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { ConfirmDialog } from '@/components/atlas/ConfirmDialog';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { formatBob, formatDate } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { b2bService } from '@/services/b2bService';
import type { ResourceRow } from '@/services/types';

/**
 * Calificación de riesgo de la cartera B2B.
 *
 * El motor existía entero —matriz ASFI sembrada, arrastre por cliente, previsión por banda y cinco
 * endpoints— y no lo consumía nadie: era una funcionalidad completa y sin superficie. Tampoco
 * arrancaba, porque sus cuatro modelos no estaban atados a la conexión y la primera consulta moría
 * con «Model not initialized», que en pantalla se habría leído como una avería de la base.
 *
 * La pantalla enseña las tres cosas que hacen falta para usarla: en qué categorías está la cartera
 * (con la política que las produjo, porque una distribución sin su matriz no se puede comparar
 * contra la del mes pasado), qué categoría tiene cada cuenta, y de dónde sale la suya —qué deuda
 * concreta la fijó y cómo migró en el tiempo—.
 */

const GRADE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  A: 'success',
  B: 'warning',
  C: 'warning',
  D: 'danger',
  E: 'danger',
  F: 'danger',
};

function n(value: unknown): number {
  return Number(value ?? 0);
}

function s(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function rows(data: unknown): ResourceRow[] {
  if (Array.isArray(data)) return data as ResourceRow[];
  const items = (data as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as ResourceRow[]) : [];
}

export function CreditRatingScreen() {
  const [selected, setSelected] = useState<ResourceRow | null>(null);
  const [barrido, setBarrido] = useState(false);
  const [calificando, setCalificando] = useState<string | null>(null);

  const summary = useAsyncResource(useCallback(() => b2bService.getRatingPortfolioSummary(), []));
  const accounts = useAsyncResource(
    useCallback(() => b2bService.listAccounts({ page: 1, pageSize: 100 }), []),
  );

  const selectedId = s(selected?.id);
  /*
   * Sin cuenta elegida no se pide nada, y una cuenta sin calificación vigente responde 404: eso no
   * es un error de la pantalla —es la respuesta— así que se traduce a «sin datos» en vez de pintar
   * un aviso rojo. Tras recalificar, quien recarga es la propia acción.
   */
  const detail = useAsyncResource(
    useCallback(
      async () => (selectedId ? b2bService.getAccountRating(selectedId).catch(() => null) : null),
      [selectedId],
    ),
  );
  const history = useAsyncResource(
    useCallback(
      async () => (selectedId ? b2bService.getAccountRatingHistory(selectedId).catch(() => null) : null),
      [selectedId],
    ),
  );

  const grades = useMemo(() => rows((summary.data as { grades?: unknown })?.grades), [summary.data]);
  const totals = (summary.data as { totals?: Record<string, unknown> })?.totals ?? {};
  const policy = (summary.data as { policy?: Record<string, unknown> })?.policy ?? {};
  const cuentas = useMemo(() => {
    const list = rows(accounts.data);
    /* Primero las peor calificadas: es lo que se mira antes de un cierre. */
    return [...list].sort((a, b) => s(b.riskRatingGrade).localeCompare(s(a.riskRatingGrade)));
  }, [accounts.data]);

  const calificadas = cuentas.filter((row) => s(row.riskRatingGrade)).length;

  async function recalificar(row: ResourceRow) {
    setCalificando(s(row.id));
    try {
      const result = (await b2bService.rateAccount(s(row.id))) as Record<string, unknown>;
      toast.success('Cuenta recalificada', `${s(row.tradeName || row.legalName)}: categoría ${s(result.grade)}.`);
      await Promise.all([accounts.reload(), summary.reload(), detail.reload(), history.reload()]);
    } catch (error) {
      toast.error('No se pudo recalificar', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setCalificando(null);
    }
  }

  async function recalificarTodo() {
    setBarrido(false);
    try {
      const result = (await b2bService.sweepRatings()) as Record<string, unknown>;
      toast.success(
        'Cartera recalificada',
        `${n(result.rated)} de ${n(result.accounts)} cuentas; ${n(result.failed)} con error.`,
      );
      await Promise.all([accounts.reload(), summary.reload()]);
    } catch (error) {
      toast.error('No se pudo recalificar la cartera', error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  const rating = detail.data as Record<string, unknown> | null;
  const deudas = rows((rating as { receivables?: unknown })?.receivables);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Calificación de riesgo' }]}
        title="Calificación de riesgo de la cartera"
        description="En qué categoría está cada cuenta por cobrar y cuánta previsión exige. La categoría del cliente arrastra la PEOR de sus deudas cuando la política lo dice."
        actions={
          <>
            <AtlasButton variant="secondary" icon="refresh" loading={summary.status === 'loading'} onClick={() => { void summary.reload(); void accounts.reload(); }}>
              Actualizar
            </AtlasButton>
            <AtlasButton icon="rule" onClick={() => setBarrido(true)}>Recalificar toda la cartera</AtlasButton>
          </>
        }
      />

      {summary.error ? (
        <InlineNotice tone="danger" title="No se pudo leer la cartera calificada">
          {summary.error.includes('RATING_POLICY_NOT_ACTIVE')
            ? 'No hay una política de calificación activa. Se siembra con «yarn db:seed:crm» (matriz ASFI).'
            : summary.error}
        </InlineNotice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Deudas calificadas" value={n(totals.receivableCount) || '—'} detail="Cuentas por cobrar con categoría vigente" icon="fact_check" />
        <MetricCard label="Exposición" value={formatBob(n(totals.exposureAmount))} detail="Saldo abierto calificado" icon="account_balance" tone="teal" />
        <MetricCard label="Previsión" value={formatBob(n(totals.provisionAmount))} detail="Lo que la matriz exige provisionar" icon="savings" tone="amber" />
        <MetricCard label="Cuentas con categoría" value={`${calificadas} / ${cuentas.length}`} detail="Las demás no tienen deuda abierta" icon="domain" tone="purple" />
      </div>

      <Panel
        title="Cartera por categoría"
        description={`Política ${s(policy.policyCode) || '—'} ${s(policy.versionCode)} · escala ${s(policy.scaleCode) || '—'}${policy.contaminationEnabled ? ' · con arrastre al cliente' : ' · sin arrastre'}`}
        icon="donut_large"
      >
        {grades.length === 0 ? (
          <p className="text-xs text-slate-500">Sin deudas calificadas todavía. «Recalificar toda la cartera» las califica con la política vigente.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="grid grid-cols-[80px_1.4fr_0.8fr_1fr_1fr] bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
              <span>Categoría</span><span>Significado</span><span className="text-right">Deudas</span><span className="text-right">Exposición</span><span className="text-right">Previsión</span>
            </div>
            <div className="divide-y divide-slate-100">
              {grades.map((row) => (
                <div key={s(row.grade)} className="grid grid-cols-[80px_1.4fr_0.8fr_1fr_1fr] items-center px-4 py-3 text-xs">
                  <span><StatusPill tone={GRADE_TONE[s(row.grade)] ?? 'neutral'}>{s(row.grade)}</StatusPill></span>
                  <span className="truncate text-slate-700">{s(row.gradeLabel)}</span>
                  <span className="text-right tabular-nums text-slate-700">{n(row.receivableCount)}</span>
                  <span className="text-right tabular-nums text-slate-700">{formatBob(n(row.exposureAmount))}</span>
                  <span className="text-right tabular-nums font-semibold text-slate-800">{formatBob(n(row.provisionAmount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Cuentas" description="Categoría vigente de cada cuenta B2B. Pulsa una para ver de dónde sale la suya." icon="domain">
          {accounts.error ? (
            <InlineNotice tone="danger" title="No se pudo cargar el directorio">{accounts.error}</InlineNotice>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[2fr_90px_1.1fr_110px] bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                <span>Cuenta</span><span>Categoría</span><span>Calificada</span><span />
              </div>
              {cuentas.length === 0 && accounts.status !== 'loading' ? (
                <div className="grid min-h-40 place-items-center p-8 text-center">
                  <div>
                    <Icon name="domain_disabled" className="text-[34px] text-slate-400" />
                    <p className="mt-2 text-xs font-bold text-slate-600">Sin cuentas B2B</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cuentas.map((row) => {
                    const grade = s(row.riskRatingGrade);
                    const activa = s(row.id) === selectedId;
                    return (
                      <div
                        key={s(row.id)}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(row)}
                        onKeyDown={(event) => { if (event.key === 'Enter') setSelected(row); }}
                        className={`grid cursor-pointer grid-cols-[2fr_90px_1.1fr_110px] items-center px-4 py-3 text-xs transition-colors ${activa ? 'bg-primary-wash' : 'hover:bg-slate-50'}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{s(row.tradeName || row.legalName)}</p>
                          <p className="truncate text-[11px] text-slate-500">{s(row.category || row.industry) || 'Sin rubro'}</p>
                        </div>
                        <span>
                          {grade ? <StatusPill tone={GRADE_TONE[grade] ?? 'neutral'}>{grade}</StatusPill> : <span className="text-slate-400">—</span>}
                        </span>
                        <span className="text-slate-600">{row.riskRatingUpdatedAt ? formatDate(s(row.riskRatingUpdatedAt)) : 'Nunca'}</span>
                        <span className="text-right">
                          <AtlasButton
                            variant="secondary"
                            className="h-7 px-2 text-[10px]"
                            loading={calificando === s(row.id)}
                            onClick={(event) => { event.stopPropagation(); void recalificar(row); }}
                          >
                            Recalificar
                          </AtlasButton>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Por qué esa categoría" description={selected ? s(selected.tradeName || selected.legalName) : 'Elige una cuenta en la tabla'} icon="help_center">
            {!selected ? (
              <p className="text-xs text-slate-500">La categoría de un cliente sale de sus deudas abiertas. Aquí se ve cuál se la fijó.</p>
            ) : !rating ? (
              <p className="text-xs text-slate-500">Esta cuenta no tiene calificación vigente: no tiene deuda abierta que calificar.</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <StatusPill tone={GRADE_TONE[s(rating.grade)] ?? 'neutral'}>{s(rating.grade)}</StatusPill>
                  <span className="font-semibold text-slate-700">{s(rating.gradeLabel)}</span>
                  {rating.previousGrade ? <span className="text-slate-500">(antes {s(rating.previousGrade)})</span> : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Mora máxima</dt><dd className="tabular-nums">{n(rating.worstDaysPastDue)} días</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Deudas calificadas</dt><dd className="tabular-nums">{n(rating.ratedReceivableCount)}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Exposición</dt><dd className="tabular-nums">{formatBob(n(rating.totalExposureAmount))}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Previsión</dt><dd className="tabular-nums">{formatBob(n(rating.totalProvisionAmount))}</dd></div>
                </dl>
                <p className="text-[11px] text-slate-500">Motivo: {s(rating.ratingReason) || '—'} · calificada el {formatDate(s(rating.ratedAt))}</p>
                {deudas.length ? (
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="grid grid-cols-[60px_1fr_1fr] bg-slate-50 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                      <span>Cat.</span><span className="text-right">Mora</span><span className="text-right">Exposición</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {deudas.map((row) => (
                        <div key={s(row.id)} className={`grid grid-cols-[60px_1fr_1fr] items-center px-3 py-2 ${s(row.receivableId) === s(rating.drivingReceivableId) ? 'bg-amber-50' : ''}`}>
                          <span><StatusPill tone={GRADE_TONE[s(row.grade)] ?? 'neutral'}>{s(row.grade)}</StatusPill></span>
                          <span className="text-right tabular-nums text-slate-600">{n(row.daysPastDue)} d</span>
                          <span className="text-right tabular-nums text-slate-700">{formatBob(n(row.exposureAmount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {rating.drivingReceivableId ? (
                  <p className="text-[11px] text-slate-500">La fila resaltada es la deuda que fijó la categoría.</p>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel title="Cómo migró" description="Con la política vigente en cada corte: un cambio de categoría puede ser deterioro o cambio de regla." icon="history">
            {rows((history.data as { items?: unknown })?.items).length === 0 ? (
              <p className="text-xs text-slate-500">Sin historial para esta cuenta.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {rows((history.data as { items?: unknown })?.items).map((row) => (
                  <li key={s(row.id)} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <StatusPill tone={GRADE_TONE[s(row.grade)] ?? 'neutral'}>{s(row.grade)}</StatusPill>
                      <span className="text-slate-600">{n(row.worstDaysPastDue)} días de mora</span>
                    </span>
                    <span className="text-slate-500">{formatDate(s(row.ratedAt))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {barrido ? (
        <ConfirmDialog
          open
          title="Recalificar toda la cartera"
          message="Se recalifica cada cuenta con deuda abierta usando la política vigente. Es lo que se hace antes de un cierre o después de activar una política nueva; no cambia saldos, sólo categorías y previsiones."
          confirmLabel="Recalificar"
          onConfirm={() => void recalificarTodo()}
          onCancel={() => setBarrido(false)}
        />
      ) : null}
    </div>
  );
}
