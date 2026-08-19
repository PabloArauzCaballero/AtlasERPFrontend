import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { PasswordChangePanel } from '@/components/screens/PasswordChangePanel';

export default function MerchantAccountPage() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Cuenta"
        title="Mi cuenta"
        description="Seguridad de tu acceso al portal del comercio."
        breadcrumbs={[{ label: 'Portal del comercio', href: '/portal-comercio/planes' }, { label: 'Mi cuenta' }]}
      />
      <PasswordChangePanel />
    </div>
  );
}
