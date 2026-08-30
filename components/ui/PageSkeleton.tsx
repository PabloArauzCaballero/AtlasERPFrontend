import { Card } from './card';
import { InlineLoading, SkeletonBlock } from './LoadingIndicator';

/**
 * Fallback visual para transiciones de App Router y primera carga de pantalla.
 */
export function PageSkeleton() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-9 w-full max-w-lg" />
        <SkeletonBlock className="h-5 w-full max-w-2xl" />
      </div>
      <Card className="space-y-4">
        <InlineLoading text="Preparando vista" />
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => <SkeletonBlock className="h-8" key={index} />)}
        </div>
      </Card>
    </section>
  );
}
