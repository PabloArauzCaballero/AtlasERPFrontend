'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { StatusPill } from '@/components/atlas/StatusPill';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { b2bService } from '@/services/b2bService';
import { domainLoader } from '@/services/domains';
import type { Option } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

const CUALQUIERA = { label: '— Cualquiera —', value: '' };

interface MdrRulesPanelProps {
  /**
   * La VERSIÓN contractual de la que cuelgan las reglas. No el contrato: son uuid distintos.
   *
   * Aquí estuvo la avería que dejaba la pantalla inservible. La regla de comisión cuelga de
   * `mdr_rules.contract_version_id`, y quien abría el panel entregaba el id del CONTRATO, que es
   * lo que devuelve `GET /b2b/contracts`. Con ese id, listar reglas respondía `[]` —y la pantalla
   * anunciaba «Sin reglas» tan tranquila— y agregar una respondía 404 «Versión contractual no
   * encontrada». Nunca se pudo crear una comisión desde el ERP. Hoy el listado de contratos trae
   * `currentVersionId` y es ESE el que llega hasta aquí.
   */
  contractVersionId: string;
  /** La cuenta del contrato: sin ella no se puede ofrecer la dimensión «sucursal». */
  accountId?: string | undefined;
}

/** Sin sucursales propias no hay nada que elegir, y decirlo evita buscar el motivo. */
const SIN_SUCURSALES = '— Este comercio no tiene sucursales registradas —';

/**
 * Cuánto le cobra Atlas al comercio por cada venta, y en qué casos.
 *
 * Se acuerda antes de que el comercio opere: activarlo sin haber pactado la comisión deja la
 * primera venta cobrando lo que hubiera por defecto, y esa conversación ya no se puede tener hacia
 * atrás.
 *
 * Las tres dimensiones son opcionales y ahí está toda la flexibilidad: una regla sin ninguna es la
 * tarifa base; con rubro cobra distinto la electrónica que la farmacia; con sucursal distingue una
 * cara de una barata; con segmento de riesgo cobra más por el crédito que más riesgo trae. Se
 * combinan libremente y **gana la más específica**, que es como las elige el motor al llegar la
 * venta: por eso se listan en ese orden y no por fecha.
 *
 * La sucursal es la dimensión que MÁS pesa (4 puntos frente a 2 del rubro y 1 del segmento) y era
 * justo la que el formulario no ofrecía, aunque el texto de ayuda la anunciara y el backend la
 * aceptara desde el principio: las reglas salían ordenadas por un criterio que nadie podía usar.
 */
