import { Suspense } from 'react';
import { CommandCenterScreen } from '@/components/screens/CommandCenterScreen';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

/* `Suspense` por `useSearchParams`: el texto buscado viaja en la URL (`?q=`) desde la barra superior. */
export default function GlobalSearchPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CommandCenterScreen />
    </Suspense>
  );
}
