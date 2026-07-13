import { GlAccountDetailScreen } from '@/components/screens/GlAccountDetailScreen';

export default async function GlAccountDetailPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <GlAccountDetailScreen initialId={params.id ?? ''} />;
}
