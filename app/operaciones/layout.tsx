import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';

export default function OperationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth audience="internal">
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
