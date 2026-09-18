import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { MerchantBillingScreen } from '@/components/screens/MerchantBillingScreen';

export const metadata: Metadata = { title: 'Consumo y facturación' };

/* `Suspense` por `useSearchParams`: la sección abierta viaja en la URL (`?tab=`). */
export default function MerchantBillingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MerchantBillingScreen />
    </Suspense>
  );
}
