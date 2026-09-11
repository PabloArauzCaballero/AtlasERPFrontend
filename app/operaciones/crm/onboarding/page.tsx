/*
 * Cliente, y no servidor, porque esta pagina pasa una FUNCION (`load`) a un componente de cliente.
 *
 * Un componente de servidor no puede pasar una funcion a uno de cliente —hay que serializarla para
 * cruzar el limite y una funcion no se serializa—, asi que el prerender fallaba con «Functions
 * cannot be passed directly to Client Components» y tumbaba la construccion entera.
 */
'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { LegalContractNotice } from '@/components/screens/LegalContractNotice';
import { OnboardingCaseScreen } from '@/components/screens/OnboardingCaseScreen';
import { OnboardingQueueDashboard, type OnboardingScope } from '@/components/screens/OnboardingQueueDashboard';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { b2bService } from '@/services/b2bService';
import { portalService } from '@/services/portalService';
import { merchantCategoryOptions, riskTierOptions } from '@/lib/catalogs';
import { engineExecutionUrl, engineManualReviewUrl } from '@/lib/engineLinks';
import type { JsonObject, ResourceRow } from '@/services/types';

const ESTADO_FINAL = 'COMPLETED';
/** Desde qué estados se puede (volver a) pedir la verificación al Motor. Espejo del backend. */
const PUEDE_PEDIR_VERIFICACION = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RECHAZADO']);
/** Estados en los que el desenlace puede cambiar sin que el ERP haga nada: hay que ir a mirar. */
const ESPERA_AL_MOTOR = new Set(['EN_VERIFICACION', 'REVISION_MANUAL']);

const CUALQUIERA = { label: '— Cualquiera —', value: '' };

const ROLES_DEL_COMERCIO = [
  { label: 'Administrador del comercio', value: 'MERCHANT_ADMIN' },
  { label: 'Gerente de sucursal', value: 'BRANCH_MANAGER' },
  { label: 'Operador', value: 'MERCHANT_OPERATOR' },
  { label: 'Auditor financiero', value: 'FINANCIAL_AUDITOR' },
];

/**
 * Onboarding de comercios: la cola y su tablero primero; el alta, en su pestaña.
 *
 * Tenía cuatro pestañas que eran cuatro trabajos distintos apilados —la cola, el alta, pedir
 * credenciales y las reglas de comisión— y nada ataba las dos últimas al caso que se estaba
 * tramitando: se elegía el comercio otra vez en un desplegable. Ahora todo lo que se hace SOBRE un
 * caso se hace desde su fila, que es donde ya se sabe de qué comercio se habla.
 */