export function MdrRulesPanel({ contractVersionId, accountId }: MdrRulesPanelProps) {
  // Rubro y banda de riesgo salen del catálogo del backend: la regla se cruza con lo que él guarda.
  const categoriaOptions = useOptions(domainLoader('domain:crm.merchantCategory'));
  const riesgoOptions = useOptions(domainLoader('domain:crm.riskTier'));
  // Sólo las sucursales DE ESTE comercio: una regla no puede apuntar a la sucursal de otro.
  const sucursalOptions = useOptions(
    useCallback(async (): Promise<Option[]> => {
      if (!accountId) return [];
      const filas = await b2bService.listBranches({ accountId });
      return filas.map((fila) => ({
        value: String(fila.id ?? ''),
        label: `${String(fila.name ?? 'Sucursal')}${fila.city ? ` — ${String(fila.city)}` : ''}`,
      }));
    }, [accountId]),
  );

  const [reglas, setReglas] = useState<ResourceRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useAtlasMutation(useCallback((body: JsonObject) => b2bService.createMdrRule(body), []));
  const cambiar = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.updateMdrRule(id, body), []));

  const recargar = useCallback(async (versionId: string) => {
    if (!versionId) { setReglas([]); return; }
    setCargando(true);
    try {
      setReglas(await b2bService.listMdrRules(versionId));
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer las reglas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void recargar(contractVersionId); }, [contractVersionId, recargar]);

  /** El nombre de la sucursal de una regla; el uuid a secas no le dice nada a nadie. */
  const nombreDeSucursal = (id: unknown): string => {
    if (!id) return 'Cualquiera';
    return sucursalOptions.find((opcion) => opcion.value === String(id))?.label ?? 'Sucursal retirada';
  };

  async function agregar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const form = new FormData(formulario);
    const opcional = (clave: string) => String(form.get(clave) ?? '').trim() || undefined;
    const numero = (clave: string) => {
      const bruto = String(form.get(clave) ?? '').trim();
      return bruto === '' ? undefined : Number(bruto);
    };
    try {
      await crear.execute({
        contractVersionId,
        ratePercent: Number(form.get('ratePercent') ?? 0),
        productCategory: opcional('productCategory'),
        branchId: opcional('branchId'),
        riskSegment: opcional('riskSegment'),
        minFeeAmount: numero('minFeeAmount'),
        maxFeeAmount: numero('maxFeeAmount'),
      });
      // `currentTarget` ya es null dentro del `await`: el formulario se guarda antes de esperar.
      formulario.reset();
      await recargar(contractVersionId);
    } catch { /* mostrado abajo */ }
  }

  async function alternar(regla: ResourceRow) {
    try {
      await cambiar.execute({ id: String(regla.id), body: { isActive: !regla.isActive } });
      await recargar(contractVersionId);
    } catch { /* mostrado abajo */ }
  }

  /*
   * Un contrato sin versión no puede tener comisión, y decirlo es mejor que enseñar un formulario
   * que sólo sabe responder 404. Pasa con contratos anteriores al versionado.
   */
  if (!contractVersionId) {
    return (
      <div data-tutorial-id="mdr-reglas">
        <InlineNotice tone="warning" title="Este contrato todavía no tiene versión vigente">
          La comisión cuelga de la versión del contrato, y este no tiene ninguna. Genere el contrato
          desde una propuesta aceptada para que nazca su primera versión.
        </InlineNotice>
      </div>
    );
  }

  return (
    <div data-tutorial-id="mdr-reglas">
      {error ? <InlineNotice className="mb-3" tone="danger">{error}</InlineNotice> : null}

      <form onSubmit={agregar} className="rounded-md bg-slate-50 p-3">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <FormField tooltip="Comisión (MDR) en porcentaje sobre cada venta. Ej.: 3." label="Comisión (%)" name="ratePercent" type="number" step="0.01" min="0" max="100" required placeholder="3.50" />
          <FormField tooltip="Comisión mínima en bolivianos por venta, aunque el porcentaje dé menos." label="Comisión mínima (Bs)" name="minFeeAmount" type="number" step="0.01" min="0" hint="Una venta de Bs 20 al 3 % deja Bs 0,60." />
          <FormField tooltip="Comisión máxima en bolivianos por venta, aunque el porcentaje dé más." label="Comisión máxima (Bs)" name="maxFeeAmount" type="number" step="0.01" min="0" hint="Evita comisiones desproporcionadas en ventas grandes." />
          <FormField tooltip="Sucursal a la que aplica la regla; vacío = todas. Es la dimensión que más pesa." kind="select" label="Sucursal" name="branchId" options={[sucursalOptions.length ? CUALQUIERA : { label: SIN_SUCURSALES, value: '' }, ...sucursalOptions]} hint="Vacío: aplica a todas." />
          <FormField tooltip="Rubro del producto vendido; decide la comisión que aplica." kind="select" label="Rubro del producto" name="productCategory" options={[CUALQUIERA, ...categoriaOptions]} hint="Vacío: aplica a todos." />
          <FormField tooltip="Segmento de riesgo del cliente al que aplica la regla; vacío = todos." kind="select" label="Segmento de riesgo" name="riskSegment" options={[CUALQUIERA, ...riesgoOptions]} hint="Vacío: aplica a todos." />
        </div>
        {/* Fuera de la rejilla: dentro parecía un campo más y competía con ellos por la vista. */}
        <div className="mt-3 flex justify-end">
          <AtlasButton type="submit" icon="add" loading={crear.isLoading}>Agregar regla</AtlasButton>
        </div>
        {crear.error ? <InlineNotice className="mt-3" tone="danger">{crear.error}</InlineNotice> : null}
      </form>

      <div className="mt-4">
        {cargando ? <p className="py-6 text-center text-xs text-slate-500">Cargando…</p>
          : reglas.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">Sin reglas: se usará el término MDR del contrato.</p>
          : (
            <div className="table-scroll rounded-lg border border-slate-200">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Comisión</th><th className="p-2.5">Sucursal</th><th className="p-2.5">Rubro</th><th className="p-2.5">Segmento</th><th className="p-2.5 text-right">Mínima</th><th className="p-2.5 text-right">Máxima</th><th className="p-2.5">Estado</th><th className="p-2.5" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {reglas.map((regla) => (
                    <tr key={String(regla.id)} className={regla.isActive ? '' : 'opacity-50'}>
                      <td className="p-2.5 font-extrabold">{Number(regla.ratePercent).toFixed(2)} %</td>
                      <td className="p-2.5 text-slate-600">{nombreDeSucursal(regla.branchId)}</td>
                      <td className="p-2.5 text-slate-600">{String(regla.productCategory ?? 'Cualquiera')}</td>
                      <td className="p-2.5 text-slate-600">{String(regla.riskSegment ?? 'Cualquiera')}</td>
                      <td className="p-2.5 text-right text-slate-600">{regla.minFeeAmount ? `Bs ${Number(regla.minFeeAmount).toFixed(2)}` : '—'}</td>
                      <td className="p-2.5 text-right text-slate-600">{regla.maxFeeAmount ? `Bs ${Number(regla.maxFeeAmount).toFixed(2)}` : '—'}</td>
                      <td className="p-2.5"><StatusPill tone={regla.isActive ? 'success' : 'neutral'}>{regla.isActive ? 'Activa' : 'Inactiva'}</StatusPill></td>
                      <td className="p-2.5 text-right"><AtlasButton variant="secondary" onClick={() => void alternar(regla)}>{regla.isActive ? 'Desactivar' : 'Activar'}</AtlasButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <InlineNotice className="mt-4" tone="info" title="Gana la más específica">
        Se listan en el orden en que el motor las elige al llegar una venta: primero las que
        distinguen sucursal, luego rubro, luego segmento de riesgo. Una regla general no anula a
        una segmentada — la segmentada gana.
      </InlineNotice>
    </div>
  );
}
