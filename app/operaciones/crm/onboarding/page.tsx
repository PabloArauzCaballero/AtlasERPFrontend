/*
 * Cliente, y no servidor, porque esta pagina pasa una FUNCION (`load`) a un componente de cliente.
 *
 * Un componente de servidor no puede pasar una funcion a uno de cliente —hay que serializarla para
 * cruzar el limite y una funcion no se serializa—, asi que el prerender fallaba con «Functions
 * cannot be passed directly to Client Components» y tumbaba la construccion entera.
 */
'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { LegalContractNotice } from '@/components/screens/LegalContractNotice';
import { OnboardingChecklistEvidenceModal } from '@/components/screens/OnboardingChecklistEvidenceModal';
import { OnboardingQueueDashboard, type OnboardingScope } from '@/components/screens/OnboardingQueueDashboard';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAuth } from '@/lib/authContext';
import { b2bService } from '@/services/b2bService';
import { portalService } from '@/services/portalService';
import { engineExecutionUrl, engineManualReviewUrl } from '@/lib/engineLinks';
import type { JsonObject, ResourceRow } from '@/services/types';

const ESTADO_FINAL = 'COMPLETED';
/**
 * Desde qué estados se puede (volver a) pedir la verificación al Motor. Espejo del backend.
 * `EN_VERIFICACION` está porque la llamada es síncrona: un caso que se quedó ahí es uno que no
 * recibió veredicto (AtlasBackend o el Motor no respondieron) y hay que poder volver a pedir.
 */
const PUEDE_PEDIR_VERIFICACION = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RECHAZADO', 'EN_VERIFICACION']);
/**
 * Los permisos RBAC de AtlasBackend que exigen las dos acciones que cruzan al otro lado. El ERP
 * concede sus rutas por rol de negocio (`ADMIN`, `OPERATIONS`…), pero AtlasBackend decide por
 * permiso y los vocabularios no coinciden: un `SYSTEMS_ADMIN` es `ADMIN` aquí y no lleva
 * `partner.kyb.request`. Ofrecer el botón y recibir un 403 era la promesa rota; el permiso viene
 * en `auth/me`, así que sólo se ofrece lo que AtlasBackend va a dejar pasar.
 */
const PERMISO_PEDIR_VERIFICACION = 'partner.kyb.request';
const PERMISO_PEDIR_CREDENCIALES = 'merchant.users.request';
/** Estados en los que el desenlace puede cambiar sin que el ERP haga nada: hay que ir a mirar. */
const ESPERA_AL_MOTOR = new Set(['EN_VERIFICACION', 'REVISION_MANUAL']);

/** Opción vacía de los filtros opcionales de la regla de comisión: vacío es «aplica a todos». */
const CUALQUIERA = '— Cualquiera —';

/*
 * Roles del comercio, estados del requisito, categorías y segmentos de riesgo salen de
 * `GET /catalog/domains`: eran listas copiadas aquí que había que mantener a mano en paralelo al
 * esquema del backend.
 */

/**
 * Onboarding de comercios: la cola y su tablero; el alta, en su propia página (`/crear`).
 *
 * Tenía cuatro pestañas que eran cuatro trabajos distintos apilados —la cola, el alta, pedir
 * credenciales y las reglas de comisión— y nada ataba las dos últimas al caso que se estaba
 * tramitando: se elegía el comercio otra vez en un desplegable. Ahora todo lo que se hace SOBRE un
 * caso se hace desde su fila, que es donde ya se sabe de qué comercio se habla.
 *
 * Sin pestañas: «Nuevo caso» era un verbo en la barra de secciones y dejaba «Casos» como la única
 * sección de verdad. El alta lleva un checklist de líneas, así que es una página; su botón va en la
 * cabecera, al lado de la ayuda, que es donde viven las acciones de la pantalla.
 */
