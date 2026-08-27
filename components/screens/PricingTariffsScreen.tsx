'use client';

import { useCallback, useMemo, useState } from 'react';
import { portalService } from '@/services/portalService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob } from '@/lib/formatters';
import type { JsonObject, ResourceRow } from '@/services/types';

const tierOptions = [
  { label: 'STARTER', value: 'STARTER' },
  { label: 'STANDARD', value: 'STANDARD' },
  { label: 'PREMIUM', value: 'PREMIUM' },
  { label: 'ENTERPRISE', value: 'ENTERPRISE' },
];

const statusOptions = [
  { label: 'ACTIVE — visible y contratable', value: 'ACTIVE' },
  { label: 'INACTIVE — oculta para nuevos comercios', value: 'INACTIVE' },
  { label: 'ARCHIVED — retirada del catálogo', value: 'ARCHIVED' },
];

const chargeBasisLabel: Record<string, string> = {
  CPM: 'Alcance (CPM)',
  CPC: 'Clics (CPC)',
  MDR: 'Comisión de venta',
  FIXED: 'Importe fijo',
};

interface TariffForm {
  code: string;
  name: string;
  description: string;
  tier: string;
  cpmPrice: string;
  cpcPrice: string;
  currency: string;
  status: string;
  sortOrder: string;
  features: string;
}

const emptyForm: TariffForm = {
  code: '',
  name: '',
  description: '',
  tier: 'STANDARD',
  cpmPrice: '',
  cpcPrice: '',
  currency: 'BOB',
  status: 'ACTIVE',
  sortOrder: '0',
  features: '',
};

