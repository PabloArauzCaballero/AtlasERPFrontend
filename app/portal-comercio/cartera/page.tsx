import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { MerchantPortfolioScreen } from '@/components/screens/MerchantPortfolioScreen';

export const metadata: Metadata = { title: 'Mi cartera' };

/* `Suspense` por `useSearchParams`: la sección abierta viaja en la URL (`?tab=`). */
export default function MerchantPortfolioPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MerchantPortfolioScreen />
    </Suspense>
  );
}
