'use client';

import { useRouter } from 'next/navigation';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { seccionesAltaCuentaB2b } from '@/components/screens/altas/cuentaB2b';
import { b2bService } from '@/services/b2bService';

/** Los campos viven en `altas/cuentaB2b.ts`: el directorio los reusa para su carga masiva. */
export default function CreateB2BAccountPage() {
  const router = useRouter();
  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Registrar una empresa nueva"
      description="Da de alta una empresa en el directorio comercial. Con los datos marcados con asterisco basta para crearla; el resto se puede completar después. La empresa entra como «lead» (posible cliente) y avanza desde su ficha."
      submitLabel="Crear empresa"
      submitIcon="domain_add"
      onSubmit={async (payload) => {
        const creada = await b2bService.createAccount(payload);
        // Al guardar se abre la ficha: es donde se califica y se abre la oportunidad (el paso siguiente).
        if (creada?.id) router.push(`/operaciones/crm/cuentas/detalle?id=${encodeURIComponent(String(creada.id))}`);
        return creada;
      }}
      sections={seccionesAltaCuentaB2b}
      summaryTitle="Qué pasa al crearla"
      summaryItems={[
        { label: 'Entra como', value: 'Posible cliente', tone: 'warning' },
        { label: 'Verificación legal', value: 'Queda pendiente', tone: 'neutral' },
        { label: 'Moneda', value: 'Bolivianos (BOB)', tone: 'success' },
      ]}
    />
  );
}
