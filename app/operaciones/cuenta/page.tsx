import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { PasswordChangePanel } from '@/components/screens/PasswordChangePanel';

export default function InternalAccountPage() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Cuenta"
        title="Mi cuenta"
        description="Seguridad de tu acceso al panel interno."
        breadcrumbs={[{ label: 'Operaciones', href: '/operaciones' }, { label: 'Mi cuenta' }]}
      />
      <PasswordChangePanel />
    </div>
  );
}
