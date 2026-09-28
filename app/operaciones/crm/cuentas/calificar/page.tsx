import { QualifyAccountScreen } from '@/components/screens/QualifyAccountScreen';

/* La cuenta llega en `?accountId=` desde su ficha: el formulario la trae ya elegida. */
export default async function QualifyAccountPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const params = await searchParams;
  return <QualifyAccountScreen accountId={params.accountId ?? ''} />;
}
