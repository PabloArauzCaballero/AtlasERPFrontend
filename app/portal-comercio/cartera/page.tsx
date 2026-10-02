import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CarteraFacturacionSwitch } from '@/components/layout/CarteraFacturacionSwitch';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { MerchantPortfolioScreen } from '@/components/screens/MerchantPortfolioScreen';

export const metadata: Metadata = { title: 'Mi cartera' };

/* `Suspense` por `useSearchParams`: la sección abierta viaja en la URL (`?tab=`). */
export default function MerchantPortfolioPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CarteraFacturacionSwitch actual="/portal-comercio/cartera" />
      <MerchantPortfolioScreen />
    </Suspense>
  );
}
