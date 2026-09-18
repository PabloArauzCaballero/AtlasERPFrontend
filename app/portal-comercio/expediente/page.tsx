import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { PartnerDossierScreen } from '@/components/screens/PartnerDossierScreen';

export const metadata: Metadata = { title: 'Mi empresa' };

/* `Suspense` por `useSearchParams`: la pestaña abierta viaja en la URL (`?tab=`). */
export default function PartnerDossierPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PartnerDossierScreen />
    </Suspense>
  );
}
