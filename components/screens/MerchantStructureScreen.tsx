'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { QrCanvas } from '@/components/atlas/QrCanvas';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useMerchantScope } from '@/hooks/useMerchantScope';
import { formDataToPayload } from '@/lib/formPayload';
import { portalService } from '@/services/portalService';
import { partnerOnboardingService, type PartnerOnboardingState } from '@/services/partnerOnboardingService';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * El código con el que el expediente nombra a una sucursal del ERP.
 *
 * Se DERIVA del identificador de la sucursal en vez de pedírselo a nadie: es único por
 * construcción —el identificador ya lo es—, así que declarar dos veces el mismo local no puede
 * producir dos entradas, y volver a intentarlo después de un fallo de red produce el mismo código
 * y choca con un 409 en vez de duplicar. Pedirlo en un formulario era, además, la mitad del
 * trámite que sobraba: el comercio ya había escrito el nombre del local en «Sucursales».
 *
 * Se usa el identificador ENTERO y no un prefijo. Los de este ERP se emiten en serie
 * —`d9000000-…-9001`, `d9000000-…-9002`— y sólo se diferencian en la cola: cortando por delante,
 * dos locales distintos del mismo comercio recibían el MISMO código y el segundo se rechazaba con
 * `BRANCH_CODE_ALREADY_REGISTERED`, o sea que el comercio no podía abrir su segunda tienda.
 * Un UUID sin guiones son 32 caracteres y el contrato admite 40.
 */
function codigoDeExpediente(erpBranchId: string): string {
  return `SUC-${erpBranchId.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-36)}`;
}

/**
 * Las sucursales del comercio: el ÚNICO sitio donde un local se da de alta y se administra.
 *
 * Aquí cuelga todo lo que es de la sucursal —su gente, su estado, sus cajas y el QR que se imprime
 * y se pega en cada mostrador—. El expediente («Mi empresa») ya no tiene una segunda lista de
 * sucursales con su propio formulario: tener dos altas para el mismo local producía dos verdades
 * que nada garantizaba que hablaran del mismo mostrador, y obligaba al comercio a registrar su
 * tienda dos veces para poder imprimir un código.
 *
 * El puente entre las dos vistas —la del ERP, donde se sitúa cada venta; la del expediente, de
 * donde cuelgan las cajas— sigue existiendo porque son dos bases distintas, pero ya no lo teclea
 * nadie: se declara solo al crear la sucursal, y para las que venían de antes basta un botón.
 */
