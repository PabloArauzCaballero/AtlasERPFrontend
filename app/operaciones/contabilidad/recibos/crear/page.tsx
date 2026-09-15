'use client';

import { useRouter } from 'next/navigation';
import { ReceiptScreen } from '@/components/screens/ReceiptScreen';
import { toast } from '@/lib/toast';

/** Alta de un recibo con sus asignaciones a facturas; al contabilizarlo se vuelve al listado. */
export default function NewReceiptPage() {
  const router = useRouter();
  return (
    <ReceiptScreen
      onDone={() => {
        toast.success('Recibo contabilizado', 'Ya aparece en el listado de recibos.');
        router.push('/operaciones/contabilidad/recibos');
      }}
    />
  );
}
