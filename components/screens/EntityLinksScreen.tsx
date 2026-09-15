'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { ConfirmDialog } from '@/components/atlas/ConfirmDialog';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { formatDate } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { accountingService } from '@/services/accountingService';
import {
  loadAccountingBranches,
  loadAccountingDocuments,
  loadBankAccounts,
  loadBusinessPartners,
  loadContracts,
  loadCostCenters,
  loadLedgers,
  loadLegalEntities,
  loadProfitCenters,
  loadTaxCodes,
  type Option,
} from '@/services/optionLoaders';
import type { JsonObject, PaginatedResult, ResourceRow } from '@/services/types';

/**
 * Vínculos multientidad de cuentas GL y de asientos.
 *
 * Los cinco endpoints existían —listar, crear y borrar el vínculo de una cuenta GL, y listar y
 * crear el de un asiento—, tres de ellos ya tenían método en el servicio del frontend, y ninguna
 * pantalla los llamaba: se podía dejar una cuenta atada a un centro de coste por API y no había
 * forma de ver ni deshacer esa atadura desde la consola.
 *
 * El asiento se alcanza por su DOCUMENTO y no por una lista propia: no existe endpoint que liste
 * asientos, y el detalle del documento ya devuelve el suyo. Inventar aquí un listado de asientos
 * sería construir producto nuevo para llegar a un endpoint que ya existe; esto usa el camino que
 * la API ya ofrece.
 */

/**
 * De qué listado sale cada tipo de entidad. BRANCH es la sucursal CONTABLE (estructura financiera),
 * no la del comercio: el vínculo vive en el módulo de contabilidad. OTHER no tiene listado.
 */
const LISTADO_POR_TIPO: Record<string, (() => Promise<Option[]>) | undefined> = {
  BUSINESS_PARTNER: loadBusinessPartners,
  COST_CENTER: loadCostCenters,
  PROFIT_CENTER: loadProfitCenters,
  CONTRACT: loadContracts,
  LEGAL_ENTITY: loadLegalEntities,
  TAX_CODE: loadTaxCodes,
  BANK_ACCOUNT: loadBankAccounts,
  LEDGER: loadLedgers,
  BRANCH: loadAccountingBranches,
  ACCOUNTING_DOCUMENT: loadAccountingDocuments,
};

function s(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function rowsOf(data: PaginatedResult<ResourceRow> | ResourceRow[] | null): ResourceRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? data.rows ?? [];
}

/**
 * Los campos del alta son los mismos en los dos casos: cambia sobre qué se crea.
 *
 * La entidad se ELIGE del listado que corresponde al tipo; antes se pedía su UUID a mano. El tipo
 * arranca en BUSINESS_PARTNER para que la lista de entidades ya esté cargada al abrir. OTHER no
 * tiene listado del que elegir, así que sólo para él queda un texto donde pegar el identificador.
 */
const camposDeVinculo: ActionField[] = [
  { name: 'entityType', label: 'Tipo de entidad', required: true, defaultValue: 'BUSINESS_PARTNER', optionsSource: 'domain:accounting.entityLinkType' },
  {
    name: 'entityId',
    label: 'Entidad',
    span: 2,
    // No es `required` nativo: con OTHER el select queda vacío y bloquearía el envío. Se valida al enviar.
    optional: true,
    emptyOption: '— Elige la entidad —',
    dependsOn: 'entityType',
    optionsLoaderFor: async (tipo) => (await LISTADO_POR_TIPO[tipo]?.()) ?? [],
    hint: 'Las del tipo elegido.',
  },
  { name: 'otherEntityId', label: 'Identificador (sólo tipo «Otro»)', optional: true, span: 2, placeholder: '00000000-0000-4000-8000-000000000000', hint: '«Otro» no tiene listado del que elegir: pega el UUID de la entidad.' },
  // Su ayuda inventaba GASTO/INGRESO, que el backend no acepta: ahora es su vocabulario.
  { name: 'relation', label: 'Relación', optional: true, defaultValue: 'DEFAULT', optionsSource: 'domain:accounting.entityLinkRelation', hint: 'Para qué se ata la entidad. Vacío = DEFAULT.' },
];

