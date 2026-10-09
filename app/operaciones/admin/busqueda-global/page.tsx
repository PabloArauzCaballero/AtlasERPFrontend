import { CommandCenterScreen } from '@/components/screens/CommandCenterScreen';

/* Sin `Suspense`: la pantalla ya no lee `useSearchParams`, el texto buscado le llega por `lib/busquedaGlobal.ts`. */
export default function GlobalSearchPage() {
  return <CommandCenterScreen />;
}