export function MerchantStructureScreen() {
  const scope = useMerchantScope();
  const { accountId: queryAccountId, ready } = scope;

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const branches = useAsyncResource(
    useCallback(() => (ready ? portalService.listBranches(queryAccountId) : Promise.resolve([] as ResourceRow[])), [queryAccountId, ready]),
    ready,
  );
  const branchRows = (branches.data ?? []) as ResourceRow[];

  /*
   * El expediente del propio comercio, que es de donde cuelgan las cajas y sus QR.
   *
   * Vive en AtlasBackend y no en el ERP, así que hay que cruzarlo. El cruce va por `erpBranchId`
   * —el campo con el que el expediente declara a qué sucursal del ERP corresponde cada local— y
   * NUNCA por el nombre: dos locales pueden llamarse «Sucursal Centro», y enseñar el QR de la otra
   * tienda manda el cobro a la caja equivocada.
   */
  const [partnerId, setPartnerId] = useState('');
  useEffect(() => {
    let cancelado = false;
    partnerOnboardingService
      .mine()
      .then((resultado) => {
        if (cancelado) return;
        const propio = resultado.profiles?.[0];
        if (propio) setPartnerId(propio.partnerId);
      })
      .catch(() => {
        // Sin expediente no hay QR que enseñar, y se dice en la fila; no es un fallo de la pantalla.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const expediente = useAsyncResource<PartnerOnboardingState | null>(
    useCallback(async () => (partnerId ? partnerOnboardingService.getState(partnerId) : null), [partnerId]),
    false,
  );
  const { reload: recargarExpediente } = expediente;
  useEffect(() => {
    if (partnerId) void recargarExpediente();
  }, [partnerId, recargarExpediente]);
  const datosExpediente = expediente.data;

  /** El local del expediente enlazado con ESTA sucursal del ERP, si ya se declaró. */
  const localDe = useCallback(
    (erpBranchId: string) => datosExpediente?.branches.find((local) => local.erpBranchId === erpBranchId) ?? null,
    [datosExpediente],
  );

  /** Toda acción sobre el expediente termina releyéndolo: la fila refleja lo que acaba de pasar. */
  const [ocupada, setOcupada] = useState<string | null>(null);
  const enExpediente = useCallback(
    async (etiqueta: string, clave: string, accion: () => Promise<unknown>) => {
      setOcupada(clave);
      setFeedback(null);
      try {
        await accion();
        await recargarExpediente();
        setFeedback({ tone: 'success', text: `${etiqueta}: listo.` });
      } catch (error) {
        setFeedback({ tone: 'danger', text: error instanceof Error ? error.message : `${etiqueta}: no se pudo completar.` });
      } finally {
        setOcupada(null);
      }
    },
    [recargarExpediente],
  );

  /**
   * Declara en el expediente una sucursal que ya existe en el ERP.
   *
   * Es lo que habilita su QR. Se hace solo al crear la sucursal; este camino queda para las que
   * venían de antes —y para cuando el expediente todavía no estaba abierto en ese momento—.
   */
  const declarar = useCallback(
    (branch: ResourceRow) => {
      const id = String(branch.id);
      return partnerOnboardingService.registerBranch(partnerId, {
        erpBranchId: id,
        branchCode: codigoDeExpediente(id),
        name: String(branch.name ?? 'Sucursal'),
        ...(branch.city ? { city: String(branch.city) } : {}),
        ...(branch.address ? { addressLine: String(branch.address) } : {}),
      });
    },
    [partnerId],
  );

  const branchMutation = useAtlasMutation(useCallback((body: JsonObject) => portalService.createBranch(body), []));

  const [editando, setEditando] = useState<ResourceRow | null>(null);
  const editMutation = useAtlasMutation(useCallback(
    ({ id, body }: { id: string; body: JsonObject }) => portalService.updateBranch(id, body),
    [],
  ));
  const statusMutation = useAtlasMutation(useCallback(
    ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => portalService.setBranchStatus(id, status),
    [],
  ));

  async function guardarEdicion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editando) return;
    const form = new FormData(event.currentTarget);
    try {
      await editMutation.execute({
        id: String(editando.id),
        body: {
          name: String(form.get('name') ?? ''),
          city: String(form.get('city') ?? ''),
          address: String(form.get('address') ?? ''),
        },
      });
      setEditando(null);
      await branches.reload();
    } catch { /* shown inline */ }
  }

  async function cambiarEstado(branch: ResourceRow) {
    const activa = String(branch.status) === 'ACTIVE';
    setOcupada(String(branch.id));
    try {
      await statusMutation.execute({ id: String(branch.id), status: activa ? 'INACTIVE' : 'ACTIVE' });
      await branches.reload();
    } catch { /* shown inline */ } finally { setOcupada(null); }
  }

  const [qrAbierto, setQrAbierto] = useState<string | null>(null);
  /*
   * Cuál de los locales YA declarados es esta sucursal, cuando hay alguno sin enlazar.
   *
   * No es un desplegable de comercios disfrazado: pregunta por los locales del propio negocio, y
   * sólo aparece si hay alguno huérfano. Sin él, la única forma de enlazar una sucursal declarada
   * antes de que el puente existiera era declararla otra vez, y las cajas se quedaban colgando de
   * la fila vieja mientras el ERP miraba la nueva.
   */
  const [adoptar, setAdoptar] = useState('');
  const sinEnlazar = (datosExpediente?.branches ?? []).filter((local) => !local.erpBranchId);

  async function submitBranch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFeedback(null);
    try {
      const creada = await branchMutation.execute(
        formDataToPayload(new FormData(form), [{ name: 'name' }, { name: 'city', optional: true }, { name: 'address', optional: true }]),
      );
      form.reset();
      if (ready) await branches.reload();
      /*
       * La sucursal se declara sola en el expediente.
       *
       * Antes esto era un segundo formulario en «Mi empresa», y mientras nadie lo rellenara la
       * sucursal existía pero no tenía forma de tener QR: la pantalla decía «no está enlazada con
       * ningún local del expediente» y el comercio no tenía por qué saber qué significaba eso.
       *
       * Si falla, la sucursal YA está creada —no se deshace— y se ofrece reintentarlo desde su
       * fila: perder el local por no poder enlazarlo sería peor que quedarse sin QR un rato.
       */
      if (partnerId && creada?.id) {
        try {
          await declarar(creada);
          await recargarExpediente();
        } catch (error) {
          setFeedback({
            tone: 'danger',
            text: `La sucursal se registró, pero no se pudo enlazar con tu expediente (${error instanceof Error ? error.message : 'error desconocido'}). Ábrela en la lista y pulsa «Habilitar QR».`,
          });
        }
      }
    } catch { /* shown inline */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Sucursales' }]}
        title="Sucursales del comercio"
        description="Dónde opera tu negocio. De cada sucursal cuelgan sus cajas y el QR que se imprime para ese mostrador."
        actions={
          <BotonPdf
            label="Descargar PDF"
            data-testid="pdf-sucursales"
            disabled={!branchRows.length}
            documento={() => ({
              title: 'Sucursales del comercio',
              subtitle: `Portal del comercio · ${branchRows.length} sucursal(es)`,
              summary: [
                { label: 'Sucursales', value: branchRows.length },
                { label: 'Activas', value: branchRows.filter((fila) => String(fila.status) === 'ACTIVE').length },
                { label: 'Originan BNPL', value: branchRows.filter((fila) => Boolean(fila.canOriginateBnpl)).length },
              ],
              sections: [
                {
                  title: 'Sucursales registradas',
                  table: tablaPdf(
                    [
                      { key: 'name', label: 'Sucursal' },
                      { key: 'city', label: 'Ciudad' },
                      { key: 'address', label: 'Dirección' },
                      { key: 'bnpl', label: 'BNPL' },
                      { key: 'status', label: 'Estado' },
                    ],
                    branchRows.map((fila) => ({ ...fila, bnpl: fila.canOriginateBnpl ? 'Sí' : 'No' })),
                  ),
                },
              ],
            })}
          />
        }
      />

      {/*
        * El negocio es el que inició sesión: aquí no se elige comercio.
        *
        * Lo único que se pregunta —y sólo a quien administra VARIOS negocios propios— es con cuál
        * de los suyos sigue.
        */}
      {scope.requiresSelection ? (
        <Panel compact>
          <div className="max-w-md">
            <FormField
              kind="select"
              label="Negocio"
              name="queryAccountId"
              value={queryAccountId ?? ''}
              onChange={(e) => scope.setAccountId(e.target.value)}
              hint="Administras varios negocios: elige de cuál quieres ver las sucursales."
              options={[{ label: '— Elige uno de tus negocios —', value: '' }, ...scope.accountOptions]}
            />
          </div>
        </Panel>
      ) : null}

      {scope.error ? <InlineNotice tone="danger" title="No se pudo determinar tu negocio">{scope.error}</InlineNotice> : null}
      {feedback ? (
        <div data-testid="sucursales-feedback">
          <InlineNotice tone={feedback.tone} title={feedback.tone === 'danger' ? 'No se pudo completar' : 'Listo'}>{feedback.text}</InlineNotice>
        </div>
      ) : null}

      <form onSubmit={submitBranch}>
        <Panel title="Agregar sucursal" description="Registra un local nuevo de tu negocio. Nace activo; vender a crédito en él lo habilita Atlas aparte." icon="add_location">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Nombre de sucursal" name="name" required placeholder="Sucursal Norte" />
            <FormField label="Ciudad" name="city" placeholder="Santa Cruz de la Sierra" />
            <FormField label="Dirección" name="address" className="md:col-span-2" placeholder="Av. principal, zona y referencia" />
          </div>
          {branchMutation.error ? <InlineNotice className="mt-4" tone="danger">{branchMutation.error}</InlineNotice> : null}
          {branchMutation.status === 'success' ? <InlineNotice className="mt-4" tone="success">Sucursal registrada correctamente.</InlineNotice> : null}
          <div className="mt-5 flex justify-end">
            <AtlasButton type="submit" icon="add_location" loading={branchMutation.isLoading} disabled={!ready}>Registrar sucursal</AtlasButton>
          </div>
        </Panel>
      </form>

      {editando ? (
        <form onSubmit={guardarEdicion}>
          <Panel title={`Editar ${String(editando.name ?? 'sucursal')}`} description="La sucursal no cambia de negocio: eso movería sus ventas de cuenta." icon="edit_location">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Nombre de sucursal" name="name" required defaultValue={String(editando.name ?? '')} />
              <FormField label="Ciudad" name="city" required defaultValue={String(editando.city ?? '')} />
              <FormField label="Dirección" name="address" className="md:col-span-2" defaultValue={String(editando.address ?? '')} />
            </div>
            {editMutation.error ? <InlineNotice className="mt-4" tone="danger">{editMutation.error}</InlineNotice> : null}
            <div className="mt-5 flex justify-end gap-2">
              <AtlasButton variant="secondary" type="button" onClick={() => setEditando(null)}>Cancelar</AtlasButton>
              <AtlasButton type="submit" icon="save" loading={editMutation.isLoading}>Guardar cambios</AtlasButton>
            </div>
          </Panel>
        </form>
      ) : null}
      {statusMutation.error ? <InlineNotice tone="danger" title="No se pudo cambiar el estado">{statusMutation.error}</InlineNotice> : null}

      <Panel title="Sucursales registradas" description="Abre una sucursal para ver sus cajas y el QR que se imprime en ese mostrador." icon="storefront" action={<AtlasButton variant="secondary" icon="refresh" loading={branches.status === 'loading'} disabled={!ready} onClick={branches.reload}>Actualizar</AtlasButton>}>
        {branches.error ? <InlineNotice tone="danger" title="No se pudo consultar">{branches.error}</InlineNotice> : null}
        {!ready ? (
          <p className="py-6 text-center text-xs text-slate-500">
            {scope.error ? 'No hay nada que mostrar hasta resolver lo de arriba.' : 'Elige uno de tus negocios para ver sus sucursales.'}
          </p>
        ) : branchRows.length ? (
          <div className="table-scroll rounded-lg border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Sucursal</th><th className="p-2.5">Ciudad</th><th className="p-2.5">Dirección</th><th className="p-2.5">BNPL</th><th className="p-2.5">Estado</th><th className="p-2.5 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {branchRows.map((branch) => {
                  const id = String(branch.id);
                  const abierto = qrAbierto === id;
                  const local = localDe(id);
                  const terminales = local ? (datosExpediente?.posTerminals ?? []).filter((pos) => pos.branchId === local.branchId) : [];
                  return (
                  <Fragment key={id}>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-800">{String(branch.name ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.city ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.address ?? '—')}</td>
                    <td className="p-2.5">{branch.canOriginateBnpl ? <StatusPill tone="success" dot={false}>Sí</StatusPill> : <StatusPill tone="neutral" dot={false}>No</StatusPill>}</td>
                    <td className="p-2.5"><StatusPill tone={String(branch.status) === 'ACTIVE' ? 'success' : 'warning'}>{String(branch.status ?? '—')}</StatusPill></td>
                    <td className="p-2.5">
                      <div className="flex justify-end gap-1.5">
                        <AtlasButton variant="secondary" icon="qr_code_2" data-testid={`ver-qr-${id}`} onClick={() => { setAdoptar(''); setQrAbierto(abierto ? null : id); }}>
                          {abierto ? 'Ocultar cajas' : 'Cajas y QR'}
                        </AtlasButton>
                        <AtlasButton variant="secondary" icon="edit" onClick={() => setEditando(branch)}>Editar</AtlasButton>
                        <AtlasButton variant={String(branch.status) === 'ACTIVE' ? 'danger' : 'success'} icon={String(branch.status) === 'ACTIVE' ? 'block' : 'check'} loading={ocupada === id} onClick={() => void cambiarEstado(branch)}>
                          {String(branch.status) === 'ACTIVE' ? 'Dar de baja' : 'Reactivar'}
                        </AtlasButton>
                      </div>
                    </td>
                  </tr>
                  {abierto ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/70 p-3" data-testid={`qr-de-${id}`}>
                        {expediente.status === 'loading' ? (
                          <p className="text-slate-600">Buscando las cajas de esta sucursal…</p>
                        ) : !partnerId ? (
                          <p className="text-slate-600">
                            Todavía no has abierto el expediente de tu empresa, y el QR cuelga de él. Ábrelo en{' '}
                            <strong>Mi empresa</strong> y vuelve aquí.
                          </p>
                        ) : !local ? (
                          /*
                           * Sucursal anterior a que el enlace se hiciera solo. Es un botón y no un
                           * formulario a propósito: no hay nada que preguntar —el nombre, la ciudad
                           * y la dirección ya están escritos en esta misma fila—.
                           */
                          <div className="space-y-2">
                            <p className="text-slate-600">Esta sucursal todavía no está enlazada con tu expediente, así que no puede tener QR.</p>
                            {sinEnlazar.length ? (
                              <div className="max-w-md">
                                <FormField
                                  kind="select"
                                  label="¿Es uno de los locales que ya declaraste?"
                                  name="adoptar"
                                  value={adoptar}
                                  onChange={(e) => setAdoptar(e.target.value)}
                                  data-testid={`adoptar-local-${id}`}
                                  hint="Si es el mismo mostrador, enlázalo en vez de declararlo otra vez: dos filas para un local son dos QR."
                                  options={[
                                    { label: '— Es un local nuevo —', value: '' },
                                    ...sinEnlazar.map((local) => ({
                                      label: `${local.branchCode} · ${local.name}`,
                                      value: local.branchId,
                                    })),
                                  ]}
                                />
                              </div>
                            ) : null}
                            <AtlasButton
                              icon="link"
                              data-testid={`habilitar-qr-${id}`}
                              loading={ocupada === `declarar-${id}`}
                              onClick={() =>
                                void enExpediente('Sucursal enlazada', `declarar-${id}`, () =>
                                  adoptar
                                    ? partnerOnboardingService.linkBranch(partnerId, adoptar, id)
                                    : declarar(branch),
                                ).then(() => setAdoptar(''))
                              }
                            >
                              Habilitar QR en esta sucursal
                            </AtlasButton>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {terminales.length === 0 ? (
                              <p className="text-slate-600">Esta sucursal todavía no tiene ninguna caja dada de alta, así que no hay QR que imprimir. Regístrala aquí abajo.</p>
                            ) : (
                              <div className="flex flex-wrap gap-4">
                                {terminales.map((pos) => (
                                  <div key={pos.terminalId} className="w-44 space-y-1.5 text-center">
                                    <QrCanvas value={pos.terminalSerial} size={176} className="mx-auto" />
                                    <p className="font-bold text-slate-800">{pos.terminalAlias ?? pos.terminalSerial}</p>
                                    <p className="font-mono text-[11px] text-slate-600">{pos.terminalSerial}</p>
                                    <StatusPill tone={pos.status === 'active' ? 'success' : 'warning'}>{pos.status}</StatusPill>
                                    {pos.status !== 'active' ? (
                                      <p className="text-[10px] text-slate-500">Mientras no esté activo, el teléfono del cliente rechaza este código.</p>
                                    ) : null}
                                    {/*
                                      * Suspender se hace DESDE el terminal y no desde una tabla aparte.
                                      *
                                      * Es una medida de contención —una caja que se pierde o que cobra lo
                                      * que no debe— y quien la toma está mirando ese mostrador, no una
                                      * lista de seriales donde hay que acertar la fila.
                                      */}
                                    <button
                                      type="button"
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      disabled={ocupada === `pos-${pos.terminalId}`}
                                      data-testid={`btn-estado-pos-${pos.terminalSerial}`}
                                      onClick={() =>
                                        void enExpediente('Estado del terminal', `pos-${pos.terminalId}`, () =>
                                          partnerOnboardingService.changePosStatus(partnerId, pos.terminalId, {
                                            status: pos.status === 'active' ? 'suspended' : 'active',
                                          }),
                                        )
                                      }
                                    >
                                      {pos.status === 'active' ? 'Suspender' : 'Reactivar'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/*
                              * El alta de la caja vive DENTRO de su sucursal, y por eso no pregunta a
                              * cuál pertenece: la sucursal es el sitio donde estás, no un campo que
                              * rellenar.
                              */}
                            <form
                              className="grid gap-2 border-t border-slate-200 pt-3 md:grid-cols-3"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const form = event.currentTarget;
                                const datos = new FormData(form);
                                const serial = String(datos.get('terminalSerial') ?? '').trim();
                                const alias = String(datos.get('terminalAlias') ?? '').trim();
                                /*
                                 * Se limpia YA, no al terminar.
                                 *
                                 * La recarga del expediente vuelve a montar esta fila, así que un
                                 * `reset()` diferido puede caer sobre un formulario que ya no está
                                 * en la página y dejar el serial anterior escrito para el siguiente.
                                 */
                                form.reset();
                                void enExpediente('Terminal', `alta-pos-${id}`, () =>
                                  partnerOnboardingService.registerPosTerminal(partnerId, local.branchId, {
                                    terminalSerial: serial,
                                    ...(alias ? { terminalAlias: alias } : {}),
                                  }),
                                );
                              }}
                            >
                              <FormField label="Serial de la caja" name="terminalSerial" required data-testid={`campo-pos-serial-${id}`} />
                              <FormField label="Alias" name="terminalAlias" hint="Caja 1, Mostrador…" />
                              <div className="flex items-end">
                                <AtlasButton type="submit" loading={ocupada === `alta-pos-${id}`} data-testid={`btn-registrar-pos-${id}`}>
                                  Registrar caja aquí
                                </AtlasButton>
                              </div>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : branches.status !== 'loading' ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div><Icon name="inventory_2" className="text-[30px] text-slate-400" /><p className="mt-2 text-xs font-bold text-slate-600">Tu negocio aún no tiene sucursales registradas.</p></div></div>
        ) : null}
      </Panel>
    </div>
  );
}