/** Resuelve de qué control sale el identificador y avisa si falta, antes de viajar al backend. */
function payloadDeVinculo(payload: JsonObject): JsonObject {
  const { entityId, otherEntityId, ...resto } = payload;
  const otro = s(resto.entityType) === 'OTHER';
  const id = otro ? s(otherEntityId).trim() : s(entityId);
  if (!id) throw new Error(otro ? 'Pega el identificador de la entidad: «Otro» no tiene listado.' : 'Elige la entidad a la que se ata.');
  return { ...resto, entityId: id };
}

export function EntityLinksScreen() {
  const [tab, setTab] = useState('cuentas');
  const [accountId, setAccountId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [borrando, setBorrando] = useState<ResourceRow | null>(null);
  /* Tras crear, el formulario se remonta: `reset()` devuelve el tipo a su valor inicial sin avisar
     al campo dependiente, que se quedaría con las entidades del tipo anterior. */
  const [formularioCuenta, setFormularioCuenta] = useState(0);
  const [formularioAsiento, setFormularioAsiento] = useState(0);

  const accounts = useAsyncResource(
    useCallback(() => accountingService.listGlAccounts({ page: 1, pageSize: 100 }), []),
  );
  const documents = useAsyncResource(useCallback(() => accountingService.listDocuments(), []));

  const accountLinks = useAsyncResource(
    useCallback(
      async () => (accountId ? accountingService.listGlAccountLinks(accountId) : []),
      [accountId],
    ),
  );

  const documentDetail = useAsyncResource(
    useCallback(
      async () => (documentId ? accountingService.getDocument(documentId) : null),
      [documentId],
    ),
  );
  const journalId = s((documentDetail.data as { journal?: { id?: unknown } } | null)?.journal?.id);
  const journalLinks = useAsyncResource(
    useCallback(
      async () => (journalId ? accountingService.listJournalLinks(journalId) : []),
      [journalId],
    ),
  );

  /* Al cambiar de documento hay que releer el asiento antes que sus vínculos. */
  useEffect(() => { void journalLinks.reload(); }, [journalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cuentas = useMemo(() => rowsOf(accounts.data), [accounts.data]);
  const documentos = useMemo(() => rowsOf(documents.data), [documents.data]);

  async function crearVinculoCuenta(payload: JsonObject) {
    const created = await accountingService.createGlAccountLink(accountId, payloadDeVinculo(payload));
    await accountLinks.reload();
    return created;
  }

  async function crearVinculoAsiento(payload: JsonObject) {
    const created = await accountingService.createJournalLink(journalId, payloadDeVinculo(payload));
    await journalLinks.reload();
    return created;
  }

  async function borrarVinculo(link: ResourceRow) {
    setBorrando(null);
    try {
      await accountingService.deleteGlAccountLink(s(link.id));
      toast.success('Vínculo eliminado', `${s(link.entityType)} · ${s(link.relation)}`);
      await accountLinks.reload();
    } catch (error) {
      toast.error('No se pudo eliminar', error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  function tablaDeVinculos(items: ResourceRow[], onDelete?: (row: ResourceRow) => void) {
    if (items.length === 0) {
      return <p className="text-xs text-slate-500">Sin vínculos. Un registro sin vínculos no está mal configurado: la mayoría no los necesita.</p>;
    }
    return (
      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className={`grid ${onDelete ? 'grid-cols-[1.2fr_2fr_1fr_1fr_90px]' : 'grid-cols-[1.2fr_2fr_1fr_1fr]'} bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500`}>
          <span>Tipo</span><span>Entidad</span><span>Relación</span><span>Creado</span>{onDelete ? <span /> : null}
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((row) => (
            <div key={s(row.id)} className={`grid ${onDelete ? 'grid-cols-[1.2fr_2fr_1fr_1fr_90px]' : 'grid-cols-[1.2fr_2fr_1fr_1fr]'} items-center px-4 py-2 text-xs`}>
              <span><StatusPill tone="neutral">{s(row.entityType).replaceAll('_', ' ')}</StatusPill></span>
              <span className="truncate font-mono text-[11px] text-slate-600">{s(row.entityId)}</span>
              <span className="text-slate-600">{s(row.relation) || 'DEFAULT'}</span>
              <span className="text-slate-500">{row.createdAt ? formatDate(s(row.createdAt)) : '—'}</span>
              {onDelete ? (
                <span className="text-right">
                  <AtlasButton variant="danger" className="h-7 px-2 text-[10px]" onClick={() => onDelete(row)}>Quitar</AtlasButton>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Vínculos multientidad' }]}
        title="Vínculos multientidad"
        description="Con qué otras entidades está atada una cuenta GL o un asiento: centro de coste, contrato, sucursal, socio de negocio."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'cuentas',
            label: 'Cuentas GL',
            icon: 'account_tree',
            content: (
              <div className="space-y-4">
                <Panel title="Elige la cuenta" icon="search">
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className="h-9 w-full max-w-xl rounded-md border border-slate-300 px-3 text-xs"
                  >
                    <option value="">— Selecciona una cuenta GL —</option>
                    {cuentas.map((row) => (
                      <option key={s(row.id)} value={s(row.id)}>{`${s(row.accountNo)} — ${s(row.name)}`}</option>
                    ))}
                  </select>
                  {accounts.error ? <InlineNotice tone="danger" title="No se pudo cargar el plan de cuentas">{accounts.error}</InlineNotice> : null}
                </Panel>
                {accountId ? (
                  <>
                    <Panel title="Vínculos de la cuenta" icon="link">{tablaDeVinculos(rowsOf(accountLinks.data), (row) => setBorrando(row))}</Panel>
                    <InlineActionForm
                      key={`cuenta-${formularioCuenta}`}
                      title="Atar la cuenta a otra entidad"
                      description="Elige el tipo y, después, la entidad de ese tipo."
                      icon="add_link"
                      submitLabel="Crear vínculo"
                      successMessage="El vínculo quedó creado."
                      onSubmit={crearVinculoCuenta}
                      onDone={() => setFormularioCuenta((value) => value + 1)}
                      fields={camposDeVinculo}
                    />
                  </>
                ) : null}
              </div>
            ),
          },
          {
            id: 'asientos',
            label: 'Asientos',
            icon: 'receipt_long',
            content: (
              <div className="space-y-4">
                <Panel title="Elige el documento" description="El asiento se alcanza por el documento contable que lo generó." icon="search">
                  <select
                    value={documentId}
                    onChange={(event) => setDocumentId(event.target.value)}
                    className="h-9 w-full max-w-xl rounded-md border border-slate-300 px-3 text-xs"
                  >
                    <option value="">— Selecciona un documento contable —</option>
                    {documentos.map((row) => (
                      <option key={s(row.id)} value={s(row.id)}>{`${s(row.documentNo)} — ${s(row.documentType)} (${s(row.postingStatus || row.status)})`}</option>
                    ))}
                  </select>
                  {documentId && documentDetail.status !== 'loading' && !journalId ? (
                    <InlineNotice tone="warning" title="Este documento no tiene asiento">
                      El asiento se crea al contabilizar el documento. Sin asiento no hay nada que vincular.
                    </InlineNotice>
                  ) : null}
                </Panel>
                {journalId ? (
                  <>
                    <Panel title="Vínculos del asiento" description={`Asiento ${journalId}`} icon="link">
                      {tablaDeVinculos(rowsOf(journalLinks.data))}
                    </Panel>
                    <InlineActionForm
                      key={`asiento-${formularioAsiento}`}
                      onDone={() => setFormularioAsiento((value) => value + 1)}
                      title="Atar el asiento a otra entidad"
                      description="El backend no expone borrado para los vínculos de asiento: un asiento contabilizado no se corrige quitándole ataduras, se reversa."
                      icon="add_link"
                      submitLabel="Crear vínculo"
                      successMessage="El vínculo quedó creado."
                      onSubmit={crearVinculoAsiento}
                      fields={camposDeVinculo}
                    />
                  </>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      {borrando ? (
        <ConfirmDialog
          open
          tone="danger"
          title="Quitar el vínculo"
          message={`Se quita la atadura con ${s(borrando.entityType).replaceAll('_', ' ')} ${s(borrando.entityId)}. La cuenta y la entidad no cambian en nada más.`}
          confirmLabel="Quitar"
          onConfirm={() => void borrarVinculo(borrando)}
          onCancel={() => setBorrando(null)}
        />
      ) : null}
    </div>
  );
}
