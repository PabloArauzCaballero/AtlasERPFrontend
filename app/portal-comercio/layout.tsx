import { MerchantPortalShell } from '@/components/layout/MerchantPortalShell';
import { RequireAuth } from '@/components/layout/RequireAuth';

export default function MerchantPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth audience="merchant">
      <MerchantPortalShell>{children}</MerchantPortalShell>
    </RequireAuth>
  );
}
