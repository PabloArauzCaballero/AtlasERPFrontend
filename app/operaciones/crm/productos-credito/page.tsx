'use client';

import { useCallback, useMemo, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { avisoDeCobertura, creditProductsService, cuerpoDeProducto, type EstadoDeProducto, type ProductoDeCredito } from '@/services/creditProductsService';
import type { ResourceRow } from '@/services/types';

const ESTADOS: Record<string, string> = { draft: 'Borrador', active: 'Activo', suspended: 'Suspendido', retired: 'Retirado' };
const tonoDeEstado = (codigo: string) => (codigo === 'active' ? 'success' : codigo === 'suspended' ? 'warning' : 'neutral');

export default function CreditProductsPage() {
  const [version, setVersion] = useState(0);
  const [productos, setProductos] = useState<ProductoDeCredito[]>([]);
  const [cargado, setCargado] = useState(false);
  const cargar = useCallback(async () => {
    const lista = await creditProductsService.list();
    setProductos(lista);
    setCargado(true);
    return lista as ResourceRow[];
  }, []);
  // `version` no se lee dentro: cambia para que la lista se vuelva a pedir tras crear o cambiar un estado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => cargar(), [cargar, version]);

  const aviso = useMemo(() => (cargado ? avisoDeCobertura(productos) : null), [cargado, productos]);
  const hayActivo = productos.some((p) => p.status === 'active');
  const cambiar = (estado: EstadoDeProducto) => async (row: ResourceRow) => {
    await creditProductsService.changeStatus(String(row.id), estado);
    setVersion((v) => v + 1);
  };

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Productos de crédito"
      description="Los productos con los que Atlas financia las compras: su rango de monto, su plazo y su tasa. La app del cliente elige el producto activo que admite la parte financiada de la compra; sin uno, la compra no avanza."
      load={load}
      labelKey="productName"
      searchPlaceholder="Buscar por nombre o código…"
      emptyHint="Todavía no hay ningún producto. Crea el primero con «Nuevo producto» y actívalo para que las compras puedan financiarse."
      columns={[
        { key: 'productName', label: 'Producto' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'minAmount', label: 'Financia desde', kind: 'money', align: 'right' },
        { key: 'maxAmount', label: 'Hasta', kind: 'money', align: 'right' },
        { key: 'minTermMonths', label: 'Plazo mín. (meses)', align: 'right' },
        { key: 'maxTermMonths', label: 'Plazo máx. (meses)', align: 'right' },
        { key: 'annualInterestRate', label: 'Tasa anual %', align: 'right' },
        { key: 'status', label: 'Estado', kind: 'status', labels: ESTADOS, tone: tonoDeEstado },
      ]}
      notice={
        aviso
          ? { tone: hayActivo ? 'info' : 'warning', title: hayActivo ? 'Qué compras cubren hoy los productos activos' : 'Ninguna compra puede financiarse todavía', body: aviso }
          : undefined
      }
      create={{
        label: 'Nuevo producto',
        title: 'Nuevo producto de crédito',
        description: 'Nace en borrador: nadie lo ve hasta que lo actives. Los montos son de la parte FINANCIADA (el 40 % de la compra): para que una compra de Bs 200 pueda financiarse, el mínimo tiene que ser Bs 80 o menos.',
        fields: [
          { name: 'productName', label: 'Nombre del producto', tooltip: 'Cómo se llama el producto en las pantallas; el código del sistema se genera solo a partir de este nombre.', required: true, placeholder: 'Compra a cuotas Atlas', span: 2 },
          { name: 'currencyCode', label: 'Moneda', tooltip: 'Moneda en la que se expresan los montos del producto.', optionsSource: 'catalog:currency', required: true, defaultValue: 'BOB' },
          { name: 'minAmount', label: 'Financia desde (monto mínimo)', tooltip: 'La menor parte financiada que admite este producto. La app financia el 40 % de la compra: con mínimo 50 se pueden financiar compras desde Bs 125.', type: 'number', valueKind: 'number', required: true, defaultValue: 50 },
          { name: 'maxAmount', label: 'Financia hasta (monto máximo)', tooltip: 'La mayor parte financiada que admite este producto. Una compra que financie más no encuentra producto.', type: 'number', valueKind: 'number', required: true, defaultValue: 5000 },
          { name: 'minTermMonths', label: 'Plazo mínimo (meses)', tooltip: 'Cuántos meses dura, como mínimo, el pago en cuotas.', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
          { name: 'maxTermMonths', label: 'Plazo máximo (meses)', tooltip: 'Cuántos meses dura, como máximo, el pago en cuotas. Tiene que incluir el plazo que pide la app.', type: 'number', valueKind: 'number', required: true, defaultValue: 3 },
          { name: 'annualInterestRate', label: 'Tasa anual % (opcional)', tooltip: 'Tasa de interés anual del producto, en porcentaje. Si la dejas vacía la fija el motor de decisiones para cada cliente.', type: 'number', valueKind: 'number', optional: true, placeholder: '18' },
          { name: 'description', label: 'Descripción (opcional)', tooltip: 'Texto libre que explica para quién es este producto.', type: 'textarea', optional: true, span: 2 },
        ],
        submit: async (payload) => {
          const creado = await creditProductsService.create(cuerpoDeProducto(payload));
          setVersion((v) => v + 1);
          return creado;
        },
      }}
      extraActions={[
        {
          key: 'activar',
          label: 'Activar',
          description: 'Lo hace visible para la app: desde ahora las compras cuya parte financiada entre en su rango podrán usarlo.',
          icon: 'play_circle',
          tone: 'success',
          primary: true,
          enabled: (row) => row.status === 'draft' || row.status === 'suspended',
          confirm: { title: 'Activar producto', message: 'La app empezará a ofrecer este producto a los clientes. ¿Activarlo?', confirmLabel: 'Activar' },
          run: cambiar('active'),
        },
        {
          key: 'suspender',
          label: 'Suspender',
          description: 'Deja de ofrecerlo sin perder su historial. Se puede volver a activar.',
          icon: 'pause_circle',
          enabled: (row) => row.status === 'active',
          confirm: { title: 'Suspender producto', message: 'La app dejará de ofrecerlo; las solicitudes ya hechas no cambian. ¿Suspenderlo?', confirmLabel: 'Suspender' },
          run: cambiar('suspended'),
        },
        {
          key: 'retirar',
          label: 'Retirar',
          description: 'Lo retira para siempre. Un producto equivocado se retira y se crea otro: no se puede editar.',
          icon: 'delete_forever',
          tone: 'danger',
          enabled: (row) => row.status !== 'retired',
          confirm: { title: 'Retirar producto', message: 'Un producto retirado no vuelve a activarse. ¿Retirarlo?', confirmLabel: 'Retirar' },
          run: cambiar('retired'),
        },
      ]}
    />
  );
}
