import { AccountDetailScreen } from '@/components/screens/AccountDetailScreen';

export default async function AccountDetailPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <AccountDetailScreen initialId={params.id ?? ''} />;
}
