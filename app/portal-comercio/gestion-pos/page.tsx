import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { MerchantPosScreen } from '@/components/screens/MerchantPosScreen';

export const metadata: Metadata = { title: 'Gestión POS' };

/*
 * `Suspense` porque la pestaña abierta vive en la URL (`?tab=`) y `useSearchParams` obliga a
 * declarar el límite: sin él, `next build` falla al prerenderizar la ruta.
 */
export default function MerchantPosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MerchantPosScreen />
    </Suspense>
  );
}