export default function OnboardingPage() {
  const { hasPermission } = useAuth();
  const puedePedirVerificacion = hasPermission(PERMISO_PEDIR_VERIFICACION);
  const puedePedirCredenciales = hasPermission(PERMISO_PEDIR_CREDENCIALES);
  /* El caso cuyo requisito se está respaldando con un archivo; `null` cierra el modal. */
  const [evidenciaDe, setEvidenciaDe] = useState<ResourceRow | null>(null);
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
        actions={
          <Link href="/operaciones/crm/onboarding/crear" data-testid="onboarding-nuevo-caso" data-tutorial-id="directory-create" className="inline-flex">
            <AtlasButton icon="add" tabIndex={-1}>Nuevo caso</AtlasButton>
          </Link>
        }
      />
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
          emptyHint={scope === 'abiertos' ? 'No hay casos pendientes. Abre uno con el botón «Nuevo caso».' : 'Todavía no hay comercios activados.'}
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
          extraActions={[
            {
              key: 'requisito',
              label: 'Mover un requisito',
              icon: 'task_alt',
              /*
               * Las TRES que se quedan en la fila; el resto vive en «Más acciones», con su nombre.
               *
               * El criterio es cuántas veces se pulsa y qué pasa si no la encuentras: mover un
               * requisito se hace muchas veces por caso, dar acceso es lo que desbloquea al
               * comercio y activar es el final del trámite. Pedir la verificación al Motor, pactar
               * contrato o comisión se hacen UNA vez y se leen mejor con su nombre escrito que como
               * un cuadradito más en un carril de siete.
               */
              primary: true,
              enabled: abierto,
              form: {
                title: (row) => `Requisitos de ${String(row.tradeName ?? 'este comercio')}`,
                description: 'Completar, eximir o bloquear un requisito de este caso. La activación vuelve a comprobarlos todos.',
                fields: (row) => [
                  {
                    name: 'checklistItemId',
                    label: 'Requisito', tooltip: 'Requisito del checklist de alta sobre el que se actúa.',
                    type: 'select',
                    required: true,
                    span: 2,
                    options: requisitos(row).map((item) => ({
                      value: String(item.id),
                      label: `${String(item.description)} (${String(item.itemType)}) · ${item.status === 'COMPLETED' ? 'completado' : item.status === 'WAIVED' ? 'eximido' : item.status === 'BLOCKED' ? 'bloqueado' : 'pendiente'}${item.hasEvidence ? ', con archivo' : item.requiresEvidence ? ', falta el archivo' : ''}`,
                    })),
                  },
                  {
                    name: 'status',
                    label: 'Nuevo estado', tooltip: 'Estado del registro; decide qué acciones se permiten sobre él y si aparece en los listados operativos.',
                    type: 'select',
                    required: true,
                    span: 2,
                    defaultValue: 'COMPLETED',
                    optionsSource: 'domain:crm.checklistStatus',
                  },
                ],
                submit: (row, payload: JsonObject) => b2bService.updateChecklist(String(row.id ?? ''), payload),
                submitLabel: 'Actualizar requisito',
              },
            },
            {
              key: 'evidencia',
              label: 'Adjuntar archivo de un requisito',
              icon: 'upload_file',
              enabled: abierto,
              /* Abre el modal con el archivo; los formularios de fila no admiten adjuntos. */
              silent: true,
              run: async (row) => {
                setEvidenciaDe(row);
              },
            },
            {
              key: 'enlazar',
              label: 'Enlazar expediente de Atlas',
              icon: 'link',
              /* Sólo mientras no hay puente: pedir la verificación lo intenta solo, pero así se ve POR QUÉ falla (por cuenta, luego por NIT). */
              enabled: (row) => abierto(row) && puedePedirVerificacion && !row.partnerProfileId,
              run: (row) => b2bService.linkPartnerProfile(String(row.id ?? '')),
            },
            {
              key: 'verificar',
              label: 'Pedir verificación al Motor',
              icon: 'verified_user',
              enabled: (row) => puedePedirVerificacion && PUEDE_PEDIR_VERIFICACION.has(String(row.status ?? '')),
              form: {
                title: (row) => `Verificación KYB de ${String(row.tradeName ?? 'este comercio')}`,
                description: 'El ERP lo pide y lo decide la revisión de riesgo de Atlas. Sin su aprobación el comercio no se activa. Si el comercio no tiene expediente en Atlas, tiene que abrirlo desde su portal.',
                fields: [{ name: 'reason', label: 'Motivo (opcional)', tooltip: 'Motivo del cambio, opcional; queda en el historial del caso.', type: 'textarea', optional: true, span: 2, placeholder: 'Por qué se pide ahora: alta comercial, reintento tras corregir…' }],
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
                    label: 'Versión de contrato', tooltip: 'Versión del contrato de la que cuelga la regla de comisión.',
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
                  { name: 'ratePercent', label: 'Comisión (%)', tooltip: 'Comisión (MDR) en porcentaje sobre cada venta. Ej.: 3.', type: 'number', valueKind: 'number', required: true, placeholder: '3.50' },
                  { name: 'productCategory', label: 'Categoría de producto', tooltip: 'Categoría del producto vendido; decide la comisión que aplica.', type: 'select', optional: true, optionsSource: 'domain:crm.merchantCategory', emptyOption: CUALQUIERA, hint: 'Vacío: aplica a todas.' },
                  { name: 'riskSegment', label: 'Segmento de riesgo', tooltip: 'Segmento de riesgo del cliente al que aplica la regla; vacío = todos.', type: 'select', optional: true, optionsSource: 'domain:crm.riskTier', emptyOption: CUALQUIERA, hint: 'Vacío: aplica a todos.' },
                  { name: 'minFeeAmount', label: 'Piso (Bs)', tooltip: 'Comisión mínima en bolivianos por venta, aunque el porcentaje dé menos.', type: 'number', valueKind: 'number', optional: true },
                  { name: 'maxFeeAmount', label: 'Techo (Bs)', tooltip: 'Comisión máxima en bolivianos por venta, aunque el porcentaje dé más.', type: 'number', valueKind: 'number', optional: true },
                ],
                submit: (row, payload: JsonObject) => b2bService.createCaseMdrRule(String(row.id ?? ''), payload),
                submitLabel: 'Pactar comisión',
              },
            },
            {
              key: 'credenciales',
              label: 'Dar acceso a una persona',
              icon: 'person_add',
              primary: true,
              /*
               * Pide el acceso a Atlas: la identidad la concede el portal interno, no el ERP.
               *
               * El 2026-09-17 se retiró el botón en cuanto había un acceso concedido o en espera,
               * porque la fila decía «1 concedida» y el botón seguía ahí como si faltara pedirlo.
               * La corrección se pasó de largo: un comercio tiene MÁS de una persona —el dueño y la
               * gente de cada caja—, así que al conceder el primero el ERP se quedaba sin forma de
               * dar de alta al segundo (Pablo, 2026-09-18: «no puedo crear un usuario partner»).
               *
               * Lo que estaba mal no era ofrecerlo, era cómo se leía: «Pedir credenciales» suena a
               * trámite único. «Dar acceso a una persona» se lee igual de bien con cero accesos que
               * con cuatro, y el formulario dice cuántos hay ya para que nadie lo pida dos veces.
               */
              enabled: (row) => abierto(row) && puedePedirCredenciales,
              form: {
                title: (row) => `Acceso al portal para ${String(row.tradeName ?? 'el comercio')}`,
                description: (row) => {
                  const c = (row.credentials ?? {}) as { concedidas?: number; pendientes?: number };
                  const concedidas = Number(c.concedidas ?? 0);
                  const pendientes = Number(c.pendientes ?? 0);
                  const yaHay = [
                    concedidas ? `${concedidas} acceso(s) ya concedido(s)` : '',
                    pendientes ? `${pendientes} esperando aprobación` : '',
                  ].filter(Boolean).join(' y ');
                  return `Se registra a la persona en el CRM y se encola su acceso. La contraseña la genera Atlas al aprobar; el ERP nunca la ve.${yaHay ? ` Este comercio tiene ${yaHay}: cada persona entra con su propio correo.` : ''}`;
                },
                fields: (row) => [
                  { name: 'fullName', label: 'Nombre completo', tooltip: 'Nombre y apellidos completos de la persona, como en su documento de identidad.', required: true, placeholder: 'Nombre del responsable' },
                  { name: 'email', label: 'Correo corporativo', tooltip: 'Correo corporativo del usuario del comercio; ahí llegan las credenciales.', type: 'email', required: true, placeholder: 'usuario@empresa.com' },
                  { name: 'roleCode', label: 'Rol', tooltip: 'Papel del socio frente a la entidad legal: cliente, proveedor, acreedor…', type: 'select', required: true, defaultValue: 'MERCHANT_OPERATOR', optionsSource: 'domain:portal.merchantUserRole' },
                  {
                    name: 'branchId',
                    label: 'Sucursal', tooltip: 'Sucursal del comercio; sólo las habilitadas pueden originar operaciones.',
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
              primary: true,
              /* La compuerta dura la aplica el backend; aquí sólo no se ofrece lo que va a rechazar. */
              enabled: (row) => abierto(row) && String(row.decisionOutcome ?? '') === 'APROBADO',
              run: async (row) => {
                const result = await b2bService.activateOnboarding(String(row.id ?? ''), {});
                summary.reload();
                return result;
              },
              confirm: {
                title: 'Activar el comercio',
                message: 'Atlas vuelve a comprobar la aprobación de riesgo, los requisitos y el contrato vigente: si falta algo, rechaza la activación. Al activarlo, el caso sale de la cola y pasa a «Activados».',
                confirmLabel: 'Activar',
              },
            },
          ]}
          notice={{
            tone: 'info',
            title: 'Un caso de onboarding no se borra',
            body:
              'Es el expediente de por qué se habilitó un comercio. Al activarlo deja de ser trabajo pendiente y pasa a «Activados»; mientras tanto, todo lo que se hace sobre él se hace desde su fila.' +
              (puedePedirVerificacion && puedePedirCredenciales
                ? ''
                : ` Tu sesión de Atlas no lleva ${[!puedePedirVerificacion ? `«${PERMISO_PEDIR_VERIFICACION}» (pedir la verificación al Motor)` : '', !puedePedirCredenciales ? `«${PERMISO_PEDIR_CREDENCIALES}» (dar acceso a una persona)` : ''].filter(Boolean).join(' ni ')}: esas acciones no se ofrecen. Las llevan OPERATIONS_MANAGER y SUPER_ADMIN.`),
          }}
        />
      </div>
      <OnboardingChecklistEvidenceModal
        caso={evidenciaDe}
        onClose={() => setEvidenciaDe(null)}
        onDone={() => {
          recargar();
          summary.reload();
        }}
      />
    </div>
  );
}
