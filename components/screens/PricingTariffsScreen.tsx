'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { portalService } from '@/services/portalService';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import type { JsonObject } from '@/services/types';

const tierOptions = ['STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE'].map((value) => ({ label: value, value }));

const statusOptions = [
  { label: 'ACTIVE — visible y contratable', value: 'ACTIVE' },
  { label: 'INACTIVE — oculta para nuevos comercios', value: 'INACTIVE' },
  { label: 'ARCHIVED — retirada del catálogo', value: 'ARCHIVED' },
];

/** Una viñeta por línea: es como se escribe la lista y como se lee después en el portal. */
function parseFeatures(text: unknown): string[] {
  return String(text ?? '')
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Los campos comunes al alta y a la edición: el código sólo existe en el alta. */
const camposComunes: ActionField[] = [
  { name: 'name', label: 'Nombre visible', required: true, span: 2, placeholder: 'Crecimiento' },
  { name: 'description', label: 'Descripción', type: 'textarea', span: 2, placeholder: 'Tarifa más baja a cambio de un compromiso mensual de inversión.' },
  { name: 'cpmPrice', label: 'Alcance (CPM)', type: 'number', valueKind: 'number', required: true, hint: 'Por cada 1.000 personas' },
  { name: 'cpcPrice', label: 'Clic (CPC)', type: 'number', valueKind: 'number', required: true, hint: 'Por clic recibido' },
  { name: 'tier', label: 'Nivel', type: 'select', required: true, defaultValue: 'STANDARD', options: tierOptions },
  { name: 'currency', label: 'Moneda', defaultValue: 'BOB' },
  { name: 'sortOrder', label: 'Orden', type: 'number', valueKind: 'number', defaultValue: 0, hint: 'Posición en el portal del comercio.' },
  { name: 'features', label: 'Qué incluye', type: 'textarea', span: 2, hint: 'Una línea por viñeta. Es el texto que lee el comercio en su portal.' },
];

/** Lo que se manda al backend en los dos casos: las viñetas van como lista, no como texto. */
function cuerpoComun(payload: JsonObject): JsonObject {
  return {
    name: String(payload.name ?? '').trim(),
    description: String(payload.description ?? '').trim(),
    tier: payload.tier,
    cpmPrice: Number(payload.cpmPrice ?? 0),
    cpcPrice: Number(payload.cpcPrice ?? 0),
    currency: String(payload.currency ?? 'BOB').trim().toUpperCase(),
    features: parseFeatures(payload.features),
    sortOrder: Number(payload.sortOrder ?? 0) || 0,
  };
}

/**
 * Tarifas y pricing: la tabla primero, el alta arriba y la edición en la fila.
 *
 * La pantalla eran tarjetas con un formulario clavado al lado derecho: siempre visible aunque no se
 * fuera a crear nada, y «Editar tarifa» lo rellenaba a diez centímetros de la tarjeta que se estaba
 * mirando —lejos de la fila, y sin decir sobre cuál se estaba escribiendo—. Es la misma disciplina
 * que el resto del ERP: una tabla que se puede filtrar, buscar y exportar; «Nueva tarifa» arriba, y
 * el lápiz en la fila.
 *
 * El catálogo de productos facturables sigue siendo de sólo lectura y vive en su propia pestaña:
 * es lo que aparece como concepto en la factura del comercio, y aquí se configura el precio, no el
 * catálogo.
 */
export function PricingTariffsScreen() {
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarPlanes = useCallback(() => portalService.listPlans(), [version]);
  const cargarProductos = useCallback(() => portalService.listBillingProducts(true), []);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM B2B' }, { label: 'Tarifas y pricing' }]}
        title="Tarifas y pricing"
        description="Precio unitario de lo que Atlas le entrega al comercio: personas alcanzadas y clics recibidos. Es lo que cobra el motor de entrega y lo que se ve en el portal del comercio."
      />
      <TabbedPanels
        keepMounted
        tabs={[
          {
            id: 'tarifas',
            label: 'Tarifas publicadas',
            icon: 'sell',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM B2B"
                title="Tarifas publicadas"
                description="Ordenadas como las ve el comercio. Editar una alcanza también a quienes ya la tienen contratada."
                load={cargarPlanes}
                labelKey="name"
                searchPlaceholder="Buscar por nombre, código o nivel…"
                emptyHint="Crea la primera con «Nueva tarifa»; el comercio la verá en su portal."
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Tarifa' },
                  { key: 'tier', label: 'Nivel' },
                  { key: 'cpmPrice', label: 'Alcance (CPM)', kind: 'money', align: 'right' },
                  { key: 'cpcPrice', label: 'Clic (CPC)', kind: 'money', align: 'right' },
                  { key: 'currency', label: 'Moneda' },
                  { key: 'sortOrder', label: 'Orden', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }, { key: 'tier', label: 'Nivel' }]}
                notice={{
                  tone: 'warning',
                  title: 'Un cambio de precio alcanza a los comercios ya suscritos',
                  body: 'La suscripción apunta a la tarifa, no a una copia de su precio: el importe nuevo rige para todos desde la siguiente entrega, y el anterior queda en la bitácora de acciones de negocio.',
                }}
                create={{
                  label: 'Nueva tarifa',
                  title: 'Nueva tarifa',
                  description: 'El código identifica la tarifa para siempre; el precio se puede cambiar después.',
                  submit: async (payload) => {
                    const resultado = await portalService.createPlan({
                      ...cuerpoComun(payload),
                      code: String(payload.code ?? '').trim().toUpperCase(),
                      monthlyPrice: 0,
                    });
                    recargar();
                    return resultado;
                  },
                  fields: [
                    { name: 'code', label: 'Código', required: true, span: 2, placeholder: 'GROWTH', hint: 'Mayúsculas, dígitos y guion bajo. No se puede cambiar después.' },
                    ...camposComunes,
                  ],
                }}
                edit={{
                  description: 'El código no se modifica: identifica a la tarifa en el histórico y en los informes.',
                  fields: [
                    ...camposComunes,
                    { name: 'status', label: 'Estado', type: 'select', required: true, span: 2, options: statusOptions, hint: 'Retirarla no cancela a quien ya la tiene contratada.' },
                  ],
                  submit: async (id, payload) => {
                    const resultado = await portalService.updatePlan(id, { ...cuerpoComun(payload), status: payload.status });
                    recargar();
                    return resultado;
                  },
                }}
              />
            ),
          },
          {
            id: 'productos',
            label: 'Productos facturables',
            icon: 'inventory_2',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM B2B"
                title="Productos facturables"
                description="Lo que aparece como concepto en la factura del comercio. Viene sembrado con la base: aquí se configura el precio, no el catálogo."
                load={cargarProductos}
                labelKey="name"
                searchPlaceholder="Buscar por producto o código…"
                emptyHint="No hay productos facturables. Ejecute la siembra del catálogo (db:seed:billing-products)."
                columns={[
                  { key: 'name', label: 'Producto' },
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'chargeBasis', label: 'Se cobra por' },
                  { key: 'unitLabel', label: 'Unidad' },
                  { key: 'revenueGlAccountCode', label: 'Cuenta de ingreso', kind: 'mono' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }, { key: 'chargeBasis', label: 'Se cobra por' }]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