export default function OnboardingPage() {
  const [tab, setTab] = useState('casos');
  const [scope, setScope] = useState<OnboardingScope>('abiertos');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  /*
   * Al abrir la cola se acusan las credenciales pendientes: por cada caso que espera al portal se
   * pregunta a Atlas en qué quedó, y si algo cambió se vuelve a leer la lista. Es el aviso que antes
   * no llegaba nunca. Si la sesión no lleva token de Atlas, el acuse falla en silencio y la lista
   * se enseña igual: la cola no puede depender de eso para pintarse.
   */
  const load = useCallback(async () => {
    const primera = await b2bService.listOnboardingCases({ scope, limit: 200 });
    const filas = primera.items ?? [];
    const esperando = filas.some((row) => ESPERA_AL_MOTOR.has(String(row.status ?? '')) || Number((row.credentials as { pendientes?: number } | undefined)?.pendientes ?? 0) > 0);
    if (!esperando) return primera;
    // UNA llamada para todo lo pendiente; sin token de Atlas falla en silencio y la cola se pinta igual.
    const acuse = await b2bService.reconcilePendingCases().catch(() => null);
    return Number(acuse?.cambiados ?? 0) > 0 ? b2bService.listOnboardingCases({ scope, limit: 200 }) : primera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useAsyncResource(useCallback(() => b2bService.summarizeOnboardingCases(), [version]));

  const abierto = (row: ResourceRow) => String(row.status ?? '') !== ESTADO_FINAL;
  const requisitos = (row: ResourceRow) => (Array.isArray(row.checklistItems) ? (row.checklistItems as ResourceRow[]) : []);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Onboarding' }]}
        title="Casos de onboarding"
        description="Requisitos legales, operativos y técnicos de cada comercio antes de habilitarlo para operar."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'casos',
            label: 'Casos',
            icon: 'table_view',
            badge: summary.data ? Number(summary.data.abiertos ?? 0) : undefined,
            content: (
              <div className="space-y-5">
                <OnboardingQueueDashboard
                  summary={(summary.data ?? null) as ResourceRow | null}
                  loading={summary.status === 'loading' || summary.status === 'idle'}
                  scope={scope}
                  onScopeChange={setScope}
                />
                <LegalContractNotice />
                <CrudDirectory
                  embedded
                  moduleLabel="CRM"
                  title={scope === 'historial' ? 'Comercios activados' : scope === 'todos' ? 'Todos los casos' : 'Casos por atender'}
                  description={scope === 'abiertos' ? 'Lo que falta por hacer en cada expediente. Se opera desde la fila.' : 'Expedientes cerrados: por qué se habilitó cada comercio.'}
                  load={load}
                  labelKey="tradeName"
                  searchPlaceholder="Buscar por comercio o estado…"
                  emptyHint={scope === 'abiertos' ? 'No hay casos pendientes. Abre uno desde la pestaña «Nuevo caso».' : 'Todavía no hay comercios activados.'}
                  columns={[
                    { key: 'tradeName', label: 'Comercio' },
                    { key: 'status', label: 'Estado', kind: 'status' },
                    { key: 'pendingItems', label: 'Requisitos pendientes', align: 'right' },
                    { key: 'decisionOutcome', label: 'Motor', kind: 'status' },
                    { key: 'decisionReason', label: 'Motivo del Motor' },
                    { key: 'contractNumber', label: 'Contrato', kind: 'mono' },
                    { key: 'credentialsSummary', label: 'Credenciales' },
                    { key: 'startedAt', label: 'Iniciado', kind: 'date' },
                    ...(scope === 'abiertos' ? [] : [{ key: 'completedAt', label: 'Activado', kind: 'date' as const }]),
                  ]}
                  filters={[{ key: 'status', label: 'Estado' }]}
                  create={{ label: 'Nuevo caso', onClick: () => setTab('nuevo') }}
                  extraActions={[
                    {
                      key: 'requisito',
                      label: 'Mover un requisito',
                      icon: 'task_alt',
                      enabled: abierto,
                      form: {
                        title: (row) => `Requisitos de ${String(row.tradeName ?? 'este comercio')}`,
                        description: 'Completar, eximir o bloquear un requisito de este caso. La activación vuelve a comprobarlos todos.',
                        fields: (row) => [
                          {
                            name: 'checklistItemId',
                            label: 'Requisito',
                            type: 'select',
                            required: true,
                            span: 2,
                            options: requisitos(row).map((item) => ({ value: String(item.id), label: `${String(item.itemType)} · ${String(item.description)} — ${String(item.status)}` })),
                          },
                          {
                            name: 'status',
                            label: 'Nuevo estado',
                            type: 'select',
                            required: true,
                            span: 2,
                            defaultValue: 'COMPLETED',
                            options: [
                              { label: 'Completado', value: 'COMPLETED' },
                              { label: 'Eximido', value: 'WAIVED' },
                              { label: 'Bloqueado', value: 'BLOCKED' },
                              { label: 'Pendiente', value: 'PENDING' },
                            ],
                          },
                        ],
                        submit: (row, payload: JsonObject) => b2bService.updateChecklist(String(row.id ?? ''), payload),
                        submitLabel: 'Actualizar requisito',
                      },
                    },
                    {
                      key: 'verificar',
                      label: 'Pedir verificación al Motor',
                      icon: 'verified_user',
                      enabled: (row) => PUEDE_PEDIR_VERIFICACION.has(String(row.status ?? '')),
                      form: {
                        title: (row) => `Verificación KYB de ${String(row.tradeName ?? 'este comercio')}`,
                        description: 'El ERP pide; decide AtlasBackend con el artefacto PARTNER_KYB_REVIEW del Motor. Sin su APROBADO el comercio no se activa. Si el comercio no tiene expediente en Atlas, tiene que abrirlo desde su portal.',
                        fields: [{ name: 'reason', label: 'Motivo (opcional)', type: 'textarea', optional: true, span: 2, placeholder: 'Por qué se pide ahora: alta comercial, reintento tras corregir…' }],
                        submit: (row, payload: JsonObject) => b2bService.requestKybReview(String(row.id ?? ''), payload),
                        submitLabel: 'Pedir verificación',
                      },
                    },
                    {
                      key: 'ejecucion',
                      label: 'Ver ejecución en el Motor',
                      icon: 'open_in_new',
                      enabled: (row) => engineExecutionUrl(String(row.decisionExecutionId ?? '') || null) !== null,
                      href: (row) => engineExecutionUrl(String(row.decisionExecutionId ?? '')) ?? '#',
                    },
                    {
                      key: 'caso-motor',
                      label: 'Ver caso de revisión manual',
                      icon: 'rule',
                      enabled: (row) => engineManualReviewUrl(String(row.manualReviewCaseCode ?? '') || null) !== null,
                      href: (row) => engineManualReviewUrl(String(row.manualReviewCaseCode ?? '')) ?? '#',
                    },
                    {
                      key: 'sincronizar',
                      label: 'Actualizar verificación',
                      icon: 'sync',
                      enabled: (row) => ESPERA_AL_MOTOR.has(String(row.status ?? '')),
                      run: async (row) => {
                        const result = await b2bService.syncKybDecision(String(row.id ?? ''));
                        summary.reload();
                        return result;
                      },
                    },
                    {
                      key: 'contrato',
                      label: 'Pactar contrato',
                      icon: 'draw',
                      enabled: abierto,
                      form: {
                        title: (row) => `Contrato del alta de ${String(row.tradeName ?? 'este comercio')}`,
                        description: 'Sólo versiones de contratos de este mismo comercio. La activación exige que la pactada esté activa y vigente.',
                        fields: (row) => [
                          {
                            name: 'contractVersionId',
                            label: 'Versión de contrato',
                            type: 'select',
                            required: true,
                            span: 2,
                            defaultValue: String(row.contractVersionId ?? ''),
                            optionsLoader: async () => {
                              const versions = await b2bService.listCaseContractOptions(String(row.id ?? ''));
                              if (!versions.length) return [{ label: '— Este comercio no tiene contratos: genera uno en CRM › Contratos —', value: '' }];
                              return versions.map((version) => ({
                                value: String(version.id),
                                label: `${String(version.contractNumber ?? 'Contrato')} · v${String(version.versionNumber ?? '?')} · ${String(version.status)}${version.vigente ? ' · vigente' : ' · NO activable'}`,
                              }));
                            },
                          },
                        ],
                        submit: (row, payload: JsonObject) => b2bService.assignCaseContract(String(row.id ?? ''), payload),
                        submitLabel: 'Pactar contrato',
                      },
                    },
                    {
                      key: 'comision',
                      label: 'Pactar comisión (MDR)',
                      icon: 'percent',
                      /* Sin contrato pactado no hay de dónde colgarla: el backend lo rechaza y aquí ni se ofrece. */
                      enabled: (row) => abierto(row) && Boolean(row.contractVersionId),
                      form: {
                        title: (row) => `Comisión por venta de ${String(row.tradeName ?? 'este comercio')}`,
                        description: 'Lo que Atlas cobra por cada venta, sobre el contrato pactado en este caso. Gana la regla más específica.',
                        fields: [
                          { name: 'ratePercent', label: 'Comisión (%)', type: 'number', valueKind: 'number', required: true, placeholder: '3.50' },
                          { name: 'productCategory', label: 'Categoría de producto', type: 'select', optional: true, options: [CUALQUIERA, ...merchantCategoryOptions], hint: 'Vacío: aplica a todas.' },
                          { name: 'riskSegment', label: 'Segmento de riesgo', type: 'select', optional: true, options: [CUALQUIERA, ...riskTierOptions], hint: 'Vacío: aplica a todos.' },
                          { name: 'minFeeAmount', label: 'Piso (Bs)', type: 'number', valueKind: 'number', optional: true },
                          { name: 'maxFeeAmount', label: 'Techo (Bs)', type: 'number', valueKind: 'number', optional: true },
                        ],
                        submit: (row, payload: JsonObject) => b2bService.createCaseMdrRule(String(row.id ?? ''), payload),
                        submitLabel: 'Pactar comisión',
                      },
                    },
                    {
                      key: 'credenciales',
                      label: 'Pedir credenciales',
                      icon: 'person_add',
                      enabled: abierto,
                      /* Pide el acceso a Atlas: la identidad la concede el portal interno, no el ERP. */
                      form: {
                        title: (row) => `Acceso al portal para ${String(row.tradeName ?? 'el comercio')}`,
                        description: 'Se registra a la persona en el CRM y se encola su acceso. La contraseña la genera Atlas al aprobar; el ERP nunca la ve.',
                        fields: (row) => [
                          { name: 'fullName', label: 'Nombre completo', required: true, placeholder: 'Nombre del responsable' },
                          { name: 'email', label: 'Correo corporativo', type: 'email', required: true, placeholder: 'usuario@empresa.com' },
                          { name: 'roleCode', label: 'Rol', type: 'select', required: true, defaultValue: 'MERCHANT_OPERATOR', options: ROLES_DEL_COMERCIO },
                          {
                            name: 'branchId',
                            label: 'Sucursal',
                            type: 'select',
                            optional: true,
                            hint: 'Vacío: alcance global sobre el comercio.',
                            optionsLoader: async () => {
                              const rows = await portalService.listBranches(String(row.accountId ?? ''));
                              return [{ label: '— Alcance global —', value: '' }, ...rows.map((branch) => ({ value: String(branch.id), label: String(branch.name ?? 'Sucursal') }))];
                            },
                          },
                        ],
                        submit: (row, payload: JsonObject) => b2bService.createMerchantUser({ accountId: String(row.accountId ?? ''), ...payload }),
                        submitLabel: 'Pedir acceso',
                      },
                    },
                    {
                      key: 'acuse',
                      label: 'Comprobar credenciales',
                      icon: 'sync',
                      /* Sólo cuando hay algo que preguntar: una petición encolada y sin resolver. */
                      enabled: (row) => abierto(row) && Number((row.credentials as { pendientes?: number } | undefined)?.pendientes ?? 0) > 0,
                      run: async (row) => {
                        const result = await b2bService.reconcileCaseIdentity(String(row.id ?? ''));
                        summary.reload();
                        return result;
                      },
                    },
                    {
                      key: 'activar',
                      label: 'Activar comercio',
                      icon: 'rocket_launch',
                      tone: 'success',
                      /* La compuerta dura la aplica el backend; aquí sólo no se ofrece lo que va a rechazar. */
                      enabled: (row) => abierto(row) && String(row.decisionOutcome ?? '') === 'APROBADO',
                      run: async (row) => {
                        const result = await b2bService.activateOnboarding(String(row.id ?? ''), {});
                        summary.reload();
                        return result;
                      },
                      confirm: {
                        title: 'Activar el comercio',
                        message: 'El backend vuelve a comprobar el APROBADO del Motor, los requisitos y el contrato vigente: si falta algo, rechaza la activación. Al activarlo, el caso sale de la cola y pasa a «Activados».',
                        confirmLabel: 'Activar',
                      },
                    },
                  ]}
                  notice={{
                    tone: 'info',
                    title: 'Un caso de onboarding no se borra',
                    body: 'Es el expediente de por qué se habilitó un comercio. Al activarlo deja de ser trabajo pendiente y pasa a «Activados»; mientras tanto, todo lo que se hace sobre él se hace desde su fila.',
                  }}
                />
              </div>
            ),
          },
          {
            id: 'nuevo',
            label: 'Nuevo caso',
            icon: 'add',
            content: (
              <OnboardingCaseScreen
                embedded
                onDone={() => {
                  recargar();
                  setTab('casos');
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
