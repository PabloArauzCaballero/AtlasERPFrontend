import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { MerchantSupportScreen } from '@/components/screens/MerchantSupportScreen';

export const metadata: Metadata = { title: 'Soporte y tutoriales' };

/* `Suspense` por `useSearchParams`: la pestaña abierta viaja en la URL (`?tab=`). */
export default function MerchantSupportPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MerchantSupportScreen />
    </Suspense>
  );
}
