'use client';

import { useRouter } from 'next/navigation';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { seccionesAltaCuentaB2b } from '@/components/screens/altas/cuentaB2b';
import { b2bService } from '@/services/b2bService';
import { adjuntarArchivosDelExpediente } from '@/services/expedienteDeCuenta';

/** Los campos viven en `altas/cuentaB2b.ts`: el directorio los reusa para su carga masiva. */
export default function CreateB2BAccountPage() {
  const router = useRouter();
  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Registrar una empresa nueva"
      description="Da de alta una empresa en el directorio comercial con todo lo que su expediente exige —matrícula, representante legal con su poder, casa matriz y QR de cobro—, una sola vez: llega hecho a su portal. Los campos con asterisco son obligatorios. La empresa entra como «lead» (posible cliente) y avanza desde su ficha."
      submitLabel="Crear empresa"
      submitIcon="domain_add"
      onSubmit={async (payload) => {
        // Los archivos del expediente no viajan en el JSON: se suben con la cuenta ya creada (son suyos).
        const { poderNotarial, qrBancario, ...datos } = payload as typeof payload & { poderNotarial?: unknown; qrBancario?: unknown };
        const creada = await b2bService.createAccount(datos);
        if (creada?.id) await adjuntarArchivosDelExpediente(String(creada.id), { poderNotarial, qrBancario });
        // Al guardar se abre la ficha: es donde se califica y se abre la oportunidad (el paso siguiente).
        if (creada?.id) router.push(`/operaciones/crm/cuentas/detalle?id=${encodeURIComponent(String(creada.id))}`);
        return creada;
      }}
      sections={seccionesAltaCuentaB2b}
      summaryTitle="Qué pasa al crearla"
      summaryItems={[
        { label: 'Entra como', value: 'Posible cliente', tone: 'warning' },
        { label: 'Expediente', value: 'Completo desde el alta', tone: 'success' },
        { label: 'Moneda', value: 'Bolivianos (BOB)', tone: 'success' },
      ]}
    />
  );
}