/** Una viñeta por línea: es como se escribe una lista y como se lee después en la tarjeta. */
function parseFeatures(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function formFromPlan(plan: ResourceRow): TariffForm {
  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
  return {
    code: String(plan.code ?? ''),
    name: String(plan.name ?? ''),
    description: String(plan.description ?? ''),
    tier: String(plan.tier ?? 'STANDARD'),
    cpmPrice: String(plan.cpmPrice ?? '0'),
    cpcPrice: String(plan.cpcPrice ?? '0'),
    currency: String(plan.currency ?? 'BOB'),
    status: String(plan.status ?? 'ACTIVE'),
    sortOrder: String(plan.sortOrder ?? 0),
    features: features.join('\n'),
  };
}

/**
 * Pricing de la plataforma: lo que Atlas le cobra al comercio por entregar publicidad.
 *
 * Hasta aquí estas dos cifras sólo se podían cambiar editando una migración SQL y volviendo a
 * desplegar, mientras la pantalla del comercio las anunciaba como precio. El cambio alcanza también
 * a quien ya tiene la tarifa contratada —la suscripción apunta al plan, no a una copia del precio—,
 * así que se avisa antes de guardar y cada cambio queda con su valor anterior en la bitácora de
 * acciones de negocio.
 */
export function PricingTariffsScreen() {
  const plansResource = useAsyncResource(useCallback(() => portalService.listPlans(), []));
  const plans = useMemo(() => (plansResource.data ?? []) as ResourceRow[], [plansResource.data]);
  const productsResource = useAsyncResource(useCallback(() => portalService.listBillingProducts(true), []));
  const products = (productsResource.data ?? []) as ResourceRow[];

  /** `null` = alta de una tarifa nueva; un id = edición de la existente. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TariffForm>({ ...emptyForm });

  const save = useAtlasMutation(async (input: { planId: string | null; body: JsonObject }) =>
    input.planId ? portalService.updatePlan(input.planId, input.body) : portalService.createPlan(input.body),
  );

  const setField = (key: keyof TariffForm) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  function startCreate() {
    save.reset();
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function startEdit(plan: ResourceRow) {
    save.reset();
    setEditingId(String(plan.id));
    setForm(formFromPlan(plan));
  }

  async function handleSave() {
    const common: JsonObject = {
      name: form.name.trim(),
      description: form.description.trim(),
      tier: form.tier,
      cpmPrice: Number(form.cpmPrice),
      cpcPrice: Number(form.cpcPrice),
      currency: form.currency.trim().toUpperCase(),
      features: parseFeatures(form.features),
      sortOrder: Number(form.sortOrder) || 0,
    };
    // El código identifica a la tarifa en la siembra y en los informes: se fija al crearla y no se
    // vuelve a tocar, porque renombrarlo convertiría el histórico en el de otra cosa.
    const body: JsonObject = editingId
      ? { ...common, status: form.status }
      : { ...common, code: form.code.trim().toUpperCase(), monthlyPrice: 0 };

    try {
      await save.execute({ planId: editingId, body });
      await plansResource.reload();
      if (!editingId) setForm({ ...emptyForm });
    } catch {
      /* `save.error` ya expone el mensaje del backend. */
    }
  }

  const cpm = Number(form.cpmPrice);
  const cpc = Number(form.cpcPrice);
  const canSave =
    form.name.trim().length > 0 &&
    Number.isFinite(cpm) &&
    cpm >= 0 &&
    Number.isFinite(cpc) &&
    cpc >= 0 &&
    (editingId !== null || /^[A-Z0-9_]{2,40}$/.test(form.code.trim().toUpperCase()));

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM B2B' }, { label: 'Tarifas y pricing' }]}
        title="Tarifas y pricing"
        description="Precio unitario de lo que Atlas le entrega al comercio: personas alcanzadas y clics recibidos. Es lo que cobra el motor de entrega y lo que se ve en el portal del comercio."
        actions={
          <AtlasButton variant="secondary" icon="refresh" loading={plansResource.status === 'loading'} onClick={plansResource.reload}>
            Actualizar
          </AtlasButton>
        }
      />

      {plansResource.error ? <InlineNotice tone="danger" title="No se pudieron cargar las tarifas">{plansResource.error}</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.85fr)]">
        <div className="space-y-4">
          <Panel
            title="Tarifas publicadas"
            description="Ordenadas como las ve el comercio. Editar una alcanza también a quienes ya la tienen contratada."
            icon="sell"
            action={<AtlasButton variant="secondary" icon="add" onClick={startCreate}>Nueva tarifa</AtlasButton>}
          >
            {plans.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {plans.map((plan) => {
                  const planId = String(plan.id);
                  const isEditing = planId === editingId;
                  return (
                    <section key={planId} className={`rounded-lg border p-4 ${isEditing ? 'border-[#006a61] ring-2 ring-[#006a61]/15' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-extrabold text-[#006a61]">{String(plan.name)}</h3>
                          <p className="font-mono text-[11px] text-slate-500">{String(plan.code)}</p>
                        </div>
                        <StatusPill tone={String(plan.status) === 'ACTIVE' ? 'success' : 'neutral'}>{String(plan.status)}</StatusPill>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-slate-50 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Alcance</p>
                          <p className="mt-0.5 text-base font-extrabold text-slate-900">{formatBob(Number(plan.cpmPrice ?? 0))}</p>
                          <p className="text-[11px] text-slate-500">cada 1.000 personas</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Clics</p>
                          <p className="mt-0.5 text-base font-extrabold text-slate-900">{formatBob(Number(plan.cpcPrice ?? 0))}</p>
                          <p className="text-[11px] text-slate-500">por clic recibido</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">{String(plan.tier)} · orden {String(plan.sortOrder ?? 0)}</span>
                        <AtlasButton variant="secondary" icon="edit" onClick={() => startEdit(plan)}>Editar tarifa</AtlasButton>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <Icon name="sell" className="text-[34px] text-slate-400" />
                <p className="mt-2 text-xs font-bold text-slate-700">Aún no hay tarifas publicadas</p>
                <p className="mt-1 text-[11px] text-slate-500">Cree la primera con el panel de la derecha; el comercio la verá en su portal.</p>
              </div>
            )}
          </Panel>

          <Panel
            title="Productos facturables"
            description="Lo que aparece como concepto en la factura del comercio. Viene sembrado con la base: aquí se configura el precio, no el catálogo."
            icon="inventory_2"
          >
            {productsResource.error ? <InlineNotice tone="danger" title="No se pudo cargar el catálogo">{productsResource.error}</InlineNotice> : null}
            {products.length ? (
              <div className="table-scroll rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Se cobra por</th>
                      <th className="p-2.5">Unidad</th>
                      <th className="p-2.5">Cuenta de ingreso</th>
                      <th className="p-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((product) => (
                      <tr key={String(product.id)}>
                        <td className="p-2.5 font-semibold text-slate-800">{String(product.name)}</td>
                        <td className="p-2.5 font-mono text-[11px]">{String(product.code)}</td>
                        <td className="p-2.5">{chargeBasisLabel[String(product.chargeBasis)] ?? String(product.chargeBasis)}</td>
                        <td className="p-2.5 text-slate-500">{String(product.unitLabel)}</td>
                        <td className="p-2.5 font-mono text-[11px]">{String(product.revenueGlAccountCode ?? '—')}</td>
                        <td className="p-2.5">
                          <StatusPill tone={String(product.status) === 'ACTIVE' ? 'success' : 'neutral'}>{String(product.status)}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">
                No hay productos facturables. Ejecute la siembra del catálogo (<span className="font-mono">db:seed:billing-products</span>).
              </p>
            )}
          </Panel>
        </div>

        <Panel
          title={editingId ? 'Editar tarifa' : 'Nueva tarifa'}
          description={editingId ? 'El código no se modifica: identifica a la tarifa en el histórico y en los informes.' : 'El código identifica la tarifa para siempre; el precio se puede cambiar después.'}
          icon={editingId ? 'edit' : 'add_circle'}
        >
          {save.status === 'success' ? (
            <InlineNotice tone="success" title={editingId ? 'Tarifa actualizada' : 'Tarifa creada'}>
              {editingId
                ? 'El nuevo precio rige desde la siguiente entrega, también para los comercios que ya la tenían contratada.'
                : 'Ya aparece en el portal del comercio.'}
            </InlineNotice>
          ) : null}
          {save.error ? <InlineNotice tone="danger" title="No se pudo guardar">{save.error}</InlineNotice> : null}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Código"
                name="code"
                required={!editingId}
                value={form.code}
                disabled={Boolean(editingId)}
                onChange={(e) => setField('code')(e.target.value.toUpperCase())}
                placeholder="GROWTH"
                hint={editingId ? 'Fijo' : 'Mayúsculas, dígitos y guion bajo'}
              />
              <FormField label="Orden" name="sortOrder" type="number" value={form.sortOrder} onChange={(e) => setField('sortOrder')(e.target.value)} />
            </div>
            <FormField label="Nombre visible" name="name" required value={form.name} onChange={(e) => setField('name')(e.target.value)} placeholder="Crecimiento" />
            <FormField
              kind="textarea"
              label="Descripción"
              name="description"
              value={form.description}
              onChange={(e) => setField('description')(e.target.value)}
              placeholder="Tarifa más baja a cambio de un compromiso mensual de inversión."
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Alcance (CPM)"
                name="cpmPrice"
                type="number"
                step="0.0001"
                min="0"
                required
                value={form.cpmPrice}
                onChange={(e) => setField('cpmPrice')(e.target.value)}
                hint="Por cada 1.000 personas"
              />
              <FormField
                label="Clic (CPC)"
                name="cpcPrice"
                type="number"
                step="0.0001"
                min="0"
                required
                value={form.cpcPrice}
                onChange={(e) => setField('cpcPrice')(e.target.value)}
                hint="Por clic recibido"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField kind="select" label="Nivel" name="tier" value={form.tier} onChange={(e) => setField('tier')(e.target.value)} options={tierOptions} />
              <FormField label="Moneda" name="currency" value={form.currency} onChange={(e) => setField('currency')(e.target.value.toUpperCase())} placeholder="BOB" />
            </div>

            {editingId ? (
              <FormField
                kind="select"
                label="Estado"
                name="status"
                value={form.status}
                onChange={(e) => setField('status')(e.target.value)}
                options={statusOptions}
                hint="Retirarla no cancela a quien ya la tiene contratada."
              />
            ) : null}

            <FormField
              kind="textarea"
              label="Qué incluye"
              name="features"
              value={form.features}
              onChange={(e) => setField('features')(e.target.value)}
              hint="Una línea por viñeta. Es el texto que lee el comercio en su portal."
              placeholder={'Sucursales ilimitadas\nSegmentación por zona e interés'}
            />

            {editingId ? (
              <InlineNotice tone="warning" title="Alcanza a los comercios ya suscritos">
                La suscripción apunta a la tarifa, no a una copia de su precio: el importe nuevo rige para todos desde la siguiente entrega. El anterior queda registrado en la bitácora de acciones de negocio.
              </InlineNotice>
            ) : null}

            <div className="flex gap-2">
              <AtlasButton icon="save" loading={save.isLoading} disabled={!canSave} onClick={handleSave}>
                {editingId ? 'Guardar tarifa' : 'Crear tarifa'}
              </AtlasButton>
              {editingId ? <AtlasButton variant="secondary" icon="close" onClick={startCreate}>Cancelar</AtlasButton> : null}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
