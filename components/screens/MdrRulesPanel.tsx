'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { b2bService } from '@/services/b2bService';
import { merchantCategoryOptions, riskTierOptions } from '@/lib/catalogs';
import { loadContracts2 } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

const CUALQUIERA = { label: '— Cualquiera —', value: '' };

/**
 * Cuánto le cobra Atlas al comercio por cada venta, y en qué casos.
 *
 * Se configura AQUÍ, en el alta, porque es parte de lo que se pacta con el comercio antes de que
 * opere: activarlo sin haber acordado la comisión deja la primera venta cobrando lo que hubiera por
 * defecto, y esa conversación ya no se puede tener hacia atrás.
 *
 * Las tres dimensiones son opcionales y ahí está toda la flexibilidad: una regla sin ninguna es la
 * tarifa base; con categoría cobra distinto la electrónica que la farmacia; con sucursal distingue
 * una cara de una barata; con segmento de riesgo cobra más por el crédito que más riesgo trae. Se
 * combinan libremente y **gana la más específica**, que es como las elige el motor al llegar la
 * venta: por eso se listan en ese mismo orden y no por fecha.
 */
export function MdrRulesPanel() {
  const contratos = useOptions(loadContracts2);
  const [contractVersionId, setContractVersionId] = useState('');
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

  async function agregar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
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
        riskSegment: opcional('riskSegment'),
        minFeeAmount: numero('minFeeAmount'),
        maxFeeAmount: numero('maxFeeAmount'),
      });
      evento.currentTarget.reset();
      await recargar(contractVersionId);
    } catch { /* mostrado abajo */ }
  }

  async function alternar(regla: ResourceRow) {
    try {
      await cambiar.execute({ id: String(regla.id), body: { isActive: !regla.isActive } });
      await recargar(contractVersionId);
    } catch { /* mostrado abajo */ }
  }

  return (
    <Panel
      data-tutorial-id="mdr-reglas"
      title="Comisión por venta (MDR)"
      description="Lo que Atlas cobra al comercio por cada venta. Se acuerda en el alta, antes de que opere."
      icon="percent"
    >
      <FormField
        kind="select"
        label="Versión contractual"
        name="contractVersionId"
        value={contractVersionId}
        onChange={(evento) => setContractVersionId(evento.target.value)}
        options={[{ label: contratos.length ? '— Elija el contrato —' : '— No hay contratos —', value: '' }, ...contratos]}
        hint="La comisión cuelga de la versión del contrato: cambiarla es una versión nueva, no una edición."
      />

      {error ? <InlineNotice className="mt-3" tone="danger">{error}</InlineNotice> : null}

      {contractVersionId ? (
        <>
          <form onSubmit={agregar} className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 grid-cols-1 md:grid-cols-3">
            <FormField label="Comisión (%)" name="ratePercent" type="number" step="0.01" min="0" max="100" required placeholder="3.50" />
            <FormField kind="select" label="Categoría de producto" name="productCategory" options={[CUALQUIERA, ...merchantCategoryOptions]} hint="Vacío: aplica a todas." />
            <FormField kind="select" label="Segmento de riesgo" name="riskSegment" options={[CUALQUIERA, ...riskTierOptions]} hint="Vacío: aplica a todos." />
            <FormField label="Piso (Bs)" name="minFeeAmount" type="number" step="0.01" min="0" hint="Una venta de Bs 20 al 3 % deja Bs 0,60." />
            <FormField label="Techo (Bs)" name="maxFeeAmount" type="number" step="0.01" min="0" hint="Evita comisiones desproporcionadas en ventas grandes." />
            <div className="flex items-end">
              <AtlasButton type="submit" icon="add" loading={crear.isLoading} className="w-full">Agregar regla</AtlasButton>
            </div>
            {crear.error ? <div className="md:col-span-3"><InlineNotice tone="danger">{crear.error}</InlineNotice></div> : null}
          </form>

          <div className="mt-4">
            {cargando ? <p className="py-6 text-center text-xs text-slate-500">Cargando…</p>
              : reglas.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">Sin reglas: se usará el término MDR del contrato.</p>
              : (
                <div className="table-scroll rounded-lg border border-slate-200">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Comisión</th><th className="p-2.5">Categoría</th><th className="p-2.5">Segmento</th><th className="p-2.5 text-right">Piso</th><th className="p-2.5 text-right">Techo</th><th className="p-2.5">Estado</th><th className="p-2.5" /></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {reglas.map((regla) => (
                        <tr key={String(regla.id)} className={regla.isActive ? '' : 'opacity-50'}>
                          <td className="p-2.5 font-extrabold">{Number(regla.ratePercent).toFixed(2)} %</td>
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
            distinguen sucursal, luego categoría, luego segmento de riesgo. Una regla general no
            anula a una segmentada — la segmentada gana.
          </InlineNotice>
        </>
      ) : null}
    </Panel>
  );
}
