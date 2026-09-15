'use client';

import { useRouter } from 'next/navigation';
import { OnboardingCaseScreen } from '@/components/screens/OnboardingCaseScreen';
import { toast } from '@/lib/toast';

/** Apertura de un caso de onboarding con su checklist; al abrirlo se vuelve a la cola. */
export default function NewOnboardingCasePage() {
  const router = useRouter();
  return (
    <OnboardingCaseScreen
      onDone={() => {
        toast.success('Caso abierto', 'Ya está en la cola de «Por atender».');
        router.push('/operaciones/crm/onboarding');
      }}
    />
  );
}
