import { BusinessPartnerDetailScreen } from '@/components/screens/BusinessPartnerDetailScreen';

export default async function BusinessPartnerDetailPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <BusinessPartnerDetailScreen initialId={params.id ?? ''} />;
}
